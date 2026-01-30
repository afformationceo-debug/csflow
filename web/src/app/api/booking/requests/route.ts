import { NextRequest, NextResponse } from "next/server";
import {
  getPendingBookingRequests,
  createBookingRequest,
} from "@/services/booking/booking-request";
import { notifyHumanForBookingRequest } from "@/services/booking/human-notification";

/**
 * GET /api/booking/requests
 * 대기 중인 예약 신청 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get("tenantId") || undefined;

    const requests = await getPendingBookingRequests(tenantId);

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("[Booking API] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch booking requests" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/booking/requests
 * 예약 신청 생성 (+ 자동 휴먼 알림)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tenantId,
      customerId,
      conversationId,
      requestedDate,
      requestedTime,
      treatmentType,
      specialRequests,
      metadata,
    } = body;

    if (!tenantId || !customerId || !conversationId || !requestedDate) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create booking request
    const bookingRequest = await createBookingRequest({
      tenantId,
      customerId,
      conversationId,
      requestedDate,
      requestedTime,
      treatmentType,
      specialRequests,
      metadata,
    });

    // Send human notifications
    const notifications = await notifyHumanForBookingRequest(bookingRequest.id);

    return NextResponse.json({
      bookingRequest,
      notifications,
    });
  } catch (error) {
    console.error("[Booking API] POST error:", error);
    return NextResponse.json(
      { error: "Failed to create booking request" },
      { status: 500 }
    );
  }
}
