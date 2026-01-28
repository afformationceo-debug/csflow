"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, ReactNode } from "react";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // ✅ 즉시 캐시 사용 (30분 유지)
            staleTime: 30 * 60 * 1000,
            // 1시간 캐시 유지
            gcTime: 60 * 60 * 1000,
            // Retry 빠르게 (1번만)
            retry: 1,
            retryDelay: 500,
            // Window focus시 refetch 비활성화 (속도 우선)
            refetchOnWindowFocus: false,
            // Reconnect시만 refetch
            refetchOnReconnect: true,
            // ✅ 초기 데이터 표시 우선
            placeholderData: (previousData) => previousData,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
