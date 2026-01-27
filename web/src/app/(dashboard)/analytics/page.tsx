"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bot,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  ThumbsUp,
  AlertTriangle,
  Globe,
  Building,
} from "lucide-react";
import { motion } from "framer-motion";

// Mock analytics data
const overviewStats = {
  totalConversations: 1247,
  totalConversationsChange: 12.5,
  aiProcessedRate: 82.3,
  aiProcessedRateChange: 5.2,
  avgResponseTime: 1.2,
  avgResponseTimeChange: -0.3,
  customerSatisfaction: 4.6,
  customerSatisfactionChange: 0.2,
};

const aiPerformance = {
  totalResponses: 1024,
  avgConfidence: 87.2,
  escalationRate: 17.7,
  learningImprovements: 8,
};

const channelStats = [
  { name: "LINE", count: 452, percentage: 36.2, change: 8.5 },
  { name: "WhatsApp", count: 325, percentage: 26.1, change: 12.3 },
  { name: "카카오톡", count: 278, percentage: 22.3, change: -2.1 },
  { name: "Instagram", count: 122, percentage: 9.8, change: 15.7 },
  { name: "Facebook", count: 70, percentage: 5.6, change: -5.2 },
];

const tenantPerformance = [
  {
    name: "힐링안과",
    conversations: 423,
    aiAccuracy: 92.1,
    escalationRate: 12.3,
    satisfaction: 4.8,
    trend: "up",
  },
  {
    name: "스마일치과",
    conversations: 356,
    aiAccuracy: 88.7,
    escalationRate: 15.8,
    satisfaction: 4.5,
    trend: "up",
  },
  {
    name: "서울성형",
    conversations: 298,
    aiAccuracy: 85.3,
    escalationRate: 21.2,
    satisfaction: 4.3,
    trend: "down",
  },
  {
    name: "강남피부과",
    conversations: 170,
    aiAccuracy: 91.5,
    escalationRate: 14.1,
    satisfaction: 4.6,
    trend: "up",
  },
];

const countryStats = [
  { country: "일본", flag: "🇯🇵", count: 412, percentage: 33.0 },
  { country: "중국", flag: "🇨🇳", count: 298, percentage: 23.9 },
  { country: "베트남", flag: "🇻🇳", count: 187, percentage: 15.0 },
  { country: "미국", flag: "🇺🇸", count: 156, percentage: 12.5 },
  { country: "대만", flag: "🇹🇼", count: 98, percentage: 7.9 },
  { country: "기타", flag: "🌍", count: 96, percentage: 7.7 },
];

const hourlyVolume = [
  { hour: "00", count: 12 },
  { hour: "02", count: 8 },
  { hour: "04", count: 5 },
  { hour: "06", count: 15 },
  { hour: "08", count: 45 },
  { hour: "10", count: 78 },
  { hour: "12", count: 65 },
  { hour: "14", count: 82 },
  { hour: "16", count: 91 },
  { hour: "18", count: 76 },
  { hour: "20", count: 54 },
  { hour: "22", count: 32 },
];

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">분석 및 리포트</h1>
          <p className="text-muted-foreground">CS 자동화 성과와 인사이트를 확인하세요</p>
        </div>
        <Select defaultValue="7d">
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="기간 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1d">오늘</SelectItem>
            <SelectItem value="7d">최근 7일</SelectItem>
            <SelectItem value="30d">최근 30일</SelectItem>
            <SelectItem value="90d">최근 90일</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                총 대화
              </CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {overviewStats.totalConversations.toLocaleString()}
              </div>
              <div className="flex items-center text-xs text-green-500">
                <TrendingUp className="mr-1 h-3 w-3" />
                +{overviewStats.totalConversationsChange}% 전주 대비
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                AI 처리율
              </CardTitle>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overviewStats.aiProcessedRate}%</div>
              <div className="flex items-center text-xs text-green-500">
                <TrendingUp className="mr-1 h-3 w-3" />
                +{overviewStats.aiProcessedRateChange}%
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                평균 응답시간
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overviewStats.avgResponseTime}분</div>
              <div className="flex items-center text-xs text-green-500">
                <TrendingDown className="mr-1 h-3 w-3" />
                {overviewStats.avgResponseTimeChange}분
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                고객 만족도
              </CardTitle>
              <ThumbsUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {overviewStats.customerSatisfaction}/5.0
              </div>
              <div className="flex items-center text-xs text-green-500">
                <TrendingUp className="mr-1 h-3 w-3" />
                +{overviewStats.customerSatisfactionChange}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* AI Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              AI 성과 분석
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">총 AI 응답</p>
                <p className="text-2xl font-bold">{aiPerformance.totalResponses.toLocaleString()}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">평균 신뢰도</p>
                <p className="text-2xl font-bold text-green-500">
                  {aiPerformance.avgConfidence}%
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">에스컬레이션율</p>
                <p className="text-2xl font-bold text-yellow-500">
                  {aiPerformance.escalationRate}%
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">학습 개선 건수</p>
                <p className="text-2xl font-bold text-blue-500">
                  +{aiPerformance.learningImprovements}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-sm font-medium mb-3">시간대별 문의량</p>
              <div className="flex items-end gap-1 h-24">
                {hourlyVolume.map((item) => (
                  <div
                    key={item.hour}
                    className="flex-1 bg-primary/20 hover:bg-primary/40 transition-colors rounded-t"
                    style={{ height: `${(item.count / 100) * 100}%` }}
                    title={`${item.hour}시: ${item.count}건`}
                  />
                ))}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>00시</span>
                <span>12시</span>
                <span>24시</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Channel Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              채널별 성과
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {channelStats.map((channel) => (
                <div key={channel.name} className="flex items-center gap-4">
                  <div className="w-20 text-sm font-medium">{channel.name}</div>
                  <div className="flex-1">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${channel.percentage}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-16 text-right text-sm">{channel.count}건</div>
                  <div
                    className={`w-16 text-right text-xs ${
                      channel.change >= 0 ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {channel.change >= 0 ? "+" : ""}
                    {channel.change}%
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tenant Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              거래처별 성과
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {tenantPerformance.map((tenant) => (
                <div
                  key={tenant.name}
                  className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{tenant.name}</span>
                    {tenant.trend === "up" ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">대화</p>
                      <p className="font-medium">{tenant.conversations}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">AI 정확도</p>
                      <p
                        className={`font-medium ${
                          tenant.aiAccuracy >= 90
                            ? "text-green-500"
                            : tenant.aiAccuracy >= 85
                            ? "text-yellow-500"
                            : "text-red-500"
                        }`}
                      >
                        {tenant.aiAccuracy}%
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">에스컬레이션</p>
                      <p className="font-medium">{tenant.escalationRate}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">만족도</p>
                      <p className="font-medium">{tenant.satisfaction}/5</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Country Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              국가별 분포
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {countryStats.map((country) => (
                <div key={country.country} className="flex items-center gap-3">
                  <span className="text-2xl">{country.flag}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{country.country}</span>
                      <span className="text-sm text-muted-foreground">
                        {country.count}건 ({country.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary/60 rounded-full"
                        style={{ width: `${country.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Cards */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Top Issues */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              주요 에스컬레이션 사유
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { reason: "신뢰도 미달", count: 45, percentage: 35.2 },
                { reason: "가격 협상", count: 32, percentage: 25.0 },
                { reason: "복잡한 의료 문의", count: 28, percentage: 21.9 },
                { reason: "불만/컴플레인", count: 15, percentage: 11.7 },
                { reason: "긴급 상황", count: 8, percentage: 6.2 },
              ].map((item, index) => (
                <div key={item.reason} className="flex items-center gap-3">
                  <Badge variant="outline" className="w-6 h-6 p-0 justify-center">
                    {index + 1}
                  </Badge>
                  <span className="flex-1 text-sm">{item.reason}</span>
                  <span className="text-sm text-muted-foreground">{item.count}건</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Agents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              상담사 실적
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { name: "김매니저", resolved: 45, avgTime: 32, satisfaction: 4.9 },
                { name: "박상담사", resolved: 38, avgTime: 41, satisfaction: 4.7 },
                { name: "이상담사", resolved: 29, avgTime: 38, satisfaction: 4.6 },
                { name: "최상담사", resolved: 24, avgTime: 45, satisfaction: 4.5 },
              ].map((agent, index) => (
                <div
                  key={agent.name}
                  className="flex items-center gap-3 p-2 rounded bg-muted/50"
                >
                  <Badge variant="outline" className="w-6 h-6 p-0 justify-center">
                    {index + 1}
                  </Badge>
                  <span className="flex-1 text-sm font-medium">{agent.name}</span>
                  <div className="text-xs text-muted-foreground">
                    {agent.resolved}건 | {agent.avgTime}분 | ⭐{agent.satisfaction}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Insights */}
        <Card>
          <CardHeader>
            <CardTitle>주요 인사이트</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-sm font-medium text-green-500">👍 좋은 성과</p>
                <p className="text-xs text-muted-foreground mt-1">
                  LINE 채널 문의량이 전주 대비 8.5% 증가했습니다. 일본 시장 마케팅
                  효과가 나타나고 있습니다.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-sm font-medium text-yellow-500">⚠️ 개선 필요</p>
                <p className="text-xs text-muted-foreground mt-1">
                  서울성형의 AI 정확도가 85.3%로 목표(90%) 미달입니다. 지식베이스
                  보강이 필요합니다.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-sm font-medium text-blue-500">💡 추천</p>
                <p className="text-xs text-muted-foreground mt-1">
                  가격 협상 관련 에스컬레이션이 25%를 차지합니다. 가격 정책 FAQ를
                  보강하면 자동화율이 향상될 것으로 예상됩니다.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
