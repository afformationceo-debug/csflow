"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  Bot,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ArrowUpRight,
  Users,
  Zap,
  Activity,
  Globe,
  Sparkles,
  RefreshCw,
  Heart,
  Coffee,
  Sunrise,
  Sun,
  Moon,
  Star,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Stat {
  title: string;
  value: string;
  numericValue: number;
  change: string;
  trend: "up" | "down";
  icon: React.ElementType;
  description: string;
  gradient: string;
  iconBg: string;
}

interface Conversation {
  id: number;
  customer: string;
  hospital: string;
  channel: "line" | "whatsapp" | "kakao" | "instagram" | "facebook";
  message: string;
  time: string;
  status: "ai_processing" | "ai_complete" | "agent" | "resolved" | "waiting";
  country: string;
  unread?: boolean;
}

interface ChannelStat {
  name: string;
  count: number;
  color: string;
  icon: string;
  percentage: number;
}

interface HospitalAccuracy {
  name: string;
  accuracy: number;
  trend: "up" | "down";
  totalQueries: number;
  autoResolved: number;
}

// ---------------------------------------------------------------------------
// Greeting Helper
// ---------------------------------------------------------------------------
function getGreeting(): { text: string; emoji: React.ElementType; subText: string } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return {
      text: "좋은 아침이에요!",
      emoji: Sunrise,
      subText: "오늘도 힘내봐요. AI가 밤새 고객 응대를 잘 해두었어요.",
    };
  } else if (hour >= 12 && hour < 17) {
    return {
      text: "좋은 오후예요!",
      emoji: Sun,
      subText: "오후도 AI와 함께 순조로운 응대 되시길 바라요.",
    };
  } else if (hour >= 17 && hour < 21) {
    return {
      text: "수고 많으셨어요!",
      emoji: Coffee,
      subText: "퇴근 전 주요 현황을 확인해보세요.",
    };
  } else {
    return {
      text: "안녕하세요!",
      emoji: Moon,
      subText: "야간에도 AI가 24시간 고객을 응대하고 있어요.",
    };
  }
}

// ---------------------------------------------------------------------------
// 기본값 (DB 데이터 로드 전 표시용)
// ---------------------------------------------------------------------------
const defaultStats: Stat[] = [
  { title: "신규 문의", value: "0", numericValue: 0, change: "-", trend: "up", icon: MessageSquare, description: "오늘 문의", gradient: "from-blue-500/10 to-indigo-500/10", iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  { title: "AI 처리율", value: "0%", numericValue: 0, change: "-", trend: "up", icon: Bot, description: "자동 응답 비율", gradient: "from-violet-500/10 to-purple-500/10", iconBg: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  { title: "활성 대화", value: "0", numericValue: 0, change: "-", trend: "up", icon: Zap, description: "진행 중", gradient: "from-emerald-500/10 to-green-500/10", iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  { title: "에스컬레이션", value: "0", numericValue: 0, change: "-", trend: "up", icon: AlertTriangle, description: "미해결 건수", gradient: "from-amber-500/10 to-orange-500/10", iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
];

const CHANNEL_COLORS: Record<string, { name: string; color: string; icon: string }> = {
  line: { name: "LINE", color: "#06C755", icon: "L" },
  whatsapp: { name: "WhatsApp", color: "#25D366", icon: "W" },
  kakao: { name: "카카오톡", color: "#FEE500", icon: "K" },
  instagram: { name: "Instagram", color: "#E4405F", icon: "I" },
  facebook: { name: "Facebook", color: "#1877F2", icon: "F" },
  wechat: { name: "WeChat", color: "#07C160", icon: "We" },
};

// ---------------------------------------------------------------------------
// Animated Number Component
// ---------------------------------------------------------------------------
function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const duration = 1200;
    const steps = 40;
    const increment = value / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const current = Math.min(value, increment * step);
      setDisplay(current);
      if (step >= steps) clearInterval(timer);
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  const formatted = value % 1 !== 0 ? display.toFixed(1) : Math.round(display).toString();

  return (
    <span className="tabular-nums">
      {formatted}{suffix}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string; dot?: boolean }> = {
    ai_processing: {
      label: "AI 분석 중",
      className: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
      dot: true,
    },
    ai_complete: {
      label: "AI 완료",
      className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    },
    agent: {
      label: "담당자 처리",
      className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    },
    resolved: {
      label: "해결됨",
      className: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
    },
    waiting: {
      label: "대기 중",
      className: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20",
    },
  };

  const c = config[status];
  if (!c) return null;

  return (
    <Badge variant="outline" className={`text-[11px] font-medium gap-1.5 ${c.className}`}>
      {c.dot && <span className="h-1.5 w-1.5 rounded-full bg-violet-500 live-dot" />}
      {c.label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Channel Badge
// ---------------------------------------------------------------------------
function ChannelBadge({ channel }: { channel: string }) {
  const channels: Record<string, { bg: string; label: string }> = {
    line: { bg: "bg-[#06C755]", label: "LINE" },
    whatsapp: { bg: "bg-[#25D366]", label: "WA" },
    kakao: { bg: "bg-[#FEE500] text-[#3C1E1E]", label: "KT" },
    instagram: { bg: "bg-gradient-to-r from-[#f09433] to-[#bc1888]", label: "IG" },
    facebook: { bg: "bg-[#1877F2]", label: "FB" },
  };
  const c = channels[channel] || { bg: "bg-gray-500", label: channel };
  return (
    <span className={`inline-flex items-center justify-center h-5 min-w-[28px] px-1.5 rounded text-[10px] font-bold text-white ${c.bg}`}>
      {c.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Country Flag
// ---------------------------------------------------------------------------
function CountryFlag({ code }: { code: string }) {
  const flags: Record<string, string> = {
    JP: "\u{1F1EF}\u{1F1F5}",
    KR: "\u{1F1F0}\u{1F1F7}",
    TW: "\u{1F1F9}\u{1F1FC}",
    US: "\u{1F1FA}\u{1F1F8}",
    MX: "\u{1F1F2}\u{1F1FD}",
    CN: "\u{1F1E8}\u{1F1F3}",
    VN: "\u{1F1FB}\u{1F1F3}",
  };
  return <span className="text-sm">{flags[code] || "\u{1F310}"}</span>;
}

// ---------------------------------------------------------------------------
// Mini Ring Chart
// ---------------------------------------------------------------------------
function MiniRing({ percentage, color, size = 44 }: { percentage: number; color: string; size?: number }) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        fill="none"
        className="text-muted/50"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="ring-progress"
        style={
          {
            "--ring-circumference": circumference,
            "--ring-offset": offset,
          } as React.CSSProperties
        }
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard Component
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  const [isLive] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Initialize on client only to avoid hydration mismatch
  useEffect(() => {
    setLastUpdate(new Date());
  }, []);
  const [greeting, setGreeting] = useState({ text: "안녕하세요!", emoji: Sun as React.ElementType, subText: "로딩 중..." });

  useEffect(() => {
    setGreeting(getGreeting());
  }, []);

  const GreetingIcon = greeting.emoji;

  // DB 데이터 상태
  const [statsData, setStatsData] = useState<Stat[]>(defaultStats);
  const [recentConversations, setRecentConversations] = useState<Conversation[]>([]);
  const [channelStats, setChannelStats] = useState<ChannelStat[]>([]);
  const [hospitalAccuracy, setHospitalAccuracy] = useState<HospitalAccuracy[]>([]);
  const [teamCount, setTeamCount] = useState(0);
  const [csatScore, setCsatScore] = useState("0.0");
  const [aiInsight, setAiInsight] = useState("AI가 데이터를 분석하고 있어요. 문의가 쌓이면 인사이트를 제공합니다.");
  const [isLoading, setIsLoading] = useState(true);

  // DB에서 대시보드 데이터 로드
  const loadDashboardData = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/stats");
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      const s = data.stats;

      // KPI 카드 업데이트
      setStatsData([
        { title: "신규 문의", value: String(s.conversations.today), numericValue: s.conversations.today, change: `총 ${s.conversations.total}건`, trend: "up", icon: MessageSquare, description: "오늘 문의", gradient: "from-blue-500/10 to-indigo-500/10", iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
        { title: "AI 처리율", value: `${s.ai.autoResponseRate}%`, numericValue: s.ai.autoResponseRate, change: `신뢰도 ${s.ai.avgConfidence}%`, trend: "up", icon: Bot, description: "자동 응답 비율", gradient: "from-violet-500/10 to-purple-500/10", iconBg: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
        { title: "활성 대화", value: String(s.conversations.active), numericValue: s.conversations.active, change: `해결 ${s.conversations.resolved}건`, trend: "up", icon: Zap, description: "진행 중", gradient: "from-emerald-500/10 to-green-500/10", iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
        { title: "에스컬레이션", value: String(s.escalations.pending), numericValue: s.escalations.pending, change: `오늘 ${s.escalations.today}건`, trend: s.escalations.pending > 0 ? "down" : "up", icon: AlertTriangle, description: "미해결 건수", gradient: "from-amber-500/10 to-orange-500/10", iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
      ]);

      // 채널별 통계
      const chCounts: Record<string, number> = {};
      (data.channelAccounts || []).forEach((ch: any) => {
        const type = ch.channel_type || "unknown";
        chCounts[type] = (chCounts[type] || 0) + 1;
      });
      const totalCh = Object.values(chCounts).reduce((a, b) => a + b, 0) || 1;
      setChannelStats(
        Object.entries(chCounts).map(([type, count]) => {
          const info = CHANNEL_COLORS[type] || { name: type, color: "#94A3B8", icon: "?" };
          return { name: info.name, count, color: info.color, icon: info.icon, percentage: Math.round((count / totalCh) * 100) };
        })
      );

      // 최근 대화
      const statusMap: Record<string, string> = { active: "ai_processing", waiting: "agent", resolved: "resolved", escalated: "waiting" };
      setRecentConversations(
        (data.recentConversations || []).slice(0, 5).map((conv: any, i: number) => ({
          id: i + 1,
          customer: conv.customer?.name || "알 수 없음",
          hospital: "-",
          channel: "line" as const,
          message: conv.status === "escalated" ? "에스컬레이션 대기 중" : "최근 대화",
          time: conv.last_message_at ? new Date(conv.last_message_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : "-",
          status: (statusMap[conv.status] || "waiting") as Conversation["status"],
          country: conv.customer?.country || "KR",
          unread: conv.status === "active" || conv.status === "waiting",
        }))
      );

      // 거래처 성과
      setHospitalAccuracy(
        (data.tenants || []).map((t: any) => ({
          name: t.name || t.name_en || "거래처",
          accuracy: s.ai.avgConfidence || 0,
          trend: "up" as const,
          totalQueries: s.conversations.total || 0,
          autoResolved: s.conversations.resolved || 0,
        }))
      );

      // 팀원 수
      setTeamCount(data.teamCount || (data.tenants || []).length || 0);

      // CSAT (아직 실제 조사 데이터 없으면 0.0 표시)
      setCsatScore(data.csatScore ? String(data.csatScore) : "0.0");

      // AI 인사이트 생성
      const convToday = s.conversations.today || 0;
      const aiPct = s.ai.autoResponseRate || 0;
      const escPending = s.escalations.pending || 0;
      if (convToday > 0 || escPending > 0) {
        setAiInsight(
          `오늘 신규 문의 ${convToday}건, AI 자동 처리율 ${aiPct}%, 미처리 에스컬레이션 ${escPending}건입니다. ${escPending > 0 ? "에스컬레이션 처리를 확인해주세요." : "모든 문의가 순조롭게 처리되고 있어요."}`
        );
      }

      setLastUpdate(new Date());
    } catch (err) {
      console.error("대시보드 데이터 로드 실패:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    if (!isLive) return;
    const timer = setInterval(() => {
      loadDashboardData();
    }, 30000);
    return () => clearInterval(timer);
  }, [isLive, loadDashboardData]);

  const totalMessages = useMemo(
    () => channelStats.reduce((sum, c) => sum + c.count, 0),
    [channelStats]
  );

  const handleRefresh = useCallback(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto animate-in-up">
      {/* Welcome Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="relative overflow-hidden rounded-2xl hero-gradient p-6 text-white">
          {/* Decorative background elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 float-slow" />
          <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 float-medium" />

          <div className="relative z-10 flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                  <GreetingIcon className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">{greeting.text}</h1>
                  <p className="text-sm text-white/75">{greeting.subText}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/10">
                <div className="flex items-center gap-1.5 text-sm">
                  <Bot className="h-4 w-4 text-white/60" />
                  <span className="text-white/80">AI 처리율</span>
                  <span className="font-bold">{statsData[1]?.numericValue || 0}%</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <Heart className="h-4 w-4 text-white/60" />
                  <span className="text-white/80">AI 신뢰도</span>
                  <span className="font-bold">{statsData[1]?.change || "-"}</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <Star className="h-4 w-4 text-white/60" />
                  <span className="text-white/80">고객수</span>
                  <span className="font-bold">{isLoading ? "..." : statsData[0]?.change || "-"}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-white/60 bg-white/10 rounded-lg px-3 py-1.5 backdrop-blur-sm">
                <span className={`h-2 w-2 rounded-full ${isLive ? "bg-emerald-400 live-dot" : "bg-gray-400"}`} />
                {isLive ? "실시간" : "일시정지"}
                <span>
                  {lastUpdate ? lastUpdate.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-white/80 hover:text-white hover:bg-white/10"
                onClick={handleRefresh}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                새로고침
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsData.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <Card
              className={`relative overflow-hidden card-3d border-0 bg-gradient-to-br ${stat.gradient} dark:bg-gradient-to-br`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                    <div className="text-3xl font-bold tracking-tight">
                      <AnimatedNumber
                        value={stat.numericValue}
                        suffix={stat.value.includes("%") ? "%" : stat.value.includes("분") ? "분" : ""}
                      />
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      {stat.trend === "up" ? (
                        <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                      )}
                      <span className={stat.trend === "up" ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-red-600 dark:text-red-400 font-medium"}>
                        {stat.change}
                      </span>
                      <span className="text-muted-foreground">{stat.description}</span>
                    </div>
                  </div>
                  <div className={`flex items-center justify-center h-11 w-11 rounded-xl ${stat.iconBg}`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* AI Insight Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <Card className="border-0 shadow-sm bg-gradient-to-r from-violet-500/5 via-purple-500/5 to-indigo-500/5 overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 ai-glow-pulse shrink-0">
                <Sparkles className="h-4.5 w-4.5 text-violet-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-violet-700 dark:text-violet-300">AI 인사이트</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {aiInsight}
                </p>
              </div>
              <Button variant="ghost" size="sm" className="text-xs text-violet-600 hover:text-violet-700 shrink-0">
                자세히 보기
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Recent Conversations - Takes 3 columns */}
        <motion.div
          className="lg:col-span-3"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold">실시간 대화</CardTitle>
                <Badge variant="secondary" className="text-[10px] font-medium h-5">
                  <Activity className="h-3 w-3 mr-1" />
                  LIVE
                </Badge>
              </div>
              <Link
                href="/inbox"
                className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors"
              >
                전체보기 <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                <AnimatePresence>
                  {recentConversations.map((conv, index) => (
                    <motion.div
                      key={conv.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + index * 0.06, duration: 0.4 }}
                    >
                      <Link
                        href="/inbox"
                        className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/50 transition-all duration-200 group"
                      >
                        {/* Unread indicator */}
                        <div className="w-1.5 flex-shrink-0">
                          {conv.unread && (
                            <span className="block h-1.5 w-1.5 rounded-full bg-primary" />
                          )}
                        </div>

                        {/* Channel + Flag */}
                        <div className="flex flex-col items-center gap-1 flex-shrink-0">
                          <ChannelBadge channel={conv.channel} />
                          <CountryFlag code={conv.country} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{conv.customer}</span>
                            <span className="text-xs text-muted-foreground truncate">{conv.hospital}</span>
                          </div>
                          <p className="text-sm text-muted-foreground truncate mt-0.5">{conv.message}</p>
                        </div>

                        {/* Right side */}
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          <StatusBadge status={conv.status} />
                          <span className="text-[11px] text-muted-foreground">{conv.time}</span>
                        </div>

                        {/* Arrow on hover */}
                        <ArrowRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
                      </Link>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Right Column - Takes 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Channel Distribution */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">채널별 문의량</CardTitle>
                  <span className="text-xs text-muted-foreground font-medium">오늘 총 {totalMessages}건</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {channelStats.map((channel, idx) => (
                  <motion.div
                    key={channel.name}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 + idx * 0.08 }}
                    className="group"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex items-center justify-center h-7 w-7 rounded-lg text-[10px] font-bold flex-shrink-0"
                        style={{
                          backgroundColor: channel.color,
                          color: channel.name === "카카오톡" ? "#3C1E1E" : "white",
                        }}
                      >
                        {channel.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{channel.name}</span>
                          <span className="text-sm font-semibold tabular-nums">{channel.count}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full progress-shine"
                            style={{ backgroundColor: channel.color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${channel.percentage}%` }}
                            transition={{ duration: 0.8, delay: 0.6 + idx * 0.1, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </CardContent>
            </Card>
          </motion.div>

          {/* AI Accuracy by Hospital */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">거래처별 AI 정확도</CardTitle>
                  <Link
                    href="/analytics"
                    className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors"
                  >
                    상세 <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {hospitalAccuracy.map((hospital, idx) => (
                  <motion.div
                    key={hospital.name}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 + idx * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    <MiniRing
                      percentage={hospital.accuracy}
                      color={
                        hospital.accuracy >= 90
                          ? "#22c55e"
                          : hospital.accuracy >= 85
                          ? "#f59e0b"
                          : "#ef4444"
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{hospital.name}</span>
                        <div className="flex items-center gap-1">
                          {hospital.trend === "up" ? (
                            <TrendingUp className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <TrendingDown className="h-3 w-3 text-red-500" />
                          )}
                          <span
                            className={`text-sm font-bold tabular-nums ${
                              hospital.accuracy >= 90
                                ? "text-emerald-600 dark:text-emerald-400"
                                : hospital.accuracy >= 85
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {hospital.accuracy}%
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {hospital.totalQueries}건 중 {hospital.autoResolved}건 자동 처리
                      </p>
                    </div>
                  </motion.div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Bottom Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Card className="border-0 shadow-sm card-3d">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-blue-500/10">
                <Globe className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium">활성 채널</p>
                <p className="text-2xl font-bold tabular-nums">{channelStats.length || 0}</p>
              </div>
              <div className="ml-auto flex -space-x-1">
                {channelStats.map((ch, i) => (
                  <div
                    key={i}
                    className="h-3 w-3 rounded-full border-2 border-card"
                    style={{ backgroundColor: ch.color }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <Card className="border-0 shadow-sm card-3d">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-violet-500/10">
                <Users className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-medium">활성 담당자</p>
                <p className="text-2xl font-bold tabular-nums">{teamCount}<span className="text-sm font-normal text-muted-foreground">명</span></p>
              </div>
              <Badge variant="secondary" className="ml-auto text-[10px]">팀</Badge>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
        >
          <Card className="border-0 shadow-sm card-3d">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-500/10">
                <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium">고객 만족도</p>
                <p className="text-2xl font-bold tabular-nums">{csatScore}<span className="text-sm font-normal text-muted-foreground">/5.0</span></p>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <Activity className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-xs font-medium text-muted-foreground">데이터 수집 중</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
