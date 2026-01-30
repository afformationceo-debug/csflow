import { NextRequest, NextResponse } from "next/server";
import {
  approveBookingRequest,
  getBookingRequest,
} from "@/services/booking/booking-request";
import { serverMessageService } from "@/services/messages";
import { translationService } from "@/services/translation";

/**
 * PATCH /api/booking/requests/[id]/approve
 * 휴먼 승인 처리 (예약 가능/조율 필요)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookingRequestId } = await params;
    const body = await request.json();
    const { confirmedDate, alternativeDates, humanResponse, action } = body;

    // Action: "approve" | "reschedule" | "reject"
    if (!action) {
      return NextResponse.json(
        { error: "Missing action parameter" },
        { status: 400 }
      );
    }

    // Get booking request details
    const bookingRequest = await getBookingRequest(bookingRequestId);

    if (!bookingRequest) {
      return NextResponse.json(
        { error: "Booking request not found" },
        { status: 404 }
      );
    }

    // Approve or reschedule
    if (action === "approve" || action === "reschedule") {
      const result = await approveBookingRequest(bookingRequestId, {
        confirmedDate: action === "approve" ? confirmedDate : undefined,
        alternativeDates: action === "reschedule" ? alternativeDates : undefined,
        humanResponse,
      });

      // Send confirmation message to customer
      if (bookingRequest.conversationId) {
        await sendConfirmationToCustomer(
          bookingRequest.conversationId,
          bookingRequest.customerId,
          action,
          {
            confirmedDate,
            alternativeDates,
            humanResponse,
          }
        );
      }

      return NextResponse.json({
        result,
        message:
          action === "approve"
            ? "Booking approved successfully"
            : "Rescheduling notification sent",
      });
    }

    // Reject
    if (action === "reject") {
      const { rejectBookingRequest } = await import(
        "@/services/booking/booking-request"
      );
      await rejectBookingRequest(bookingRequestId, humanResponse || "예약 불가");

      // Send rejection message to customer
      if (bookingRequest.conversationId) {
        await sendRejectionToCustomer(
          bookingRequest.conversationId,
          bookingRequest.customerId,
          humanResponse
        );
      }

      return NextResponse.json({
        message: "Booking rejected",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[Booking Approve API] Error:", error);
    return NextResponse.json(
      { error: "Failed to process approval" },
      { status: 500 }
    );
  }
}

/**
 * 고객에게 예약 확정 메시지 전송
 */
async function sendConfirmationToCustomer(
  conversationId: string,
  customerId: string,
  action: "approve" | "reschedule",
  data: {
    confirmedDate?: string;
    alternativeDates?: string[];
    humanResponse?: string;
  }
) {
  try {
    // Get customer language
    const { createServiceClient } = await import("@/lib/supabase/server");
    const supabase = await createServiceClient();

    const { data: customer } = await supabase
      .from("customers")
      .select("language")
      .eq("id", customerId)
      .single();

    const language = customer?.language || "ko";

    let messageKo = "";

    if (action === "approve") {
      messageKo = `✅ 예약이 확정되었습니다!

📅 확정 날짜: ${data.confirmedDate ? new Date(data.confirmedDate).toLocaleDateString("ko-KR") : ""}
${data.humanResponse ? `\n📝 ${data.humanResponse}` : ""}

예약 시간에 맞춰 방문해주시기 바랍니다.
감사합니다! 🙏`;
    } else {
      // reschedule
      const altDates = data.alternativeDates?.join(", ") || "";
      messageKo = `🔄 예약 날짜 조율이 필요합니다.

대안 날짜: ${altDates}
${data.humanResponse ? `\n📝 ${data.humanResponse}` : ""}

위 날짜 중 가능한 시간을 알려주시겠어요?`;
    }

    // Translate if needed
    let message = messageKo;
    if (language !== "ko") {
      const translated = await translationService.translate(
        messageKo,
        language.toUpperCase() as any,
        "KO"
      );
      message = translated.text;
    }

    // Send message
    await serverMessageService.create({
      conversationId,
      direction: "outbound",
      senderType: "agent",
      contentType: "text",
      content: message,
      originalContent: messageKo,
      originalLanguage: "ko",
      translatedContent: language !== "ko" ? message : undefined,
    });
  } catch (error) {
    console.error("[Confirmation Message] Error:", error);
  }
}

/**
 * 고객에게 예약 거절 메시지 전송
 */
async function sendRejectionToCustomer(
  conversationId: string,
  customerId: string,
  reason?: string
) {
  try {
    // Get customer language
    const { createServiceClient } = await import("@/lib/supabase/server");
    const supabase = await createServiceClient();

    const { data: customer } = await supabase
      .from("customers")
      .select("language")
      .eq("id", customerId)
      .single();

    const language = customer?.language || "ko";

    let messageKo = `죄송합니다. 요청하신 날짜에 예약이 어렵습니다.

${reason ? `📝 ${reason}\n\n` : ""}다른 날짜를 제안해주시면 다시 확인해드리겠습니다.`;

    // Translate if needed
    let message = messageKo;
    if (language !== "ko") {
      const translated = await translationService.translate(
        messageKo,
        language.toUpperCase() as any,
        "KO"
      );
      message = translated.text;
    }

    // Send message
    await serverMessageService.create({
      conversationId,
      direction: "outbound",
      senderType: "agent",
      contentType: "text",
      content: message,
      originalContent: messageKo,
      originalLanguage: "ko",
      translatedContent: language !== "ko" ? message : undefined,
    });
  } catch (error) {
    console.error("[Rejection Message] Error:", error);
  }
}
