import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: any) {
          response.cookies.set({
            name,
            value: "",
            ...options,
          });
        },
      },
    }
  );

  // 세션 확인
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 공개 경로 (웹훅, OAuth)
  const publicRoutes = ["/login", "/api/webhooks", "/api/oauth"];
  const isPublicRoute = publicRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  // API 경로는 인증 실패 시 리다이렉트 대신 401 반환
  const isApiRoute = request.nextUrl.pathname.startsWith("/api");

  // 인증되지 않은 사용자 처리
  if (!user && !isPublicRoute) {
    if (isApiRoute) {
      // API 호출은 401 Unauthorized 반환 (리다이렉트 안 함)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    // 페이지 접근은 로그인으로 리다이렉트
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 이미 로그인한 사용자가 로그인 페이지 접근 시 대시보드로 리다이렉트
  if (user && request.nextUrl.pathname === "/login") {
    const dashboardUrl = new URL("/dashboard", request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * 다음을 제외한 모든 경로에 매칭:
     * - _next/static (정적 파일)
     * - _next/image (이미지 최적화)
     * - favicon.ico (파비콘)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
