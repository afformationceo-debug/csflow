import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { EscalationPriority } from "@/lib/supabase/types";
import { slackNotificationService } from "@/services/slack-notification";

// Only import verifySignatureAppRouter if signing keys are available
const hasQStashKeys = !!(
  process.env.QSTASH_CURRENT_SIGNING_KEY &&
  process.env.QSTASH_NEXT_SIGNING_KEY
);

interface EscalationNotifyPayload {
  type: "send_escalation_notification";
  data: {
    escalationId: string;
    conversationId: string;
    reason: string;
    priority: EscalationPriority;
  };
}

/**
 * Job handler for sending escalation notifications
 */
async function handler(request: NextRequest) {
  try {
    const payload: EscalationNotifyPayload = await request.json();
    const { data } = payload;

    const supabase = await createServiceClient();

    // Get escalation details with conversation and customer info
    const { data: escalation } = await supabase
      .from("escalations")
      .select(
        `
        *,
        conversation:conversations(
          *,
          customer:customers(*)
        )
      `
      )
      .eq("id", data.escalationId)
      .single();

    if (!escalation) {
      return NextResponse.json(
        { error: "Escalation not found" },
        { status: 404 }
      );
    }

    const escalationData = escalation as unknown as {
      conversation: {
        tenant_id: string;
        customer: {
          name?: string;
          country?: string;
        };
      };
    };

    const conversation = escalationData.conversation as {
      tenant_id: string;
      customer: {
        name?: string;
        country?: string;
      };
    };

    // Get tenant settings for notification preferences
    const { data: tenant } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", conversation.tenant_id)
      .single();

    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 404 }
      );
    }

    const tenantData = tenant as unknown as {
      name: string;
      display_name?: string;
      name_en?: string;
      settings: {
        slack_webhook_url?: string;
        notification_phones?: string[];
      };
    };
    // Normalize display name across schema variations
    const tenantDisplayName = tenantData.display_name || tenantData.name_en || tenantData.name || "알 수 없는 거래처";

    const settings = tenantData.settings;

    // Get assigned user or all managers
    let notifyUsers: { id: string; email: string; name: string }[] = [];

    const escalationRecord = escalation as unknown as { assigned_to?: string };

    if (escalationRecord.assigned_to) {
      const { data: user } = await supabase
        .from("users")
        .select("id, email, name")
        .eq("id", escalationRecord.assigned_to)
        .single();
      if (user) notifyUsers.push(user);
    } else {
      // Get all managers for this tenant
      const { data: managers } = await supabase
        .from("users")
        .select("id, email, name")
        .contains("tenant_ids", [conversation.tenant_id])
        .in("role", ["admin", "manager"])
        .eq("is_active", true);
      if (managers) notifyUsers = managers;
    }

    // Build notification message
    const priorityEmoji = {
      low: "🟢",
      medium: "🟡",
      high: "🟠",
      urgent: "🔴",
    }[data.priority];

    const notificationText = `${priorityEmoji} 새 에스컬레이션 발생

거래처: ${tenantDisplayName}
고객: ${conversation.customer.name || "알 수 없음"} (${conversation.customer.country || "국가 미상"})
사유: ${data.reason}
우선순위: ${data.priority.toUpperCase()}

대시보드에서 확인하세요.`;

    // Send Slack notification via Web API token (primary)
    const slackChannel = (settings as Record<string, unknown>).slack_channel as string | undefined;
    await slackNotificationService.sendEscalationNotification(
      {
        escalationId: data.escalationId,
        tenantName: tenantDisplayName,
        customerName: conversation.customer.name || "알 수 없음",
        customerCountry: conversation.customer.country || "미상",
        priority: data.priority,
        reason: data.reason,
      },
      slackChannel
    );

    // Fallback: Send via webhook if configured (기존 호환)
    if (settings.slack_webhook_url) {
      await slackNotificationService.sendViaWebhook(settings.slack_webhook_url, {
        text: notificationText,
      });
    }

    // Log notification sent
    console.log(
      `Escalation notification sent for ${data.escalationId} to ${notifyUsers.length} users`
    );

    return NextResponse.json({
      success: true,
      notifiedUsers: notifyUsers.length,
    });
  } catch (error) {
    console.error("Escalation notify job error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Wrap with QStash signature verification if keys are available
// Otherwise, use the handler directly (for development)
export async function POST(request: NextRequest) {
  if (hasQStashKeys) {
    // Dynamically import and verify signature
    const { verifySignatureAppRouter } = await import("@upstash/qstash/nextjs");
    const verifiedHandler = verifySignatureAppRouter(handler);
    return verifiedHandler(request);
  }
  // In development without QStash keys, just run the handler
  return handler(request);
}
