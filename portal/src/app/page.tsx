"use client";

import { useState } from "react";

// 환자 포털 - 메인 페이지 (로그인 + 대시보드)
// 환자가 예약 조회, 상담 내역 확인, 문서 다운로드를 할 수 있는 공개 포털

type PortalView = "login" | "dashboard";

// Mock 예약 데이터
const mockBookings = [
  {
    id: "B001",
    hospital: "힐링안과",
    procedure: "라식 상담",
    date: "2024-02-15",
    time: "10:00",
    status: "confirmed" as const,
    doctor: "김의사",
  },
  {
    id: "B002",
    hospital: "스마일치과",
    procedure: "임플란트 상담",
    date: "2024-02-20",
    time: "14:00",
    status: "pending" as const,
    doctor: "박의사",
  },
  {
    id: "B003",
    hospital: "힐링안과",
    procedure: "라식 수술",
    date: "2024-03-01",
    time: "09:00",
    status: "confirmed" as const,
    doctor: "김의사",
  },
];

// Mock 상담 내역
const mockConsultations = [
  {
    id: "C001",
    hospital: "힐링안과",
    channel: "LINE",
    date: "2024-01-25",
    summary: "라식 수술 비용 및 절차 문의",
    status: "resolved",
  },
  {
    id: "C002",
    hospital: "힐링안과",
    channel: "WhatsApp",
    date: "2024-01-27",
    summary: "수술 전 검사 일정 확인",
    status: "resolved",
  },
  {
    id: "C003",
    hospital: "스마일치과",
    channel: "카카오톡",
    date: "2024-02-01",
    summary: "임플란트 치료 기간 문의",
    status: "in_progress",
  },
];

// Mock 문서
const mockDocuments = [
  {
    id: "D001",
    name: "수술 동의서",
    type: "PDF",
    date: "2024-01-28",
    hospital: "힐링안과",
  },
  {
    id: "D002",
    name: "사전 검사 결과지",
    type: "PDF",
    date: "2024-01-27",
    hospital: "힐링안과",
  },
  {
    id: "D003",
    name: "치료 안내문",
    type: "PDF",
    date: "2024-02-01",
    hospital: "스마일치과",
  },
];

const statusLabels: Record<string, { label: string; color: string }> = {
  confirmed: { label: "확정", color: "text-green-600 bg-green-50" },
  pending: { label: "대기중", color: "text-yellow-600 bg-yellow-50" },
  cancelled: { label: "취소", color: "text-red-600 bg-red-50" },
  resolved: { label: "완료", color: "text-green-600 bg-green-50" },
  in_progress: { label: "진행중", color: "text-blue-600 bg-blue-50" },
};

export default function PatientPortalPage() {
  const [view, setView] = useState<PortalView>("login");
  const [activeTab, setActiveTab] = useState<"bookings" | "consultations" | "documents">("bookings");
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [selectedLang, setSelectedLang] = useState("ko");

  const languages = [
    { code: "ko", label: "한국어" },
    { code: "en", label: "English" },
    { code: "ja", label: "日本語" },
    { code: "zh", label: "中文" },
    { code: "vi", label: "Tiếng Việt" },
    { code: "th", label: "ภาษาไทย" },
  ];

  const handleSendCode = () => {
    if (email) setCodeSent(true);
  };

  const handleVerify = () => {
    if (verificationCode.length === 6) setView("dashboard");
  };

  // 로그인 페이지
  if (view === "login") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* 언어 선택 */}
            <div className="flex justify-end mb-4">
              <select
                value={selectedLang}
                onChange={(e) => setSelectedLang(e.target.value)}
                className="text-sm border rounded-lg px-3 py-1.5 bg-gray-50"
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 로고 */}
            <div className="text-center mb-8">
              <div className="h-16 w-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">환자 포털</h1>
              <p className="text-gray-500 mt-2">예약 조회 및 상담 내역 확인</p>
            </div>

            {/* 이메일 인증 */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이메일 또는 전화번호
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="patient@example.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              {!codeSent ? (
                <button
                  onClick={handleSendCode}
                  disabled={!email}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  인증 코드 발송
                </button>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      인증 코드 (6자리)
                    </label>
                    <input
                      type="text"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      maxLength={6}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-center text-2xl tracking-widest"
                    />
                  </div>
                  <button
                    onClick={handleVerify}
                    disabled={verificationCode.length !== 6}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    확인
                  </button>
                  <button
                    onClick={() => setCodeSent(false)}
                    className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
                  >
                    다시 보내기
                  </button>
                </>
              )}
            </div>

            <p className="text-xs text-center text-gray-400 mt-6">
              개인정보는 안전하게 보호됩니다
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 대시보드
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">환자 포털</h1>
              <p className="text-xs text-gray-500">{email || "patient@example.com"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedLang}
              onChange={(e) => setSelectedLang(e.target.value)}
              className="text-sm border rounded-lg px-3 py-1.5"
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => setView("login")}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* 환영 카드 */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white mb-6">
          <h2 className="text-xl font-bold mb-1">안녕하세요, 김환자님</h2>
          <p className="text-blue-100">다가오는 예약이 {mockBookings.filter((b) => b.status === "confirmed").length}건 있습니다</p>
        </div>

        {/* 탭 네비게이션 */}
        <div className="flex border-b mb-6">
          {[
            { key: "bookings" as const, label: "예약 현황", icon: "📅" },
            { key: "consultations" as const, label: "상담 내역", icon: "💬" },
            { key: "documents" as const, label: "문서함", icon: "📄" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* 예약 현황 */}
        {activeTab === "bookings" && (
          <div className="space-y-4">
            {mockBookings.map((booking) => (
              <div key={booking.id} className="bg-white rounded-xl border p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg font-semibold">{booking.procedure}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusLabels[booking.status]?.color}`}>
                        {statusLabels[booking.status]?.label}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p>🏥 {booking.hospital}</p>
                      <p>👨‍⚕️ {booking.doctor}</p>
                      <p>📅 {booking.date} {booking.time}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors">
                      변경
                    </button>
                    <button className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                      취소
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <button className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
              + 새 예약 요청
            </button>
          </div>
        )}

        {/* 상담 내역 */}
        {activeTab === "consultations" && (
          <div className="space-y-4">
            {mockConsultations.map((consultation) => (
              <div key={consultation.id} className="bg-white rounded-xl border p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium">{consultation.summary}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusLabels[consultation.status]?.color}`}>
                        {statusLabels[consultation.status]?.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>🏥 {consultation.hospital}</span>
                      <span>📱 {consultation.channel}</span>
                      <span>📅 {consultation.date}</span>
                    </div>
                  </div>
                  <button className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors">
                    상세 보기
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 문서함 */}
        {activeTab === "documents" && (
          <div className="space-y-4">
            {mockDocuments.map((doc) => (
              <div key={doc.id} className="bg-white rounded-xl border p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-red-50 rounded-lg flex items-center justify-center">
                    <span className="text-red-600 font-bold text-xs">{doc.type}</span>
                  </div>
                  <div>
                    <p className="font-medium">{doc.name}</p>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span>🏥 {doc.hospital}</span>
                      <span>📅 {doc.date}</span>
                    </div>
                  </div>
                </div>
                <button className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  다운로드
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 푸터 */}
      <footer className="border-t mt-12 py-8 text-center text-sm text-gray-400">
        <p>고객센터: support@csautomation.com | 운영시간: 09:00-18:00 (KST)</p>
        <p className="mt-1">© 2024 CS Automation Platform. All rights reserved.</p>
      </footer>
    </div>
  );
}
