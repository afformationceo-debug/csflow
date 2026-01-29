import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/debug/auth
 * 인증 상태 및 RLS 디버깅
 */
export async function GET() {
  try {
    // 1. 일반 클라이언트로 현재 사용자 확인
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({
        authenticated: false,
        error: authError?.message || "No user found",
      });
    }

    // 2. users 테이블에서 tenant_ids 확인
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    // 3. Service Role로 모든 데이터 확인
    const serviceSupabase = await createServiceClient();
    const { data: allConversations, error: allConvError } = await (serviceSupabase as any)
      .from("conversations")
      .select("id, customer_id, tenant_id, status")
      .limit(10);

    // 4. 일반 클라이언트로 conversations 조회 (RLS 적용)
    const { data: userConversations, error: convError } = await (supabase as any)
      .from("conversations")
      .select("id, customer_id, tenant_id, status")
      .limit(10);

    // 5. tenants 테이블 확인
    const { data: allTenants } = await (serviceSupabase as any)
      .from("tenants")
      .select("id, name");

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      usersTable: {
        exists: !!userData,
        data: userData,
        error: userError?.message,
      },
      tenants: allTenants,
      conversations: {
        withServiceRole: {
          count: allConversations?.length || 0,
          data: allConversations,
          error: allConvError?.message,
        },
        withUserAuth: {
          count: userConversations?.length || 0,
          data: userConversations,
          error: convError?.message,
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
