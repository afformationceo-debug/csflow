"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
// Select components available if needed for alternative period picker
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Bot,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Clock,
  ThumbsUp,
  AlertTriangle,
  Globe,
  Building,
  ArrowUpRight,
  Activity,
  BarChart3,
  Timer,
  Languages,
  ShieldAlert,
} from "lucide-react";
import { motion } from "framer-motion";

// ─── Period Options ──────────────────────────────────────────────────────────
const periodOptions = [
  { value: "1d", label: "오늘" },
  { value: "7d", label: "최근 7일" },
  { value: "30d", label: "최근 30일" },
  { value: "90d", label: "최근 90일" },
];

// ─── Icon Mapping (API returns icon name as string) ─────────────────────────

import type { LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  MessageSquare,
  Bot,
  Clock,
  ThumbsUp,
  ShieldAlert,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatKPIValue(value: number, format: string): string {
  switch (format) {
    case "number":
      return value.toLocaleString();
    case "percent":
      return `${value}%`;
    case "minutes":
      return `${value}분`;
    case "score":
      return `${value}/5.0`;
    default:
      return String(value);
  }
}

function getColorClasses(color: string) {
  const map: Record<string, { bg: string; text: string; icon: string }> = {
    blue: {
      bg: "bg-blue-500/10",
      text: "text-blue-600 dark:text-blue-400",
      icon: "text-blue-500",
    },
    violet: {
      bg: "bg-violet-500/10",
      text: "text-violet-600 dark:text-violet-400",
      icon: "text-violet-500",
    },
    emerald: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-600 dark:text-emerald-400",
      icon: "text-emerald-500",
    },
    amber: {
      bg: "bg-amber-500/10",
      text: "text-amber-600 dark:text-amber-400",
      icon: "text-amber-500",
    },
    rose: {
      bg: "bg-rose-500/10",
      text: "text-rose-600 dark:text-rose-400",
      icon: "text-rose-500",
    },
  };
  return map[color] || map.blue;
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case "critical":
      return "bg-red-500/10 text-red-600 dark:text-red-400";
    case "high":
      return "bg-orange-500/10 text-orange-600 dark:text-orange-400";
    case "medium":
      return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400";
    default:
      return "bg-gray-500/10 text-gray-600 dark:text-gray-400";
  }
}

// ─── Mini Sparkline (CSS/SVG) ────────────────────────────────────────────────

function Sparkline({
  data,
  color,
  height = 32,
  width = 80,
}: {
  data: number[];
  color: string;
  height?: number;
  width?: number;
}) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * (width - padding * 2) + padding;
      const y = height - padding - ((v - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const fillPoints = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`;

  const colorMap: Record<string, { stroke: string; fill: string }> = {
    blue: { stroke: "#3b82f6", fill: "rgba(59,130,246,0.1)" },
    violet: { stroke: "#8b5cf6", fill: "rgba(139,92,246,0.1)" },
    emerald: { stroke: "#10b981", fill: "rgba(16,185,129,0.1)" },
    amber: { stroke: "#f59e0b", fill: "rgba(245,158,11,0.1)" },
    rose: { stroke: "#f43f5e", fill: "rgba(244,63,94,0.1)" },
  };

  const c = colorMap[color] || colorMap.blue;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polygon points={fillPoints} fill={c.fill} />
      <polyline
        points={points}
        fill="none"
        stroke={c.stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Latest point dot */}
      {data.length > 0 && (
        <circle
          cx={width - padding}
          cy={
            height -
            padding -
            ((data[data.length - 1] - min) / range) * (height - padding * 2)
          }
          r="2.5"
          fill={c.stroke}
        />
      )}
    </svg>
  );
}

// ─── Donut Chart (SVG) ───────────────────────────────────────────────────────

function DonutChart({
  data,
}: {
  data: { label: string; percentage: number; color: string }[];
}) {
  const radius = 60;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;
  let cumulativePercentage = 0;

  const segments = data.map((item) => {
    const offset = cumulativePercentage;
    cumulativePercentage += item.percentage;
    return {
      ...item,
      dashoffset: circumference * (1 - item.percentage / 100),
      rotation: (offset / 100) * 360 - 90,
    };
  });

  return (
    <svg viewBox="0 0 160 160" className="w-full h-full">
      {/* Background ring */}
      <circle
        cx="80"
        cy="80"
        r={radius}
        fill="none"
        stroke="currentColor"
        className="text-muted/30"
        strokeWidth={strokeWidth}
      />
      {/* Segments */}
      {segments.map((seg, i) => (
        <circle
          key={i}
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke={seg.color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${(seg.percentage / 100) * circumference} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(${seg.rotation} 80 80)`}
          className="ring-progress"
          style={
            {
              "--ring-circumference": circumference,
              "--ring-offset": circumference * (1 - seg.percentage / 100),
              animationDelay: `${i * 150}ms`,
            } as React.CSSProperties
          }
        />
      ))}
      {/* Center text */}
      <text
        x="80"
        y="74"
        textAnchor="middle"
        className="fill-foreground text-[22px] font-bold"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {data.length}
      </text>
      <text
        x="80"
        y="92"
        textAnchor="middle"
        className="fill-muted-foreground text-[11px]"
      >
        languages
      </text>
    </svg>
  );
}

// ─── Animation Config ────────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const easeCurve: [number, number, number, number] = [0.22, 1, 0.36, 1];

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: easeCurve,
    },
  },
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [period, setPeriod] = useState("7d");

  // ─── Data State ────────────────────────────────────────────────────────────
  const [kpiCards, setKpiCards] = useState<any[]>([]);
  const [channelDistribution, setChannelDistribution] = useState<any[]>([]);
  const [dailyTrends, setDailyTrends] = useState<any[]>([]);
  const [tenantPerformance, setTenantPerformance] = useState<any[]>([]);
  const [languageDistribution, setLanguageDistribution] = useState<any[]>([]);
  const [escalationReasons, setEscalationReasons] = useState<any[]>([]);
  const [responseTimeDistribution, setResponseTimeDistribution] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ─── Data Fetching ─────────────────────────────────────────────────────────
  const loadAnalytics = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/analytics?period=${period}`);
      const data = await res.json();
      if (data.kpiCards) setKpiCards(data.kpiCards);
      if (data.channelDistribution) setChannelDistribution(data.channelDistribution);
      if (data.dailyTrends) setDailyTrends(data.dailyTrends);
      if (data.tenantPerformance) setTenantPerformance(data.tenantPerformance);
      if (data.languageDistribution) setLanguageDistribution(data.languageDistribution);
      if (data.escalationReasons) setEscalationReasons(data.escalationReasons);
      if (data.responseTimeDistribution) setResponseTimeDistribution(data.responseTimeDistribution);
    } catch (error) {
      console.error("Failed to load analytics:", error);
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // ─── Computed Values (guard empty arrays) ──────────────────────────────────
  const maxDailyConversations = dailyTrends.length > 0 ? Math.max(...dailyTrends.map((d) => d.conversations)) : 1;
  const maxResponseCount = responseTimeDistribution.length > 0 ? Math.max(...responseTimeDistribution.map((d) => d.count)) : 1;

  return (
    <div className="space-y-6">
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl p-2.5 bg-gradient-to-br from-violet-500 to-purple-500 shadow-lg shadow-violet-500/20">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">분석 및 리포트</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              AI 성과와 고객 응대 현황을 한눈에 파악하세요
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 mr-2">
            <span className="live-dot inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-[11px] text-muted-foreground">실시간</span>
          </div>
          <div className="flex items-center rounded-lg border border-border/50 bg-muted/30 p-0.5">
            {periodOptions.map((opt) => (
              <Button
                key={opt.value}
                variant={period === opt.value ? "default" : "ghost"}
                size="sm"
                className={`h-7 px-3 text-xs rounded-md ${
                  period === opt.value
                    ? "shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setPeriod(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────── */}
      <motion.div
        className="grid gap-4 grid-cols-2 lg:grid-cols-5 stagger-children"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {kpiCards.map((kpi) => {
          const Icon = typeof kpi.icon === "string" ? iconMap[kpi.icon] || MessageSquare : kpi.icon;
          const colors = getColorClasses(kpi.color);
          const isPositiveGood = kpi.id !== "escalation";
          const isGood = isPositiveGood ? kpi.change >= 0 : kpi.change <= 0;

          return (
            <motion.div key={kpi.id} variants={itemVariants}>
              <Card className="border-0 shadow-sm card-3d rounded-2xl overflow-hidden relative">
                {/* Subtle gradient background */}
                <div
                  className={`absolute inset-0 opacity-[0.03] ${
                    kpi.color === "blue"
                      ? "bg-gradient-to-br from-blue-500 to-blue-600"
                      : kpi.color === "violet"
                      ? "bg-gradient-to-br from-violet-500 to-violet-600"
                      : kpi.color === "emerald"
                      ? "bg-gradient-to-br from-emerald-500 to-emerald-600"
                      : kpi.color === "amber"
                      ? "bg-gradient-to-br from-amber-500 to-amber-600"
                      : "bg-gradient-to-br from-rose-500 to-rose-600"
                  }`}
                />
                <CardContent className="p-4 relative">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`rounded-xl p-2 ${colors.bg}`}>
                      <Icon className={`h-4 w-4 ${colors.icon}`} />
                    </div>
                    <Sparkline data={kpi.sparkline} color={kpi.color} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      {kpi.label}
                    </p>
                    <p
                      className="text-2xl font-bold tracking-tight"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {formatKPIValue(kpi.value, kpi.format)}
                    </p>
                    <div className="flex items-center gap-1">
                      {isGood ? (
                        <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-rose-500" />
                      )}
                      <span
                        className={`text-[11px] font-medium tabular-nums ${
                          isGood ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {kpi.change > 0 ? "+" : ""}
                        {kpi.change}%
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {kpi.changeLabel}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* ── Charts Row ──────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Channel Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4, ease: easeCurve }}
        >
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-xl p-2 bg-blue-500/10">
                    <BarChart3 className="h-4 w-4 text-blue-500" />
                  </div>
                  <CardTitle className="text-sm font-semibold">채널별 문의 분포</CardTitle>
                </div>
                <Badge variant="secondary" className="text-[11px] font-normal rounded-full">
                  총 {channelDistribution.reduce((s, c) => s + c.count, 0).toLocaleString()}건
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="space-y-3">
                {channelDistribution.map((channel, i) => (
                  <div key={channel.name} className="group">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: channel.color }}
                        />
                        <span className="text-sm font-medium">{channel.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className="text-sm tabular-nums text-muted-foreground"
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {channel.count.toLocaleString()}건
                        </span>
                        <span
                          className="text-[11px] tabular-nums font-medium w-10 text-right"
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {channel.percentage}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bar-grow progress-shine transition-all"
                        style={{
                          width: `${channel.percentage}%`,
                          backgroundColor: channel.color,
                          animationDelay: `${i * 100}ms`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Daily Trends */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4, ease: easeCurve }}
        >
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-xl p-2 bg-violet-500/10">
                    <Activity className="h-4 w-4 text-violet-500" />
                  </div>
                  <CardTitle className="text-sm font-semibold">일별 대화 트렌드</CardTitle>
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-muted-foreground">문의</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-muted-foreground">해결</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex items-end gap-2 h-[180px] pt-4">
                {dailyTrends.map((day, i) => {
                  const convHeight = (day.conversations / maxDailyConversations) * 100;
                  const resHeight = (day.resolved / maxDailyConversations) * 100;
                  return (
                    <div
                      key={day.day}
                      className="flex-1 flex flex-col items-center gap-1 group"
                    >
                      {/* Value on hover */}
                      <div className="text-[10px] tabular-nums text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {day.conversations}
                      </div>
                      {/* Bars */}
                      <div className="w-full flex gap-0.5 items-end flex-1">
                        <div className="flex-1 relative">
                          <div
                            className="w-full bg-primary/20 rounded-t-md transition-all duration-300 group-hover:bg-primary/30"
                            style={{
                              height: `${convHeight}%`,
                              animationDelay: `${i * 80}ms`,
                            }}
                          />
                        </div>
                        <div className="flex-1 relative">
                          <div
                            className="w-full bg-emerald-500/30 rounded-t-md transition-all duration-300 group-hover:bg-emerald-500/40"
                            style={{
                              height: `${resHeight}%`,
                              animationDelay: `${i * 80 + 40}ms`,
                            }}
                          />
                        </div>
                      </div>
                      {/* Day label */}
                      <span className="text-[11px] text-muted-foreground font-medium">
                        {day.day}
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* Summary bar */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
                <div className="text-[11px] text-muted-foreground">
                  주간 총 문의: <span className="font-semibold text-foreground tabular-nums">{dailyTrends.reduce((s, d) => s + d.conversations, 0).toLocaleString()}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  해결율: <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {(() => {
                      const totalConv = dailyTrends.reduce((s, d) => s + d.conversations, 0);
                      const totalRes = dailyTrends.reduce((s, d) => s + d.resolved, 0);
                      return totalConv > 0 ? ((totalRes / totalConv) * 100).toFixed(1) : "0.0";
                    })()}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Middle Row: Language + Escalation + Response Time ──────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Language Distribution Donut */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4, ease: easeCurve }}
        >
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl p-2 bg-indigo-500/10">
                  <Languages className="h-4 w-4 text-indigo-500" />
                </div>
                <CardTitle className="text-sm font-semibold">언어별 분포</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                {/* Donut */}
                <div className="w-[140px] h-[140px] flex-shrink-0">
                  <DonutChart
                    data={languageDistribution.map((l) => ({
                      label: l.language,
                      percentage: l.percentage,
                      color: l.color,
                    }))}
                  />
                </div>
                {/* Legend */}
                <div className="flex-1 space-y-1.5">
                  {languageDistribution.map((lang) => (
                    <div key={lang.code} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: lang.color }}
                        />
                        <span className="text-[12px] font-medium">{lang.language}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[11px] text-muted-foreground tabular-nums"
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {lang.count}건
                        </span>
                        <span
                          className="text-[11px] font-semibold tabular-nums w-8 text-right"
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {lang.percentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Escalation Reasons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.4, ease: easeCurve }}
        >
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-xl p-2 bg-orange-500/10">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                  </div>
                  <CardTitle className="text-sm font-semibold">에스컬레이션 사유</CardTitle>
                </div>
                <Badge variant="secondary" className="text-[11px] font-normal rounded-full">
                  총 {escalationReasons.reduce((s, r) => s + r.count, 0)}건
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {escalationReasons.map((item, index) => (
                  <div
                    key={item.reason}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    <span
                      className="text-[11px] font-bold text-muted-foreground w-4 text-center tabular-nums"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[12px] font-medium truncate">
                          {item.reason}
                        </span>
                        <Badge
                          variant="secondary"
                          className={`text-[9px] px-1.5 py-0 h-4 rounded-full ${getSeverityColor(item.severity)}`}
                        >
                          {item.severity === "critical"
                            ? "긴급"
                            : item.severity === "high"
                            ? "높음"
                            : "중간"}
                        </Badge>
                      </div>
                      <div className="h-1 bg-muted/50 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-orange-400/60 bar-grow progress-shine"
                          style={{
                            width: `${item.percentage}%`,
                            animationDelay: `${index * 100}ms`,
                          }}
                        />
                      </div>
                    </div>
                    <span
                      className="text-[11px] font-semibold text-muted-foreground tabular-nums w-8 text-right"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {item.count}건
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Response Time Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4, ease: easeCurve }}
        >
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-xl p-2 bg-emerald-500/10">
                    <Timer className="h-4 w-4 text-emerald-500" />
                  </div>
                  <CardTitle className="text-sm font-semibold">응답시간 분포</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {responseTimeDistribution.map((bucket, i) => {
                  const barWidth = (bucket.count / maxResponseCount) * 100;
                  const isGood = i < 2;
                  const isOk = i === 2 || i === 3;
                  const barColor = isGood
                    ? "bg-emerald-400/60"
                    : isOk
                    ? "bg-amber-400/60"
                    : "bg-rose-400/60";
                  return (
                    <div key={bucket.range} className="group">
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-medium text-muted-foreground w-14 text-right flex-shrink-0">
                          {bucket.range}
                        </span>
                        <div className="flex-1 h-5 bg-muted/30 rounded overflow-hidden relative">
                          <div
                            className={`h-full rounded ${barColor} bar-grow progress-shine flex items-center`}
                            style={{
                              width: `${barWidth}%`,
                              animationDelay: `${i * 80}ms`,
                            }}
                          >
                            {barWidth > 20 && (
                              <span
                                className="text-[10px] font-semibold text-foreground/70 ml-2 tabular-nums"
                                style={{ fontVariantNumeric: "tabular-nums" }}
                              >
                                {bucket.count}
                              </span>
                            )}
                          </div>
                          {barWidth <= 20 && (
                            <span
                              className="absolute left-[calc(var(--bar-w)+8px)] top-1/2 -translate-y-1/2 text-[10px] font-semibold text-muted-foreground tabular-nums"
                              style={
                                {
                                  "--bar-w": `${barWidth}%`,
                                  fontVariantNumeric: "tabular-nums",
                                } as React.CSSProperties
                              }
                            >
                              {bucket.count}
                            </span>
                          )}
                        </div>
                        <span
                          className="text-[11px] text-muted-foreground tabular-nums w-8 text-right flex-shrink-0"
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {bucket.percentage}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Summary */}
              <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">
                  3분 이내 응답:
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 ml-1 tabular-nums">
                    {(() => {
                      const under3 = responseTimeDistribution.slice(0, 3).reduce((s, b) => s + b.count, 0);
                      const total = responseTimeDistribution.reduce((s, b) => s + b.count, 0);
                      return total > 0 ? ((under3 / total) * 100).toFixed(1) : "0.0";
                    })()}%
                  </span>
                </span>
                <span className="text-muted-foreground">
                  총 샘플:
                  <span className="font-semibold text-foreground ml-1 tabular-nums">
                    {responseTimeDistribution.reduce((s, b) => s + b.count, 0).toLocaleString()}건
                  </span>
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Tenant Performance Table ──────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.4, ease: easeCurve }}
      >
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl p-2 bg-sky-500/10">
                  <Building className="h-4 w-4 text-sky-500" />
                </div>
                <CardTitle className="text-sm font-semibold">거래처별 성과 비교</CardTitle>
              </div>
              <Badge variant="secondary" className="text-[11px] font-normal rounded-full">
                {tenantPerformance.length}개 거래처
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-[11px] font-semibold text-muted-foreground text-left py-2.5 pr-4 uppercase tracking-wider">
                      거래처
                    </th>
                    <th className="text-[11px] font-semibold text-muted-foreground text-right py-2.5 px-4 uppercase tracking-wider">
                      대화 수
                    </th>
                    <th className="text-[11px] font-semibold text-muted-foreground text-right py-2.5 px-4 uppercase tracking-wider">
                      AI 정확도
                    </th>
                    <th className="text-[11px] font-semibold text-muted-foreground text-right py-2.5 px-4 uppercase tracking-wider">
                      에스컬레이션
                    </th>
                    <th className="text-[11px] font-semibold text-muted-foreground text-right py-2.5 px-4 uppercase tracking-wider">
                      CSAT
                    </th>
                    <th className="text-[11px] font-semibold text-muted-foreground text-right py-2.5 px-4 uppercase tracking-wider">
                      응답시간
                    </th>
                    <th className="text-[11px] font-semibold text-muted-foreground text-right py-2.5 pl-4 uppercase tracking-wider">
                      변화
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tenantPerformance.map((tenant) => (
                    <tr
                      key={tenant.name}
                      className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                            <span className="text-xs font-bold text-primary">
                              {tenant.name.charAt(0)}
                            </span>
                          </div>
                          <span className="text-sm font-medium">{tenant.name}</span>
                        </div>
                      </td>
                      <td
                        className="py-3 px-4 text-right text-sm tabular-nums"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {tenant.conversations.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`text-sm font-medium tabular-nums ${
                            tenant.aiAccuracy >= 90
                              ? "text-emerald-600 dark:text-emerald-400"
                              : tenant.aiAccuracy >= 85
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {tenant.aiAccuracy}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`text-sm tabular-nums ${
                            tenant.escalationRate <= 15
                              ? "text-emerald-600 dark:text-emerald-400"
                              : tenant.escalationRate <= 20
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {tenant.escalationRate}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span
                            className="text-sm font-medium tabular-nums"
                            style={{ fontVariantNumeric: "tabular-nums" }}
                          >
                            {tenant.satisfaction}
                          </span>
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <div
                                key={star}
                                className={`h-1.5 w-1.5 rounded-full mx-px ${
                                  star <= Math.round(tenant.satisfaction)
                                    ? "bg-amber-400"
                                    : "bg-muted"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </td>
                      <td
                        className="py-3 px-4 text-right text-sm tabular-nums"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {tenant.avgResponse}분
                      </td>
                      <td className="py-3 pl-4 text-right">
                        <div
                          className={`inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums px-1.5 py-0.5 rounded-full ${
                            tenant.trend === "up"
                              ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                              : "text-rose-600 dark:text-rose-400 bg-rose-500/10"
                          }`}
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {tenant.trend === "up" ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {tenant.change > 0 ? "+" : ""}
                          {tenant.change}%
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Insights Row ──────────────────────────────────────────── */}
      <motion.div
        className="grid gap-4 lg:grid-cols-3 stagger-children"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <Card className="border-0 shadow-sm rounded-2xl overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.03] to-emerald-600/[0.01]" />
            <CardContent className="p-4 relative">
              <div className="flex items-start gap-3">
                <div className="rounded-xl p-2 bg-emerald-500/10 flex-shrink-0">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">
                    좋은 성과
                  </p>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    LINE 채널 문의량이 전주 대비 <span className="font-semibold text-foreground">8.5%</span> 증가했습니다.
                    일본 시장 마케팅 효과가 나타나고 있으며, AI 자동 해결율도 <span className="font-semibold text-foreground">82.3%</span>로
                    목표치를 초과 달성했습니다.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-0 shadow-sm rounded-2xl overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.03] to-amber-600/[0.01]" />
            <CardContent className="p-4 relative">
              <div className="flex items-start gap-3">
                <div className="rounded-xl p-2 bg-amber-500/10 flex-shrink-0">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">
                    개선 필요
                  </p>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    서울성형의 AI 정확도가 <span className="font-semibold text-foreground">85.3%</span>로 목표(90%) 미달입니다.
                    에스컬레이션율이 <span className="font-semibold text-foreground">21.2%</span>로 가장 높아
                    지식베이스 보강이 시급합니다.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-0 shadow-sm rounded-2xl overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.03] to-blue-600/[0.01]" />
            <CardContent className="p-4 relative">
              <div className="flex items-start gap-3">
                <div className="rounded-xl p-2 bg-blue-500/10 flex-shrink-0">
                  <Globe className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1">
                    추천 액션
                  </p>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    가격 협상 관련 에스컬레이션이 <span className="font-semibold text-foreground">25%</span>를 차지합니다.
                    가격 정책 FAQ를 보강하면 자동화율이 <span className="font-semibold text-foreground">5~8%</span>
                    향상될 것으로 예상됩니다.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
