/**
 * Slack Notification Service
 * Slack Web API (chat.postMessage)를 사용하여 알림 전송
 * 카카오톡 알림톡 대체용
 */

export interface SlackMessageBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  fields?: { type: string; text: string }[];
  elements?: unknown[];
  accessory?: unknown;
}

export interface SlackNotificationPayload {
  channel: string;
  text: string;
  blocks?: SlackMessageBlock[];
}

export interface EscalationNotificationData {
  escalationId: string;
  tenantName: string;
  customerName: string;
  customerCountry: string;
  priority: "low" | "medium" | "high" | "urgent";
  reason: string;
}

export interface BookingNotificationData {
  customerName: string;
  tenantName: string;
  bookingDate: string;
  bookingTime: string;
  procedure: string;
}

export interface NoResponseNotificationData {
  customerName: string;
  tenantName: string;
  channelType: string;
  lastMessageAt: string;
  hoursElapsed: number;
}

const PRIORITY_EMOJI: Record<string, string> = {
  low: "🟢",
  medium: "🟡",
  high: "🟠",
  urgent: "🔴",
};

/**
 * Slack Web API를 통한 메시지 전송
 */
async function sendSlackMessage(
  payload: SlackNotificationPayload
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.SLACK_BOT_TOKEN;

  if (!token) {
    console.warn("SLACK_BOT_TOKEN is not configured");
    return { ok: false, error: "Token not configured" };
  }

  try {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!result.ok) {
      console.error("Slack API error:", result.error);
      return { ok: false, error: result.error };
    }

    return { ok: true };
  } catch (error) {
    console.error("Slack notification error:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Slack Webhook을 통한 메시지 전송 (기존 호환)
 */
async function sendSlackWebhook(
  webhookUrl: string,
  message: { text: string; blocks?: unknown[] }
): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });
    return response.ok;
  } catch (error) {
    console.error("Slack webhook error:", error);
    return false;
  }
}

export const slackNotificationService = {
  /**
   * 에스컬레이션 발생 알림
   */
  async sendEscalationNotification(
    data: EscalationNotificationData,
    channel?: string
  ): Promise<boolean> {
    const targetChannel = channel || process.env.SLACK_DEFAULT_CHANNEL || "#cs-escalations";
    const emoji = PRIORITY_EMOJI[data.priority] || "🟡";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const result = await sendSlackMessage({
      channel: targetChannel,
      text: `${emoji} 새 에스컬레이션 - ${data.tenantName} / ${data.customerName}`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `${emoji} 새 에스컬레이션 발생`,
            emoji: true,
          },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*거래처:*\n${data.tenantName}` },
            { type: "mrkdwn", text: `*고객:*\n${data.customerName}` },
            { type: "mrkdwn", text: `*우선순위:*\n${data.priority.toUpperCase()}` },
            { type: "mrkdwn", text: `*국가:*\n${data.customerCountry}` },
          ],
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: `*사유:*\n${data.reason}` },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "대시보드에서 보기", emoji: true },
              url: `${appUrl}/escalations/${data.escalationId}`,
              style: "primary",
            },
          ],
        },
      ],
    });

    return result.ok;
  },

  /**
   * 예약 확정 알림
   */
  async sendBookingNotification(
    data: BookingNotificationData,
    channel?: string
  ): Promise<boolean> {
    const targetChannel = channel || process.env.SLACK_DEFAULT_CHANNEL || "#cs-bookings";

    const result = await sendSlackMessage({
      channel: targetChannel,
      text: `📅 예약 확정 - ${data.customerName} / ${data.tenantName}`,
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: "📅 새 예약 확정", emoji: true },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*고객:*\n${data.customerName}` },
            { type: "mrkdwn", text: `*거래처:*\n${data.tenantName}` },
            { type: "mrkdwn", text: `*날짜:*\n${data.bookingDate}` },
            { type: "mrkdwn", text: `*시간:*\n${data.bookingTime}` },
          ],
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: `*시술:*\n${data.procedure}` },
        },
      ],
    });

    return result.ok;
  },

  /**
   * 24시간 무응답 알림
   */
  async sendNoResponseAlert(
    data: NoResponseNotificationData,
    channel?: string
  ): Promise<boolean> {
    const targetChannel = channel || process.env.SLACK_DEFAULT_CHANNEL || "#cs-alerts";

    const result = await sendSlackMessage({
      channel: targetChannel,
      text: `⏰ 무응답 경고 - ${data.customerName} (${data.hoursElapsed}시간)`,
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: "⏰ 무응답 경고", emoji: true },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*고객:*\n${data.customerName}` },
            { type: "mrkdwn", text: `*거래처:*\n${data.tenantName}` },
            { type: "mrkdwn", text: `*채널:*\n${data.channelType}` },
            { type: "mrkdwn", text: `*경과:*\n${data.hoursElapsed}시간` },
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*마지막 메시지:*\n${data.lastMessageAt}`,
          },
        },
      ],
    });

    return result.ok;
  },

  /**
   * 일반 텍스트 알림
   */
  async sendTextNotification(
    text: string,
    channel?: string
  ): Promise<boolean> {
    const targetChannel = channel || process.env.SLACK_DEFAULT_CHANNEL || "#cs-general";

    const result = await sendSlackMessage({
      channel: targetChannel,
      text,
    });

    return result.ok;
  },

  /**
   * 기존 Webhook 방식 호환 (tenant settings에 webhook URL이 있는 경우)
   */
  async sendViaWebhook(
    webhookUrl: string,
    message: { text: string; blocks?: unknown[] }
  ): Promise<boolean> {
    return sendSlackWebhook(webhookUrl, message);
  },
};
