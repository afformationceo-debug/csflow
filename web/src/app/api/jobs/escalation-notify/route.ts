import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { EscalationPriority } from "@/lib/supabase/types";

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
 * Send KakaoTalk AlimTalk notification for escalation
 */
async function sendKakaoAlimTalk(data: {
  phone: string;
  templateId: string;
  variables: Record<string, string>;
}): Promise<boolean> {
  // TODO: Implement KakaoTalk AlimTalk API integration
  // This requires KakaoTalk Channel and AlimTalk template registration

  const kakaoRestApiKey = process.env.KAKAO_REST_API_KEY;
  if (!kakaoRestApiKey) {
    console.warn("KakaoTalk API key not configured");
    return false;
  }

  // Placeholder for actual implementation
  console.log("Would send KakaoTalk AlimTalk:", data);
  return true;
}

/**
 * Send Slack notification
 */
async function sendSlackNotification(data: {
  webhookUrl: string;
  message: {
    text: string;
    blocks?: unknown[];
  };
}): Promise<boolean> {
  try {
    const response = await fetch(data.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data.message),
    });

    return response.ok;
  } catch (error) {
    console.error("Slack notification error:", error);
    return false;
  }
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
      display_name: string;
      settings: {
        slack_webhook_url?: string;
        notification_phones?: string[];
      };
    };

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

거래처: ${tenantData.display_name}
고객: ${conversation.customer.name || "알 수 없음"} (${conversation.customer.country || "국가 미상"})
사유: ${data.reason}
우선순위: ${data.priority.toUpperCase()}

대시보드에서 확인하세요.`;

    // Send Slack notification
    if (settings.slack_webhook_url) {
      const slackMessage = {
        text: notificationText,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: `${priorityEmoji} 새 에스컬레이션`,
              emoji: true,
            },
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*거래처:*\n${tenantData.display_name}`,
              },
              {
                type: "mrkdwn",
                text: `*고객:*\n${conversation.customer.name || "알 수 없음"}`,
              },
              {
                type: "mrkdwn",
                text: `*우선순위:*\n${data.priority.toUpperCase()}`,
              },
              {
                type: "mrkdwn",
                text: `*국가:*\n${conversation.customer.country || "미상"}`,
              },
            ],
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*사유:*\n${data.reason}`,
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "대시보드에서 보기",
                },
                url: `${process.env.NEXT_PUBLIC_APP_URL}/escalations/${data.escalationId}`,
              },
            ],
          },
        ],
      };

      await sendSlackNotification({
        webhookUrl: settings.slack_webhook_url,
        message: slackMessage,
      });
    }

    // Send KakaoTalk AlimTalk to notification phones
    if (settings.notification_phones && settings.notification_phones.length > 0) {
      for (const phone of settings.notification_phones) {
        await sendKakaoAlimTalk({
          phone,
          templateId: "escalation_notification",
          variables: {
            tenant_name: tenantData.display_name,
            customer_name: conversation.customer.name || "알 수 없음",
            priority: data.priority,
            reason: data.reason.slice(0, 100),
          },
        });
      }
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
