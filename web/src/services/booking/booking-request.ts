/**
 * Booking Request Service
 *
 * 예약 신청 로그(1차) 생성 및 관리
 * Human-in-the-Loop 풀자동화 시스템
 */

import { createServiceClient } from "@/lib/supabase/server";

export interface BookingRequestData {
  tenantId: string;
  customerId: string;
  conversationId: string;
  requestedDate: string;
  requestedTime?: string;
  treatmentType?: string;
  specialRequests?: string;
  metadata?: Record<string, unknown>;
}

export interface BookingRequestResponse {
  id: string;
  status: string;
  createdAt: string;
  waitingMinutes?: number;
}

/**
 * 예약 신청 생성 (1차 로그)
 * AI가 고객의 예약 의도를 감지한 후 호출
 */
export async function createBookingRequest(
  data: BookingRequestData
): Promise<BookingRequestResponse> {
  try {
    const supabase = await createServiceClient();

    // Database function 호출
    const { data: result, error } = await (supabase as any).rpc("create_booking_request", {
      p_tenant_id: data.tenantId,
      p_customer_id: data.customerId,
      p_conversation_id: data.conversationId,
      p_requested_date: data.requestedDate,
      p_requested_time: data.requestedTime || null,
      p_treatment_type: data.treatmentType || null,
      p_special_requests: data.specialRequests || null,
      p_metadata: data.metadata || {},
    });

    if (error) {
      console.error("[Booking Request] Creation error:", error);
      throw new Error(`Failed to create booking request: ${error.message}`);
    }

    // 생성된 booking_request 조회
    const { data: bookingRequest, error: fetchError } = (await supabase
      .from("booking_requests")
      .select("id, status, created_at")
      .eq("id", result)
      .single()) as {
      data: { id: string; status: string; created_at: string } | null;
      error: any;
    };

    if (fetchError) {
      console.error("[Booking Request] Fetch error:", fetchError);
      throw new Error(`Failed to fetch booking request: ${fetchError.message}`);
    }

    if (!bookingRequest) {
      console.error("[Booking Request] Booking request not found after creation");
      throw new Error("Booking request not found after creation");
    }

    return {
      id: bookingRequest.id,
      status: bookingRequest.status,
      createdAt: bookingRequest.created_at,
    };
  } catch (error) {
    console.error("[Booking Request] Error:", error);
    throw error;
  }
}

/**
 * 예약 신청 목록 조회 (대기 중인 건만)
 */
export async function getPendingBookingRequests(tenantId?: string): Promise<
  Array<{
    id: string;
    tenantName: string;
    customerName: string;
    customerLanguage: string;
    requestedDate: string;
    requestedTime: string | null;
    treatmentType: string | null;
    specialRequests: string | null;
    status: string;
    waitingMinutes: number;
    notificationsSent: number;
    customerChannels: Array<{ channel_type: string; account_name: string }>;
  }>
> {
  try {
    const supabase = await createServiceClient();

    let query = supabase.from("pending_booking_requests").select("*");

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    const { data, error } = await query.order("created_at", { ascending: true });

    if (error) {
      console.error("[Booking Request] Fetch pending error:", error);
      throw new Error(`Failed to fetch pending booking requests: ${error.message}`);
    }

    return (data || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      tenantName: row.tenant_name as string,
      customerName: row.customer_name as string,
      customerLanguage: row.customer_language as string,
      requestedDate: row.requested_date as string,
      requestedTime: row.requested_time as string | null,
      treatmentType: row.treatment_type as string | null,
      specialRequests: row.special_requests as string | null,
      status: row.status as string,
      waitingMinutes: row.waiting_minutes as number,
      notificationsSent: row.notifications_sent as number,
      customerChannels: (row.customer_channels as Array<{ channel_type: string; account_name: string }>) || [],
    }));
  } catch (error) {
    console.error("[Booking Request] Error:", error);
    throw error;
  }
}

/**
 * 예약 신청 상세 조회
 */
export async function getBookingRequest(bookingRequestId: string): Promise<{
  id: string;
  tenantId: string;
  customerId: string;
  conversationId: string | null;
  requestedDate: string;
  requestedTime: string | null;
  treatmentType: string | null;
  specialRequests: string | null;
  status: string;
  humanResponse: string | null;
  alternativeDates: string[] | null;
  rejectionReason: string | null;
  crmBookingId: string | null;
  confirmedDate: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  humanRespondedAt: string | null;
  confirmedAt: string | null;
} | null> {
  try {
    const supabase = await createServiceClient();

    const { data, error } = (await supabase
      .from("booking_requests")
      .select("*")
      .eq("id", bookingRequestId)
      .single()) as { data: any; error: any };

    if (error) {
      if (error.code === "PGRST116") {
        // Not found
        return null;
      }
      console.error("[Booking Request] Fetch detail error:", error);
      throw new Error(`Failed to fetch booking request: ${error.message}`);
    }

    if (!data) {
      console.error("[Booking Request] No data returned for booking request");
      return null;
    }

    return {
      id: data.id,
      tenantId: data.tenant_id,
      customerId: data.customer_id,
      conversationId: data.conversation_id,
      requestedDate: data.requested_date,
      requestedTime: data.requested_time,
      treatmentType: data.treatment_type,
      specialRequests: data.special_requests,
      status: data.status,
      humanResponse: data.human_response,
      alternativeDates: data.alternative_dates,
      rejectionReason: data.rejection_reason,
      crmBookingId: data.crm_booking_id,
      confirmedDate: data.confirmed_date,
      metadata: data.metadata || {},
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      humanRespondedAt: data.human_responded_at,
      confirmedAt: data.confirmed_at,
    };
  } catch (error) {
    console.error("[Booking Request] Error:", error);
    throw error;
  }
}

/**
 * 휴먼 승인 처리
 */
export async function approveBookingRequest(
  bookingRequestId: string,
  approval: {
    confirmedDate?: string; // ISO timestamp
    alternativeDates?: string[];
    humanResponse?: string;
  }
): Promise<{
  id: string;
  status: string;
  customerId: string;
  conversationId: string | null;
  confirmedDate: string | null;
}> {
  try {
    const supabase = await createServiceClient();

    const { data: result, error } = await (supabase as any).rpc("approve_booking_request", {
      p_booking_request_id: bookingRequestId,
      p_confirmed_date: approval.confirmedDate || null,
      p_alternative_dates: approval.alternativeDates || null,
      p_human_response: approval.humanResponse || null,
    });

    if (error) {
      console.error("[Booking Request] Approval error:", error);
      throw new Error(`Failed to approve booking request: ${error.message}`);
    }

    return result as {
      id: string;
      status: string;
      customerId: string;
      conversationId: string | null;
      confirmedDate: string | null;
    };
  } catch (error) {
    console.error("[Booking Request] Error:", error);
    throw error;
  }
}

/**
 * CRM 예약 등록 완료 처리
 */
export async function confirmBookingToCRM(
  bookingRequestId: string,
  crmBookingId: string
): Promise<boolean> {
  try {
    const supabase = await createServiceClient();

    const { data: result, error } = await (supabase as any).rpc("confirm_booking_to_crm", {
      p_booking_request_id: bookingRequestId,
      p_crm_booking_id: crmBookingId,
    });

    if (error) {
      console.error("[Booking Request] CRM confirmation error:", error);
      throw new Error(`Failed to confirm booking to CRM: ${error.message}`);
    }

    return result === true;
  } catch (error) {
    console.error("[Booking Request] Error:", error);
    throw error;
  }
}

/**
 * 예약 신청 거절
 */
export async function rejectBookingRequest(
  bookingRequestId: string,
  reason: string
): Promise<void> {
  try {
    const supabase = await createServiceClient();

    const { error } = await (supabase as any)
      .from("booking_requests")
      .update({
        status: "rejected",
        rejection_reason: reason,
        human_responded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookingRequestId);

    if (error) {
      console.error("[Booking Request] Rejection error:", error);
      throw new Error(`Failed to reject booking request: ${error.message}`);
    }
  } catch (error) {
    console.error("[Booking Request] Error:", error);
    throw error;
  }
}

/**
 * 채널의 풀자동화 모드 확인
 */
export async function isFullAutomationEnabled(channelAccountId: string): Promise<boolean> {
  try {
    const supabase = await createServiceClient();

    const { data, error } = (await supabase
      .from("channel_accounts")
      .select("full_automation_enabled")
      .eq("id", channelAccountId)
      .single()) as { data: { full_automation_enabled: boolean } | null; error: any };

    if (error) {
      console.error("[Booking Request] Channel check error:", error);
      return false;
    }

    if (!data) {
      return false;
    }

    return data.full_automation_enabled === true;
  } catch (error) {
    console.error("[Booking Request] Error:", error);
    return false;
  }
}

/**
 * 채널의 풀자동화 설정 조회
 */
export async function getAutomationConfig(channelAccountId: string): Promise<{
  bookingPromptIntensity: "low" | "medium" | "high";
  notificationChannels: string[];
  autoCrmSync: boolean;
  requireHumanApproval: boolean;
  businessHours: {
    timezone: string;
    weekdays: string[];
    hours: string;
  };
} | null> {
  try {
    const supabase = await createServiceClient();

    const { data, error } = (await supabase
      .from("channel_accounts")
      .select("automation_config")
      .eq("id", channelAccountId)
      .single()) as { data: { automation_config: any } | null; error: any };

    if (error) {
      console.error("[Booking Request] Config fetch error:", error);
      return null;
    }

    if (!data) {
      return null;
    }

    return data.automation_config || null;
  } catch (error) {
    console.error("[Booking Request] Error:", error);
    return null;
  }
}
