import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { serverEscalationService } from "@/services/escalations";
import { enqueueJob } from "@/lib/upstash/qstash";
import { ruleEngine } from "@/services/automation/rule-engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60 seconds for processing

const DEFAULT_THRESHOLD_MINUTES = 60;
const MAX_CONVERSATIONS_PER_RUN = 50;

interface StaleConversationResult {
  conversationId: string;
  customerId: string;
  customerName: string;
  status: "escalated" | "skipped" | "error";
  reason?: string;
}

/**
 * Cron job handler to detect conversations with no agent response
 * for a configurable threshold (default: 60 minutes).
 *
 * For each stale conversation:
 * 1. Verifies the last message was inbound (from customer)
 * 2. Creates an escalation with reason "N분 이상 미응답"
 * 3. Updates conversation status to "escalated"
 * 4. Adds "미응답" tag to the customer
 * 5. Sends notification to assigned agent or all agents
 * 6. Triggers automation rules for "no_response_24h"
 */
async function checkNoResponse(
  thresholdMinutes: number
): Promise<{
  processed: number;
  escalated: number;
  skipped: number;
  errors: number;
  details: StaleConversationResult[];
}> {
  const supabase = await createServiceClient();
  const thresholdMs = thresholdMinutes * 60 * 1000;
  const cutoffTime = new Date(Date.now() - thresholdMs).toISOString();

  // Query conversations that have been waiting too long
  const { data: staleConversations, error: queryError } = await (
    supabase as any
  )
    .from("conversations")
    .select("*, customer:customers(*)")
    .in("status", ["active", "waiting"])
    .lt("last_message_at", cutoffTime)
    .order("last_message_at", { ascending: true })
    .limit(MAX_CONVERSATIONS_PER_RUN);

  if (queryError) {
    console.error("Failed to query stale conversations:", queryError);
    throw new Error(`Database query failed: ${queryError.message}`);
  }

  if (!staleConversations || staleConversations.length === 0) {
    return {
      processed: 0,
      escalated: 0,
      skipped: 0,
      errors: 0,
      details: [],
    };
  }

  let escalatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const details: StaleConversationResult[] = [];

  for (const conv of staleConversations) {
    try {
      // Check if the last message was inbound (from customer)
      const { data: lastMessage, error: msgError } = await (supabase as any)
        .from("messages")
        .select("*")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (msgError || !lastMessage) {
        skippedCount++;
        details.push({
          conversationId: conv.id,
          customerId: conv.customer?.id || "unknown",
          customerName: conv.customer?.name || "unknown",
          status: "skipped",
          reason: "No messages found",
        });
        continue;
      }

      // Skip if the last message was not from the customer
      if (lastMessage.direction !== "inbound") {
        skippedCount++;
        details.push({
          conversationId: conv.id,
          customerId: conv.customer?.id || "unknown",
          customerName: conv.customer?.name || "unknown",
          status: "skipped",
          reason: "Last message is outbound (agent already responded)",
        });
        continue;
      }

      // Check if there's already a pending/in_progress escalation for this conversation
      const { data: existingEscalation } = await (supabase as any)
        .from("escalations")
        .select("id")
        .eq("conversation_id", conv.id)
        .in("status", ["pending", "assigned", "in_progress"])
        .limit(1)
        .single();

      if (existingEscalation) {
        skippedCount++;
        details.push({
          conversationId: conv.id,
          customerId: conv.customer?.id || "unknown",
          customerName: conv.customer?.name || "unknown",
          status: "skipped",
          reason: "Already has active escalation",
        });
        continue;
      }

      // Create escalation
      await serverEscalationService.createEscalation({
        conversationId: conv.id,
        messageId: lastMessage.id,
        reason: `${thresholdMinutes}분 이상 미응답`,
        priority: thresholdMinutes >= 120 ? "high" : "medium",
        aiConfidence: 0,
      });

      // Update conversation status to escalated
      await (supabase as any)
        .from("conversations")
        .update({ status: "escalated" })
        .eq("id", conv.id);

      // Add "미응답" tag to customer if not already present
      if (conv.customer?.id) {
        const currentTags: string[] = conv.customer?.tags || [];
        if (!currentTags.includes("미응답")) {
          await (supabase as any)
            .from("customers")
            .update({ tags: [...currentTags, "미응답"] })
            .eq("id", conv.customer.id);
        }
      }

      // Send notification to assigned agent or all agents
      await enqueueJob({
        type: "send_notification",
        data: {
          channel: "slack",
          message: `\u23F0 미응답 알림: ${conv.customer?.name || "고객"}님의 대화가 ${thresholdMinutes}분 이상 응답 없습니다.`,
          recipients: conv.assigned_to
            ? [conv.assigned_to]
            : "all_agents",
          tenantId: conv.tenant_id,
          conversationId: conv.id,
        },
      });

      // Trigger automation rules for no_response
      try {
        await ruleEngine.processTrigger("no_response_24h", {
          tenantId: conv.tenant_id,
          conversationId: conv.id,
          customerId: conv.customer?.id,
        });
      } catch (automationError) {
        // Don't fail the whole process if automation rules fail
        console.warn(
          `Automation rule trigger failed for conversation ${conv.id}:`,
          automationError
        );
      }

      escalatedCount++;
      details.push({
        conversationId: conv.id,
        customerId: conv.customer?.id || "unknown",
        customerName: conv.customer?.name || "unknown",
        status: "escalated",
      });

      console.log(
        `[check-no-response] Escalated conversation ${conv.id} - ` +
          `Customer: ${conv.customer?.name || "unknown"}, ` +
          `Last message: ${lastMessage.created_at}`
      );
    } catch (error) {
      errorCount++;
      details.push({
        conversationId: conv.id,
        customerId: conv.customer?.id || "unknown",
        customerName: conv.customer?.name || "unknown",
        status: "error",
        reason: error instanceof Error ? error.message : "Unknown error",
      });
      console.error(
        `[check-no-response] Error processing conversation ${conv.id}:`,
        error
      );
    }
  }

  return {
    processed: staleConversations.length,
    escalated: escalatedCount,
    skipped: skippedCount,
    errors: errorCount,
    details,
  };
}

/**
 * GET handler for Vercel Cron
 *
 * Called on a schedule (e.g., every 15 minutes).
 * Supports configurable threshold via query param: ?threshold=60
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret if configured (Vercel Cron sends this header)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const thresholdMinutes =
      parseInt(searchParams.get("threshold") || "", 10) ||
      DEFAULT_THRESHOLD_MINUTES;

    console.log(
      `[check-no-response] Starting cron job with threshold: ${thresholdMinutes}m`
    );

    const result = await checkNoResponse(thresholdMinutes);

    console.log(
      `[check-no-response] Completed - ` +
        `Processed: ${result.processed}, ` +
        `Escalated: ${result.escalated}, ` +
        `Skipped: ${result.skipped}, ` +
        `Errors: ${result.errors}`
    );

    return NextResponse.json({
      success: true,
      processed: result.processed,
      escalated: result.escalated,
      skipped: result.skipped,
      errors: result.errors,
      threshold: `${thresholdMinutes}m`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[check-no-response] Cron job failed:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST handler for QStash scheduled jobs
 *
 * Can be triggered by QStash on a schedule or manually.
 * Payload: { type: "check_no_response", data: { thresholdMinutes?: number } }
 */
export async function POST(request: NextRequest) {
  try {
    // Optionally verify QStash signature
    const hasQStashKeys = !!(
      process.env.QSTASH_CURRENT_SIGNING_KEY &&
      process.env.QSTASH_NEXT_SIGNING_KEY
    );

    if (hasQStashKeys) {
      const { verifySignatureAppRouter } = await import(
        "@upstash/qstash/nextjs"
      );
      const verifiedHandler = verifySignatureAppRouter(
        async (req: NextRequest) => {
          return handlePostRequest(req);
        }
      );
      return verifiedHandler(request);
    }

    // In development without QStash keys, run directly
    return handlePostRequest(request);
  } catch (error) {
    console.error("[check-no-response] POST handler failed:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

async function handlePostRequest(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => ({}));
  const thresholdMinutes =
    body?.data?.thresholdMinutes || DEFAULT_THRESHOLD_MINUTES;

  console.log(
    `[check-no-response] Starting POST job with threshold: ${thresholdMinutes}m`
  );

  const result = await checkNoResponse(thresholdMinutes);

  console.log(
    `[check-no-response] Completed - ` +
      `Processed: ${result.processed}, ` +
      `Escalated: ${result.escalated}, ` +
      `Skipped: ${result.skipped}, ` +
      `Errors: ${result.errors}`
  );

  return NextResponse.json({
    success: true,
    processed: result.processed,
    escalated: result.escalated,
    skipped: result.skipped,
    errors: result.errors,
    threshold: `${thresholdMinutes}m`,
    timestamp: new Date().toISOString(),
  });
}
