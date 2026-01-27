"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  Bot,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowRight,
} from "lucide-react";
import { motion } from "framer-motion";

const stats = [
  {
    title: "신규 문의",
    value: "127",
    change: "+12%",
    trend: "up",
    icon: MessageSquare,
    description: "전일 대비",
  },
  {
    title: "AI 처리율",
    value: "82.3%",
    change: "+5.2%",
    trend: "up",
    icon: Bot,
    description: "자동 응답 비율",
  },
  {
    title: "평균 응답시간",
    value: "1.2분",
    change: "-0.3분",
    trend: "up",
    icon: Clock,
    description: "첫 응답까지",
  },
  {
    title: "에스컬레이션",
    value: "23",
    change: "-8건",
    trend: "up",
    icon: AlertTriangle,
    description: "미해결 건수",
  },
];

const recentConversations = [
  {
    id: 1,
    customer: "김환자",
    hospital: "힐링안과",
    channel: "line",
    message: "라식 수술 비용이 얼마인가요?",
    time: "2분 전",
    status: "ai_processing",
    country: "일본",
  },
  {
    id: 2,
    customer: "이환자",
    hospital: "스마일치과",
    channel: "kakao",
    message: "예약 변경하고 싶어요",
    time: "5분 전",
    status: "agent",
    country: "한국",
  },
  {
    id: 3,
    customer: "박환자",
    hospital: "서울성형",
    channel: "instagram",
    message: "Before/After 사진 보고 싶어요",
    time: "12분 전",
    status: "resolved",
    country: "대만",
  },
  {
    id: 4,
    customer: "John Smith",
    hospital: "힐링안과",
    channel: "whatsapp",
    message: "What's the price for LASIK?",
    time: "15분 전",
    status: "ai_complete",
    country: "미국",
  },
];

const channelStats = [
  { name: "LINE", count: 45, color: "bg-[#06C755]" },
  { name: "WhatsApp", count: 32, color: "bg-[#25D366]" },
  { name: "카카오톡", count: 28, color: "bg-[#FEE500]" },
  { name: "Instagram", count: 22, color: "bg-gradient-to-r from-[#f09433] to-[#bc1888]" },
];

const hospitalAccuracy = [
  { name: "힐링안과", accuracy: 92.1, trend: "up" },
  { name: "스마일치과", accuracy: 88.7, trend: "up" },
  { name: "서울성형", accuracy: 85.3, trend: "down" },
  { name: "강남피부과", accuracy: 91.5, trend: "up" },
];

function getStatusBadge(status: string) {
  switch (status) {
    case "ai_processing":
      return (
        <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/20">
          <span className="mr-1 h-1.5 w-1.5 rounded-full bg-purple-500 ai-thinking" />
          AI 분석 중
        </Badge>
      );
    case "ai_complete":
      return (
        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
          AI 완료
        </Badge>
      );
    case "agent":
      return (
        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
          담당자 처리
        </Badge>
      );
    case "resolved":
      return (
        <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
          해결됨
        </Badge>
      );
    default:
      return null;
  }
}

function getChannelBadge(channel: string) {
  const channels: Record<string, { bg: string; text: string; label: string }> = {
    line: { bg: "bg-[#06C755]", text: "text-white", label: "LINE" },
    whatsapp: { bg: "bg-[#25D366]", text: "text-white", label: "WhatsApp" },
    kakao: { bg: "bg-[#FEE500]", text: "text-[#3C1E1E]", label: "카카오" },
    instagram: { bg: "bg-gradient-to-r from-[#f09433] to-[#bc1888]", text: "text-white", label: "Instagram" },
    facebook: { bg: "bg-[#1877F2]", text: "text-white", label: "Facebook" },
  };
  const c = channels[channel] || { bg: "bg-gray-500", text: "text-white", label: channel };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">대시보드</h1>
          <p className="text-muted-foreground">오늘의 CS 현황을 한눈에 확인하세요</p>
        </div>
        <div className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("ko-KR", {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "long",
          })}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="flex items-center text-xs text-muted-foreground">
                  {stat.trend === "up" ? (
                    <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
                  ) : (
                    <TrendingDown className="mr-1 h-3 w-3 text-red-500" />
                  )}
                  <span className={stat.trend === "up" ? "text-green-500" : "text-red-500"}>
                    {stat.change}
                  </span>
                  <span className="ml-1">{stat.description}</span>
                </div>
              </CardContent>
              <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-primary/50 to-primary" />
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Conversations */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">실시간 대화</CardTitle>
            <a
              href="/inbox"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              전체보기 <ArrowRight className="h-3 w-3" />
            </a>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentConversations.map((conv, index) => (
                <motion.div
                  key={conv.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getChannelBadge(conv.channel)}
                      <span className="font-medium text-sm">{conv.hospital}</span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-sm">{conv.customer}</span>
                      <span className="text-xs text-muted-foreground">({conv.country})</span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{conv.message}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {getStatusBadge(conv.status)}
                    <span className="text-xs text-muted-foreground">{conv.time}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Channel Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">채널별 문의량</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {channelStats.map((channel) => (
                  <div key={channel.name} className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${channel.color}`} />
                    <span className="flex-1 text-sm">{channel.name}</span>
                    <span className="font-medium">{channel.count}</span>
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${channel.color}`}
                        style={{ width: `${(channel.count / 50) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Hospital AI Accuracy */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">거래처별 AI 정확도</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {hospitalAccuracy.map((hospital) => (
                  <div key={hospital.name} className="flex items-center gap-3">
                    <span className="flex-1 text-sm">{hospital.name}</span>
                    <div className="flex items-center gap-1">
                      {hospital.trend === "up" ? (
                        <TrendingUp className="h-3 w-3 text-green-500" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-500" />
                      )}
                      <span
                        className={`font-medium ${
                          hospital.accuracy >= 90
                            ? "text-green-500"
                            : hospital.accuracy >= 85
                            ? "text-yellow-500"
                            : "text-red-500"
                        }`}
                      >
                        {hospital.accuracy}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
