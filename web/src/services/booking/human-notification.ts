/**
 * Human Notification Service
 *
 * 예약 신청 시 휴먼(병원 담당자)에게 카카오톡/슬랙 알림 전송
 */

import { createServiceClient } from "@/lib/supabase/server";

export interface BookingNotificationData {
  bookingRequestId: string;
  tenantName: string;
  customerName: string;
  customerLanguage: string;
  customerCountry?: string;
  requestedDate: string;
  requestedTime?: string;
  treatmentType?: string;
  specialRequests?: string;
  waitingMinutes?: number;
}

/**
 * Send Slack notification for booking request
 */
export async function sendSlackNotification(
  data: BookingNotificationData,
  slackWebhookUrl: string
): Promise<{ success: boolean; notificationId: string }> {
  try {
    const supabase = await createServiceClient();

    // Prepare Slack message
    const message = {
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🔔 새로운 예약 신청",
            emoji: true,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*병원:*\n${data.tenantName}`,
            },
            {
              type: "mrkdwn",
              text: `*고객:*\n${data.customerName} (${data.customerLanguage})`,
            },
          ],
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*희망 날짜:*\n${data.requestedDate}`,
            },
            {
              type: "mrkdwn",
              text: `*희망 시간:*\n${data.requestedTime || "미정"}`,
            },
          ],
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*시술:*\n${data.treatmentType || "미정"}`,
            },
            {
              type: "mrkdwn",
              text: `*대기 시간:*\n${data.waitingMinutes ? Math.round(data.waitingMinutes) + "분" : "방금"}`,
            },
          ],
        },
      ],
    };

    if (data.specialRequests) {
      message.blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*특별 요청:*\n${data.specialRequests}`,
        },
      } as any);
    }

    message.blocks.push({
      type: "divider",
    } as any);

    message.blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "예약 가능 여부를 확인하고 아래 버튼으로 응답해주세요:",
      },
    } as any);

    message.blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "✅ 예약 가능",
            emoji: true,
          },
          style: "primary",
          value: `approve:${data.bookingRequestId}`,
          action_id: "booking_approve",
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "🔄 날짜 조율",
            emoji: true,
          },
          value: `reschedule:${data.bookingRequestId}`,
          action_id: "booking_reschedule",
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "❌ 불가능",
            emoji: true,
          },
          style: "danger",
          value: `reject:${data.bookingRequestId}`,
          action_id: "booking_reject",
        },
      ],
    } as any);

    // Send to Slack
    const response = await fetch(slackWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.statusText}`);
    }

    // Log notification
    const { data: notification } = await (supabase as any)
      .from("human_notifications")
      .insert({
        booking_request_id: data.bookingRequestId,
        notification_type: "slack",
        recipient: slackWebhookUrl,
        message_content: JSON.stringify(message),
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    return {
      success: true,
      notificationId: notification?.id || "",
    };
  } catch (error) {
    console.error("[Slack Notification] Error:", error);

    // Log failed notification
    try {
      const supabase = await createServiceClient();
      await (supabase as any).from("human_notifications").insert({
        booking_request_id: data.bookingRequestId,
        notification_type: "slack",
        recipient: slackWebhookUrl,
        status: "failed",
        metadata: { error: String(error) },
      });
    } catch (logError) {
      console.error("[Slack Notification] Log error:", logError);
    }

    throw error;
  }
}

/**
 * Send Kakao Alimtalk notification for booking request
 */
export async function sendKakaoAlimtalk(
  data: BookingNotificationData,
  recipientPhone: string,
  templateCode: string
): Promise<{ success: boolean; notificationId: string }> {
  try {
    const supabase = await createServiceClient();

    // Kakao Alimtalk API 호출
    // Note: 실제 환경에서는 카카오 비즈니스 계정 및 승인된 템플릿 필요
    const kakaoApiUrl = process.env.KAKAO_ALIMTALK_API_URL || "https://alimtalk-api.kakao.com/v2/send";
    const kakaoApiKey = process.env.KAKAO_ALIMTALK_API_KEY;

    if (!kakaoApiKey) {
      console.warn("[Kakao Alimtalk] API key not configured, skipping");
      return { success: false, notificationId: "" };
    }

    const message = {
      receiver: recipientPhone,
      template_code: templateCode,
      variables: {
        hospital_name: data.tenantName,
        customer_name: data.customerName,
        requested_date: data.requestedDate,
        requested_time: data.requestedTime || "미정",
        treatment: data.treatmentType || "미정",
        language: data.customerLanguage,
        special_requests: data.specialRequests || "없음",
      },
    };

    const response = await fetch(kakaoApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${kakaoApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`Kakao Alimtalk API error: ${response.statusText}`);
    }

    const result = await response.json();

    // Log notification
    const { data: notification } = await (supabase as any)
      .from("human_notifications")
      .insert({
        booking_request_id: data.bookingRequestId,
        notification_type: "kakao_alimtalk",
        recipient: recipientPhone,
        template_code: templateCode,
        message_content: JSON.stringify(message.variables),
        status: "sent",
        sent_at: new Date().toISOString(),
        metadata: result,
      })
      .select("id")
      .single();

    return {
      success: true,
      notificationId: notification?.id || "",
    };
  } catch (error) {
    console.error("[Kakao Alimtalk] Error:", error);

    // Log failed notification
    try {
      const supabase = await createServiceClient();
      await (supabase as any).from("human_notifications").insert({
        booking_request_id: data.bookingRequestId,
        notification_type: "kakao_alimtalk",
        recipient: recipientPhone,
        template_code: templateCode,
        status: "failed",
        metadata: { error: String(error) },
      });
    } catch (logError) {
      console.error("[Kakao Alimtalk] Log error:", logError);
    }

    throw error;
  }
}

/**
 * Send notifications to all configured channels
 */
export async function notifyHumanForBookingRequest(
  bookingRequestId: string
): Promise<{ success: boolean; notifications: string[] }> {
  try {
    const supabase = await createServiceClient();

    // Get booking request details
    const { data: bookingRequest } = (await supabase
      .from("booking_requests")
      .select(
        `
        *,
        tenant:tenants(name, name_en, metadata),
        customer:customers(name, language, country, metadata)
      `
      )
      .eq("id", bookingRequestId)
      .single()) as { data: any; error: any };

    if (!bookingRequest) {
      throw new Error("Booking request not found");
    }

    // Get channel account to check automation config
    const { data: conversation } = (await supabase
      .from("conversations")
      .select("channel_account_id")
      .eq("id", bookingRequest.conversation_id)
      .single()) as { data: any; error: any };

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const { data: channelAccount } = (await supabase
      .from("channel_accounts")
      .select("automation_config")
      .eq("id", conversation.channel_account_id)
      .single()) as { data: any; error: any };

    const automationConfig = channelAccount?.automation_config as {
      notification_channels?: string[];
    } | null;
    const notificationChannels = automationConfig?.notification_channels || ["slack"];

    const notificationData: BookingNotificationData = {
      bookingRequestId,
      tenantName: (bookingRequest.tenant as any).name,
      customerName: (bookingRequest.customer as any).name,
      customerLanguage: (bookingRequest.customer as any).language || "ko",
      customerCountry: (bookingRequest.customer as any).country,
      requestedDate: bookingRequest.requested_date,
      requestedTime: bookingRequest.requested_time,
      treatmentType: bookingRequest.treatment_type,
      specialRequests: bookingRequest.special_requests,
    };

    const sentNotifications: string[] = [];

    // Send to Slack
    if (notificationChannels.includes("slack")) {
      const slackWebhook =
        process.env.SLACK_BOOKING_WEBHOOK_URL ||
        ((bookingRequest.tenant as any).metadata?.slack_webhook_url as string);

      if (slackWebhook) {
        try {
          const result = await sendSlackNotification(notificationData, slackWebhook);
          sentNotifications.push(`slack:${result.notificationId}`);
        } catch (error) {
          console.error("[Notification] Slack failed:", error);
        }
      }
    }

    // Send to Kakao Alimtalk
    if (notificationChannels.includes("kakao_alimtalk")) {
      const managerPhone = ((bookingRequest.tenant as any).metadata?.manager_phone as string);
      const templateCode = "BOOKING_REQUEST_001"; // Must be approved in Kakao Business

      if (managerPhone) {
        try {
          const result = await sendKakaoAlimtalk(
            notificationData,
            managerPhone,
            templateCode
          );
          sentNotifications.push(`kakao:${result.notificationId}`);
        } catch (error) {
          console.error("[Notification] Kakao failed:", error);
        }
      }
    }

    return {
      success: sentNotifications.length > 0,
      notifications: sentNotifications,
    };
  } catch (error) {
    console.error("[Notification] Error:", error);
    return {
      success: false,
      notifications: [],
    };
  }
}

/**
 * Record human response to notification
 */
export async function recordHumanResponse(
  notificationId: string,
  responseAction: "approved" | "needs_rescheduling" | "rejected"
): Promise<void> {
  try {
    const supabase = await createServiceClient();

    await (supabase as any)
      .from("human_notifications")
      .update({
        status: "responded",
        response_action: responseAction,
        responded_at: new Date().toISOString(),
      })
      .eq("id", notificationId);
  } catch (error) {
    console.error("[Notification] Record response error:", error);
    throw error;
  }
}
