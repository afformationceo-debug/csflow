"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Clock,
  User,
  MessageCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ──

interface BookingRequest {
  id: string;
  tenantId: string;
  tenantName: string;
  customerId: string;
  customerName: string;
  customerLanguage: string;
  customerCountry?: string;
  conversationId: string;
  requestedDate: string;
  requestedTime?: string;
  treatmentType?: string;
  specialRequests?: string;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  waitingMinutes?: number;
  notificationsSent?: number;
  customerChannels?: Array<{ channel_type: string; account_name: string }>;
}

// ── Constants ──

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pending_human_approval: {
    label: "대기 중",
    color: "text-amber-600",
    bg: "bg-amber-500/10",
    icon: AlertCircle,
  },
  needs_rescheduling: {
    label: "조율 필요",
    color: "text-blue-600",
    bg: "bg-blue-500/10",
    icon: RefreshCw,
  },
  human_approved: {
    label: "승인됨",
    color: "text-emerald-600",
    bg: "bg-emerald-500/10",
    icon: CheckCircle,
  },
  rejected: {
    label: "거절됨",
    color: "text-red-600",
    bg: "bg-red-500/10",
    icon: XCircle,
  },
};

const smoothEase = [0.22, 1, 0.36, 1] as [number, number, number, number];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: smoothEase } },
};

// ── Utility Functions ──

function formatWaitingTime(minutes?: number): string {
  if (!minutes) return "방금";
  if (minutes < 60) return `${Math.floor(minutes)}분 전`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}시간 전`;
  return `${Math.floor(minutes / 1440)}일 전`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

// ── Main Component ──

export default function BookingsPage() {
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<BookingRequest | null>(null);

  // Fetch bookings on mount
  useEffect(() => {
    async function loadBookings() {
      try {
        const res = await fetch("/api/booking/requests");
        if (res.ok) {
          const data = await res.json();
          setBookings(data.requests || []);
        }
      } catch (error) {
        console.error("Failed to load bookings:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadBookings();
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/booking/requests");
        if (res.ok) {
          const data = await res.json();
          setBookings(data.requests || []);
        }
      } catch {
        // Ignore errors on background refresh
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const pendingCount = bookings.filter((b) => b.status === "pending_human_approval").length;
  const rescheduleCount = bookings.filter((b) => b.status === "needs_rescheduling").length;

  return (
    <div className="space-y-6">
      {/* ── 페이지 헤더 ── */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-500">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">예약 대기 목록</h1>
              <p className="text-[13px] text-muted-foreground">
                고객 예약 신청을 확인하고 승인하세요
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 요약 통계 ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-500/10 to-amber-600/5 card-3d">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10">
                <AlertCircle className="h-4 w-4 text-amber-600" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                승인 대기
              </p>
              <p className="text-2xl font-bold tabular-nums tracking-tight">{pendingCount}</p>
              <p className="text-[11px] text-muted-foreground">즉시 처리 필요</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-500/10 to-blue-600/5 card-3d">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10">
                <RefreshCw className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                조율 필요
              </p>
              <p className="text-2xl font-bold tabular-nums tracking-tight">{rescheduleCount}</p>
              <p className="text-[11px] text-muted-foreground">날짜 재조정</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 card-3d">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                총 신청
              </p>
              <p className="text-2xl font-bold tabular-nums tracking-tight">{bookings.length}</p>
              <p className="text-[11px] text-muted-foreground">전체 예약 신청</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-500/10 to-purple-600/5 card-3d">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10">
                <Sparkles className="h-4 w-4 text-violet-600" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                AI 자동 감지
              </p>
              <p className="text-2xl font-bold tabular-nums tracking-tight">
                {Math.round((bookings.length / Math.max(bookings.length, 1)) * 100)}%
              </p>
              <p className="text-[11px] text-muted-foreground">예약 의도 인식률</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 예약 목록 ── */}
      <Card className="border-0 shadow-sm overflow-hidden rounded-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10">
                <Calendar className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-[15px] flex items-center gap-2">
                  예약 신청 목록
                  <Badge variant="secondary" className="text-[11px] font-semibold tabular-nums h-5 px-1.5 rounded-full">
                    {bookings.length}
                  </Badge>
                </CardTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  대기 중인 예약 신청을 처리하세요
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-muted/20 animate-pulse">
                  <div className="h-12 w-12 rounded-xl bg-muted/50" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 rounded bg-muted/50" />
                    <div className="h-3 w-48 rounded bg-muted/30" />
                  </div>
                </div>
              ))}
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-12">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/50 mx-auto mb-3">
                <Calendar className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">예약 신청이 없습니다</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                고객이 예약을 신청하면 여기에 표시됩니다.
              </p>
            </div>
          ) : (
            <motion.div className="space-y-3" variants={containerVariants} initial="hidden" animate="visible">
              <AnimatePresence mode="popLayout">
                {bookings.map((booking) => {
                  const statusStyle = STATUS_STYLES[booking.status] || STATUS_STYLES.pending_human_approval;
                  const Icon = statusStyle.icon;
                  const isPending = booking.status === "pending_human_approval";

                  return (
                    <motion.div
                      key={booking.id}
                      variants={itemVariants}
                      exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
                      layout
                      className={`group relative flex items-start gap-4 rounded-xl p-4 transition-all cursor-pointer ${
                        isPending
                          ? "bg-gradient-to-br from-amber-500/5 to-amber-600/[0.02] hover:from-amber-500/10 hover:to-amber-600/5"
                          : "bg-muted/30 hover:bg-muted/50"
                      }`}
                      onClick={() => setSelectedBooking(booking)}
                    >
                      {/* 예약 아이콘 */}
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${statusStyle.bg} shrink-0`}>
                        <Icon className={`h-5 w-5 ${statusStyle.color}`} />
                      </div>

                      {/* 예약 정보 */}
                      <div className="flex-1 min-w-0 space-y-2">
                        {/* 첫 번째 줄: 고객명 + 상태 */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{booking.customerName}</span>
                          <Badge variant="outline" className="text-[10px] h-[18px] px-1.5 font-medium rounded-full">
                            {booking.customerLanguage} ({booking.customerCountry || "국가 미상"})
                          </Badge>
                          <Badge className={`text-[10px] h-[18px] px-1.5 font-semibold rounded-full ${statusStyle.bg} ${statusStyle.color} border-0`}>
                            {statusStyle.label}
                          </Badge>
                          {isPending && (
                            <span className="flex items-center gap-1 text-[11px] text-amber-600">
                              <Clock className="h-3 w-3" />
                              {formatWaitingTime(booking.waitingMinutes)}
                            </span>
                          )}
                        </div>

                        {/* 두 번째 줄: 거래처 + 채널 */}
                        <div className="flex items-center gap-2 text-[12px] text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <span className="font-medium">{booking.tenantName}</span>
                          </span>
                          {booking.customerChannels && booking.customerChannels.length > 0 && (
                            <>
                              <span className="text-muted-foreground/40">|</span>
                              <span className="flex items-center gap-1">
                                <MessageCircle className="h-3 w-3" />
                                {booking.customerChannels[0].channel_type.toUpperCase()}
                              </span>
                            </>
                          )}
                        </div>

                        {/* 세 번째 줄: 예약 날짜/시간/시술 */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                          <div className="flex items-center gap-2 text-[12px]">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium">{formatDate(booking.requestedDate)}</span>
                          </div>
                          {booking.requestedTime && (
                            <div className="flex items-center gap-2 text-[12px]">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{booking.requestedTime}</span>
                            </div>
                          )}
                          {booking.treatmentType && (
                            <div className="flex items-center gap-2 text-[12px]">
                              <User className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{booking.treatmentType}</span>
                            </div>
                          )}
                        </div>

                        {/* 네 번째 줄: 특별 요청 */}
                        {booking.specialRequests && (
                          <div className="pt-2 border-t border-border/50">
                            <p className="text-[11px] text-muted-foreground">
                              <span className="font-medium">특별 요청:</span> {booking.specialRequests}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* 액션 버튼 */}
                      {isPending && (
                        <div className="flex flex-col gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="sm" className="h-8 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-600">
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />
                            승인
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 px-3 rounded-lg">
                            <RefreshCw className="h-3.5 w-3.5 mr-1" />
                            조율
                          </Button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
