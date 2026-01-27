"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  User,
  MessageSquare,
  ArrowRight,
  TrendingDown,
  Timer,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";

// Mock escalation data
const mockEscalations = [
  {
    id: "1",
    conversationId: "conv-1",
    customer: {
      name: "김환자",
      country: "일본",
      avatar: null,
    },
    tenant: {
      name: "힐링안과",
    },
    channel: "line",
    priority: "urgent",
    status: "pending",
    reason: "긴급 키워드 감지: 통증이 심해요",
    aiConfidence: 0.45,
    lastMessage: "수술 후에 눈이 너무 아파요. 통증이 심해서 잠을 못자겠어요.",
    createdAt: "2024-01-27T14:30:00Z",
    assignedTo: null,
  },
  {
    id: "2",
    conversationId: "conv-2",
    customer: {
      name: "이환자",
      country: "중국",
      avatar: null,
    },
    tenant: {
      name: "스마일치과",
    },
    channel: "whatsapp",
    priority: "high",
    status: "assigned",
    reason: "신뢰도 미달: 52.3%",
    aiConfidence: 0.52,
    lastMessage: "임플란트 수술 가격이랑 기간이 어떻게 되나요? 다른 병원 견적이랑 비교하고 싶어요.",
    createdAt: "2024-01-27T13:45:00Z",
    assignedTo: {
      name: "박상담사",
      avatar: null,
    },
  },
  {
    id: "3",
    conversationId: "conv-3",
    customer: {
      name: "박환자",
      country: "베트남",
      avatar: null,
    },
    tenant: {
      name: "서울성형",
    },
    channel: "instagram",
    priority: "medium",
    status: "in_progress",
    reason: "가격 협상",
    aiConfidence: 0.68,
    lastMessage: "다른 병원에서는 더 싸게 해준다던데, 할인 가능한가요?",
    createdAt: "2024-01-27T12:20:00Z",
    assignedTo: {
      name: "김매니저",
      avatar: null,
    },
  },
  {
    id: "4",
    conversationId: "conv-4",
    customer: {
      name: "최환자",
      country: "미국",
      avatar: null,
    },
    tenant: {
      name: "힐링안과",
    },
    channel: "facebook",
    priority: "low",
    status: "resolved",
    reason: "복잡한 의료 문의",
    aiConfidence: 0.71,
    lastMessage: "라식과 라섹 중에 뭐가 더 좋은가요? 근시가 심한 편이에요.",
    createdAt: "2024-01-27T10:00:00Z",
    assignedTo: {
      name: "박상담사",
      avatar: null,
    },
    resolvedAt: "2024-01-27T11:30:00Z",
  },
];

const stats = {
  pending: 5,
  inProgress: 3,
  avgResolutionTime: 45, // minutes
  todayResolved: 12,
};

function getPriorityBadge(priority: string) {
  switch (priority) {
    case "urgent":
      return (
        <Badge className="bg-red-500 hover:bg-red-600">
          <AlertTriangle className="mr-1 h-3 w-3" />
          긴급
        </Badge>
      );
    case "high":
      return (
        <Badge className="bg-orange-500 hover:bg-orange-600">높음</Badge>
      );
    case "medium":
      return (
        <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black">
          보통
        </Badge>
      );
    case "low":
      return (
        <Badge variant="secondary">낮음</Badge>
      );
    default:
      return null;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "pending":
      return (
        <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
          <Clock className="mr-1 h-3 w-3" />
          대기 중
        </Badge>
      );
    case "assigned":
      return (
        <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
          <User className="mr-1 h-3 w-3" />
          할당됨
        </Badge>
      );
    case "in_progress":
      return (
        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
          <MessageSquare className="mr-1 h-3 w-3" />
          처리 중
        </Badge>
      );
    case "resolved":
      return (
        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
          <CheckCircle className="mr-1 h-3 w-3" />
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

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 60) return `${diffMins}분 전`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;
  return `${Math.floor(diffHours / 24)}일 전`;
}

export default function EscalationsPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const filteredEscalations = mockEscalations.filter((esc) => {
    const matchesStatus = statusFilter === "all" || esc.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || esc.priority === priorityFilter;
    return matchesStatus && matchesPriority;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">에스컬레이션</h1>
          <p className="text-muted-foreground">AI가 처리하지 못한 문의를 담당자가 직접 처리합니다</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-red-500/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                대기 중
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">즉시 처리 필요</p>
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
                처리 중
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.inProgress}</div>
              <p className="text-xs text-muted-foreground">담당자 배정됨</p>
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
                평균 처리시간
              </CardTitle>
              <Timer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgResolutionTime}분</div>
              <div className="flex items-center text-xs text-green-500">
                <TrendingDown className="mr-1 h-3 w-3" />
                전일 대비 -5분
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
                오늘 해결
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                {stats.todayResolved}
              </div>
              <p className="text-xs text-muted-foreground">건 처리 완료</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="상태 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 상태</SelectItem>
                <SelectItem value="pending">대기 중</SelectItem>
                <SelectItem value="assigned">할당됨</SelectItem>
                <SelectItem value="in_progress">처리 중</SelectItem>
                <SelectItem value="resolved">해결됨</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="우선순위 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 우선순위</SelectItem>
                <SelectItem value="urgent">긴급</SelectItem>
                <SelectItem value="high">높음</SelectItem>
                <SelectItem value="medium">보통</SelectItem>
                <SelectItem value="low">낮음</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Escalations List */}
      <div className="space-y-4">
        {filteredEscalations.map((esc, index) => (
          <motion.div
            key={esc.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card
              className={`hover:bg-muted/50 transition-colors cursor-pointer ${
                esc.priority === "urgent" ? "border-red-500/30" : ""
              }`}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={esc.customer.avatar || undefined} />
                    <AvatarFallback className="bg-primary/10">
                      {esc.customer.name.slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getChannelBadge(esc.channel)}
                      <span className="font-medium">{esc.tenant.name}</span>
                      <span className="text-muted-foreground">•</span>
                      <span>{esc.customer.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({esc.customer.country})
                      </span>
                    </div>

                    <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                      {esc.lastMessage}
                    </p>

                    <div className="flex items-center gap-3 flex-wrap">
                      {getPriorityBadge(esc.priority)}
                      {getStatusBadge(esc.status)}
                      <span className="text-xs text-muted-foreground">
                        사유: {esc.reason}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        AI 신뢰도: {(esc.aiConfidence * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatTimeAgo(esc.createdAt)}
                    </span>

                    {esc.assignedTo ? (
                      <div className="flex items-center gap-2 text-xs">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={esc.assignedTo.avatar || undefined} />
                          <AvatarFallback className="text-[10px]">
                            {esc.assignedTo.name.slice(0, 1)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-muted-foreground">
                          {esc.assignedTo.name}
                        </span>
                      </div>
                    ) : (
                      <Button size="sm" className="h-7">
                        담당자 할당
                      </Button>
                    )}

                    <Button variant="ghost" size="sm" className="h-7 gap-1">
                      대화 보기
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {filteredEscalations.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500/50 mb-4" />
            <h3 className="font-medium text-lg mb-2">모든 에스컬레이션 처리 완료!</h3>
            <p className="text-muted-foreground">
              현재 대기 중인 에스컬레이션이 없습니다.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
