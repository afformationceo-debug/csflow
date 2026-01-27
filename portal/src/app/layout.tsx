import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "환자 포털 - 예약 및 상담 조회",
  description: "예약 조회, 상담 내역 확인, 문서 다운로드를 위한 환자 포털",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
