import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Force dynamic - no caching for real-time data
export const dynamic = "force-dynamic";

// Priority mapping: DB uses "urgent", page uses "critical"
function mapPriorityFromDB(dbPriority: string): string {
  if (dbPriority === "urgent") return "critical";
  return dbPriority; // high, medium, low pass through
}

// Status mapping: DB uses "pending"/"assigned", page uses "open"
function mapStatusFromDB(dbStatus: string): string {
  if (dbStatus === "pending" || dbStatus === "assigned") return "open";
  return dbStatus; // in_progress, resolved pass through
}

// Reverse: page status -> DB status
function mapStatusToDB(pageStatus: string): string {
  if (pageStatus === "open") return "pending";
  return pageStatus; // in_progress, resolved pass through
}

// Reverse: page priority -> DB priority
function mapPriorityToDB(pagePriority: string): string {
  if (pagePriority === "critical") return "urgent";
  return pagePriority;
}

// SLA deadline hours by priority (page priority values)
const SLA_HOURS: Record<string, number> = {
  critical: 1,
  high: 2,
  medium: 4,
  low: 8,
};

function computeSLADeadline(createdAt: string, pagePriority: string): string {
  const created = new Date(createdAt);
  const hours = SLA_HOURS[pagePriority] || 4;
  return new Date(created.getTime() + hours * 60 * 60 * 1000).toISOString();
}

/**
 * GET /api/escalations
 * 에스컬레이션 목록 조회 (조인 포함)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceClient();
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const limit = parseInt(searchParams.get("limit") || "50");

    // Query escalations with conversation -> customer (with channel info), tenant joins
    let query = (supabase as any)
      .from("escalations")
      .select(`
        *,
        conversation:conversations(
          id, status, priority, last_message_at, last_message_preview, tenant_id,
          customer:customers(
            id, name, country, language, profile_image_url, tags,
            customer_channels(
              id,
              channel_account:channel_accounts(id, channel_type, account_name, tenant_id)
            )
          ),
          tenant:tenants(*)
        )
      `)
      .order("created_at", { ascending: false })
      .limit(limit);

    // Apply filters (map page values to DB values for querying)
    if (status && status !== "all") {
      const dbStatus = mapStatusToDB(status);
      if (status === "open") {
        // "open" maps to both "pending" and "assigned" in DB
        query = query.in("status", ["pending", "assigned"]);
      } else {
        query = query.eq("status", dbStatus);
      }
    }
    if (priority && priority !== "all") {
      const dbPriority = mapPriorityToDB(priority);
      query = query.eq("priority", dbPriority);
    }

    const { data: escalations, error } = await query;

    if (error) {
      console.error("Escalations fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Collect message IDs from escalations (the actual messages that triggered escalation)
    const messageIds = (escalations || [])
      .map((e: any) => e.message_id)
      .filter(Boolean);

    // Fetch the actual escalation trigger messages
    interface EscalationMessage {
      original: string;          // Customer's native language
      korean: string;           // Korean translation
      originalLanguage: string; // Language code
    }
    let escalationMessagesMap: Record<string, EscalationMessage> = {};
    let lastMessagesMap: Record<string, string> = {};

    if (messageIds.length > 0) {
      // Get the actual messages that triggered each escalation
      const { data: messages } = await (supabase as any)
        .from("messages")
        .select("id, content, translated_content, original_language, direction, sender_type")
        .in("id", messageIds);

      if (messages) {
        for (const msg of messages) {
          // Determine original (customer language) and Korean translation
          const originalLang = msg.original_language || "ko";

          // For inbound messages:
          // - content = customer's native language (original)
          // - translated_content = Korean translation
          const customerNativeText = msg.content || "";
          const koreanText = originalLang === "ko"
            ? customerNativeText
            : (msg.translated_content || customerNativeText);

          escalationMessagesMap[msg.id] = {
            original: customerNativeText,
            korean: koreanText,
            originalLanguage: originalLang,
          };
        }
      }
    }

    // Collect conversation IDs for last message fallback
    const conversationIds = (escalations || [])
      .map((e: any) => e.conversation?.id)
      .filter(Boolean);

    if (conversationIds.length > 0) {
      // Get last customer message for each conversation (fallback)
      const { data: convMessages } = await (supabase as any)
        .from("messages")
        .select("conversation_id, content, created_at")
        .in("conversation_id", conversationIds)
        .eq("direction", "inbound")
        .neq("sender_type", "internal_note")
        .neq("sender_type", "system")
        .neq("sender_type", "agent")
        .neq("sender_type", "ai")
        .order("created_at", { ascending: false });

      if (convMessages) {
        for (const msg of convMessages) {
          if (!lastMessagesMap[msg.conversation_id]) {
            lastMessagesMap[msg.conversation_id] = msg.content || "";
          }
        }
      }
    }

    // Collect assigned_to user IDs to fetch user details
    const assignedUserIds = (escalations || [])
      .map((e: any) => e.assigned_to)
      .filter(Boolean);

    let usersMap: Record<string, any> = {};
    if (assignedUserIds.length > 0) {
      const { data: users } = await (supabase as any)
        .from("users")
        .select("id, name, email, avatar_url, role, is_active")
        .in("id", assignedUserIds);

      if (users) {
        for (const user of users) {
          usersMap[user.id] = user;
        }
      }
    }

    // Map to frontend Escalation type
    const mapped = (escalations || []).map((esc: any) => {
      const conv = esc.conversation;
      const customer = conv?.customer;
      const tenant = conv?.tenant;
      const channelAccount = customer?.customer_channels?.[0]?.channel_account;
      const pagePriority = mapPriorityFromDB(esc.priority);
      const pageStatus = mapStatusFromDB(esc.status);

      // Build assignedTo from users table
      let assignedTo: any = null;
      if (esc.assigned_to && usersMap[esc.assigned_to]) {
        const user = usersMap[esc.assigned_to];
        assignedTo = {
          id: user.id,
          name: user.name || user.email,
          avatar: user.avatar_url,
          role: user.role === "admin" ? "CS 매니저" : user.role === "manager" ? "시니어 상담사" : "상담사",
          activeEscalations: 0,
          status: "online" as const,
        };
      }

      // Determine last message: from messages query, fallback to conversation preview, fallback to reason
      const lastMessage =
        (conv?.id ? lastMessagesMap[conv.id] : null) ||
        conv?.last_message_preview ||
        esc.reason ||
        "";

      // Get customer's actual question from the escalation trigger message
      const escalationMsg = esc.message_id ? escalationMessagesMap[esc.message_id] : null;
      const customerQuestion = escalationMsg
        ? (escalationMsg.originalLanguage !== "ko" && escalationMsg.original !== escalationMsg.korean
            ? `${escalationMsg.original}\n\n[한국어] ${escalationMsg.korean}`
            : escalationMsg.original)
        : lastMessage;

      // Extract AI recommendations from metadata
      const metadata = esc.metadata || {};
      const recommendedAction = metadata.recommended_action as "knowledge_base" | "tenant_info" | undefined;
      const missingInfo = metadata.missing_info as string[] | undefined;
      const detectedQuestions = metadata.detected_questions as string[] | undefined;

      return {
        id: esc.id,
        conversationId: conv?.id || esc.conversation_id,
        customer: {
          name: customer?.name || "알 수 없는 고객",
          country: customer?.country || "",
          avatar: customer?.profile_image_url || null,
          email: customer?.email || undefined,
          phone: customer?.phone || undefined,
        },
        tenant: {
          id: conv?.tenant_id || tenant?.id,
          name: tenant?.display_name || tenant?.name || "알 수 없는 거래처",
        },
        channel: channelAccount?.channel_type || "line",
        priority: pagePriority,
        status: pageStatus,
        reason: esc.reason || "",
        aiConfidence: esc.ai_confidence ?? 0,
        lastMessage,
        createdAt: esc.created_at,
        assignedTo,
        resolvedAt: esc.resolved_at || undefined,
        slaDeadline: computeSLADeadline(esc.created_at, pagePriority),
        // NEW: Customer's actual question (original language + Korean)
        customerQuestion,
        aiReasoning: esc.reason || "충분한 정보가 없습니다",
        // AI recommendations from metadata
        recommendedAction,
        missingInfo,
        detectedQuestions, // Example questions for update dialogs
      };
    });

    // Fetch team members (active users) for the assign dialog
    const { data: allUsers } = await (supabase as any)
      .from("users")
      .select("id, name, email, avatar_url, role, is_active")
      .eq("is_active", true)
      .order("name", { ascending: true });

    // Count active escalations per user
    const activeEscCounts: Record<string, number> = {};
    if (allUsers && allUsers.length > 0) {
      const userIds = allUsers.map((u: any) => u.id);
      const { data: activeEscs } = await (supabase as any)
        .from("escalations")
        .select("assigned_to")
        .in("assigned_to", userIds)
        .in("status", ["pending", "assigned", "in_progress"]);

      if (activeEscs) {
        for (const e of activeEscs) {
          if (e.assigned_to) {
            activeEscCounts[e.assigned_to] = (activeEscCounts[e.assigned_to] || 0) + 1;
          }
        }
      }
    }

    const teamMembers = (allUsers || []).map((user: any) => ({
      id: user.id,
      name: user.name || user.email,
      avatar: user.avatar_url || null,
      role: user.role === "admin" ? "CS 매니저" : user.role === "manager" ? "시니어 상담사" : "상담사",
      activeEscalations: activeEscCounts[user.id] || 0,
      status: "online" as const,
    }));

    return NextResponse.json({
      escalations: mapped,
      teamMembers,
    });
  } catch (error) {
    console.error("GET /api/escalations error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/escalations
 * 에스컬레이션 상태/담당자 업데이트
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServiceClient();
    const body = await request.json();
    const { id, status, assigned_to, resolution_notes, priority } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};

    // Map page values to DB values
    if (status) {
      updateData.status = mapStatusToDB(status);
    }
    if (assigned_to !== undefined) {
      updateData.assigned_to = assigned_to;
      // If assigning, also set status to "assigned" if currently "pending"
      if (assigned_to && !status) {
        // Fetch current status
        const { data: current } = await (supabase as any)
          .from("escalations")
          .select("status")
          .eq("id", id)
          .single();
        if (current?.status === "pending") {
          updateData.status = "assigned";
        }
      }
    }
    if (resolution_notes !== undefined) {
      updateData.resolution_note = resolution_notes;
    }
    if (priority) {
      updateData.priority = mapPriorityToDB(priority);
    }
    if (status === "resolved") {
      updateData.resolved_at = new Date().toISOString();
    }
    if (status === "open") {
      updateData.resolved_at = null;
      updateData.status = "pending";
    }

    const { data, error } = await (supabase as any)
      .from("escalations")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Escalation update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ escalation: data });
  } catch (error) {
    console.error("PATCH /api/escalations error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
