"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
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
// Mock Data
// ---------------------------------------------------------------------------
const stats: Stat[] = [
  {
    title: "신규 문의",
    value: "127",
    numericValue: 127,
    change: "+12%",
    trend: "up",
    icon: MessageSquare,
    description: "전일 대비",
    gradient: "from-blue-500/10 to-indigo-500/10",
    iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  {
    title: "AI 처리율",
    value: "82.3%",
    numericValue: 82.3,
    change: "+5.2%",
    trend: "up",
    icon: Bot,
    description: "자동 응답 비율",
    gradient: "from-violet-500/10 to-purple-500/10",
    iconBg: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  {
    title: "평균 응답",
    value: "1.2분",
    numericValue: 1.2,
    change: "-0.3분",
    trend: "up",
    icon: Zap,
    description: "첫 응답까지",
    gradient: "from-emerald-500/10 to-green-500/10",
    iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    title: "에스컬레이션",
    value: "23",
    numericValue: 23,
    change: "-8건",
    trend: "up",
    icon: AlertTriangle,
    description: "미해결 건수",
    gradient: "from-amber-500/10 to-orange-500/10",
    iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
];

const recentConversations: Conversation[] = [
  {
    id: 1,
    customer: "Tanaka Yuki",
    hospital: "힐링안과",
    channel: "line",
    message: "ラーシック手術の費用はいくらですか？",
    time: "2분 전",
    status: "ai_processing",
    country: "JP",
    unread: true,
  },
  {
    id: 2,
    customer: "이수진",
    hospital: "스마일치과",
    channel: "kakao",
    message: "예약 변경하고 싶습니다. 3월 15일로 가능한가요?",
    time: "5분 전",
    status: "agent",
    country: "KR",
  },
  {
    id: 3,
    customer: "Chen Wei",
    hospital: "서울성형",
    channel: "instagram",
    message: "想看双眼皮手术前后对比照片",
    time: "12분 전",
    status: "resolved",
    country: "TW",
  },
  {
    id: 4,
    customer: "John Smith",
    hospital: "힐링안과",
    channel: "whatsapp",
    message: "What's the price for LASIK surgery?",
    time: "15분 전",
    status: "ai_complete",
    country: "US",
  },
  {
    id: 5,
    customer: "Maria Garcia",
    hospital: "강남피부과",
    channel: "facebook",
    message: "¿Cuánto cuesta el tratamiento de botox?",
    time: "23분 전",
    status: "waiting",
    country: "MX",
  },
];

const channelStats: ChannelStat[] = [
  { name: "LINE", count: 45, color: "#06C755", icon: "L", percentage: 35 },
  { name: "WhatsApp", count: 32, color: "#25D366", icon: "W", percentage: 25 },
  { name: "카카오톡", count: 28, color: "#FEE500", icon: "K", percentage: 22 },
  { name: "Instagram", count: 15, color: "#E4405F", icon: "I", percentage: 12 },
  { name: "Facebook", count: 7, color: "#1877F2", icon: "F", percentage: 6 },
];

const hospitalAccuracy: HospitalAccuracy[] = [
  { name: "힐링안과", accuracy: 92.1, trend: "up", totalQueries: 312, autoResolved: 287 },
  { name: "스마일치과", accuracy: 88.7, trend: "up", totalQueries: 198, autoResolved: 175 },
  { name: "강남피부과", accuracy: 91.5, trend: "up", totalQueries: 245, autoResolved: 224 },
  { name: "서울성형", accuracy: 85.3, trend: "down", totalQueries: 167, autoResolved: 142 },
];

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
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    if (!isLive) return;
    const timer = setInterval(() => {
      setLastUpdate(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, [isLive]);

  const totalMessages = useMemo(
    () => channelStats.reduce((sum, c) => sum + c.count, 0),
    []
  );

  const handleRefresh = useCallback(() => {
    setLastUpdate(new Date());
  }, []);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">대시보드</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            실시간 CS 현황을 한눈에 확인하세요
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${isLive ? "bg-emerald-500 live-dot" : "bg-gray-400"}`} />
            {isLive ? "실시간" : "일시정지"}
            <span className="text-muted-foreground/60">
              {lastUpdate.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={handleRefresh}>
            <RefreshCw className="h-3.5 w-3.5" />
            새로고침
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
        {stats.map((stat) => (
          <Card
            key={stat.title}
            className={`relative overflow-hidden hover-lift border-0 bg-gradient-to-br ${stat.gradient} dark:bg-gradient-to-br`}
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
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Recent Conversations - Takes 3 columns */}
        <Card className="lg:col-span-3 border-0 shadow-sm">
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
                    transition={{ delay: index * 0.05, duration: 0.3 }}
                  >
                    <Link
                      href="/inbox"
                      className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors group"
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

        {/* Right Column - Takes 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Channel Distribution */}
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
                  transition={{ delay: 0.3 + idx * 0.08 }}
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
                          className="h-full rounded-full"
                          style={{ backgroundColor: channel.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${channel.percentage}%` }}
                          transition={{ duration: 0.8, delay: 0.4 + idx * 0.1, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </CardContent>
          </Card>

          {/* AI Accuracy by Hospital */}
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
                  transition={{ delay: 0.5 + idx * 0.1 }}
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
        </div>
      </div>

      {/* Bottom Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Card className="border-0 shadow-sm hover-lift">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-blue-500/10">
                <Globe className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium">활성 채널</p>
                <p className="text-2xl font-bold tabular-nums">6</p>
              </div>
              <div className="ml-auto flex -space-x-1">
                {["#06C755", "#25D366", "#FEE500", "#E4405F", "#1877F2", "#7C3AED"].map((color, i) => (
                  <div
                    key={i}
                    className="h-3 w-3 rounded-full border-2 border-card"
                    style={{ backgroundColor: color }}
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
          <Card className="border-0 shadow-sm hover-lift">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-violet-500/10">
                <Users className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-medium">활성 담당자</p>
                <p className="text-2xl font-bold tabular-nums">4<span className="text-sm font-normal text-muted-foreground">/6</span></p>
              </div>
              <Badge variant="secondary" className="ml-auto text-[10px]">온라인</Badge>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
        >
          <Card className="border-0 shadow-sm hover-lift">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-500/10">
                <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium">고객 만족도</p>
                <p className="text-2xl font-bold tabular-nums">4.7<span className="text-sm font-normal text-muted-foreground">/5.0</span></p>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">+0.2</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
