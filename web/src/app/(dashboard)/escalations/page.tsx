"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Search,
  Filter,
  Flame,
  ArrowUpRight,
  Zap,
  Shield,
  UserPlus,
  Play,
  CheckCircle2,
  RotateCcw,
  Phone,
  Mail,
  Hash,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface TeamMember {
  id: string;
  name: string;
  avatar: string | null;
  role: string;
  activeEscalations: number;
  status: "online" | "away" | "offline";
}

interface Escalation {
  id: string;
  conversationId: string;
  customer: {
    name: string;
    country: string;
    avatar: string | null;
    email?: string;
    phone?: string;
  };
  tenant: {
    name: string;
  };
  channel: string;
  priority: "critical" | "high" | "medium" | "low";
  status: "open" | "in_progress" | "resolved";
  reason: string;
  aiConfidence: number;
  lastMessage: string;
  createdAt: string;
  assignedTo: TeamMember | null;
  resolvedAt?: string;
  slaDeadline: string;
}

// ────────────────────────────────────────────────────────────
// Mock Data
// ────────────────────────────────────────────────────────────

const teamMembers: TeamMember[] = [
  {
    id: "tm-1",
    name: "박상담사",
    avatar: null,
    role: "시니어 상담사",
    activeEscalations: 2,
    status: "online",
  },
  {
    id: "tm-2",
    name: "김매니저",
    avatar: null,
    role: "CS 매니저",
    activeEscalations: 1,
    status: "online",
  },
  {
    id: "tm-3",
    name: "이상담사",
    avatar: null,
    role: "상담사",
    activeEscalations: 3,
    status: "away",
  },
  {
    id: "tm-4",
    name: "정상담사",
    avatar: null,
    role: "주니어 상담사",
    activeEscalations: 0,
    status: "online",
  },
  {
    id: "tm-5",
    name: "최팀장",
    avatar: null,
    role: "팀장",
    activeEscalations: 1,
    status: "offline",
  },
];

const mockEscalations: Escalation[] = [
  {
    id: "1",
    conversationId: "conv-1",
    customer: {
      name: "김환자",
      country: "일본",
      avatar: null,
      email: "kim@example.jp",
      phone: "+81-90-1234-5678",
    },
    tenant: { name: "힐링안과" },
    channel: "line",
    priority: "critical",
    status: "open",
    reason: "긴급 키워드 감지: 통증이 심해요",
    aiConfidence: 0.45,
    lastMessage:
      "수술 후에 눈이 너무 아파요. 통증이 심해서 잠을 못자겠어요.",
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    assignedTo: null,
    slaDeadline: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  },
  {
    id: "2",
    conversationId: "conv-2",
    customer: {
      name: "이환자",
      country: "중국",
      avatar: null,
      email: "lee@example.cn",
    },
    tenant: { name: "스마일치과" },
    channel: "whatsapp",
    priority: "high",
    status: "in_progress",
    reason: "신뢰도 미달: 52.3%",
    aiConfidence: 0.52,
    lastMessage:
      "임플란트 수술 가격이랑 기간이 어떻게 되나요? 다른 병원 견적이랑 비교하고 싶어요.",
    createdAt: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
    assignedTo: teamMembers[0],
    slaDeadline: new Date(Date.now() + 35 * 60 * 1000).toISOString(),
  },
  {
    id: "3",
    conversationId: "conv-3",
    customer: {
      name: "박환자",
      country: "베트남",
      avatar: null,
      phone: "+84-912-345-678",
    },
    tenant: { name: "서울성형" },
    channel: "instagram",
    priority: "medium",
    status: "in_progress",
    reason: "가격 협상",
    aiConfidence: 0.68,
    lastMessage:
      "다른 병원에서는 더 싸게 해준다던데, 할인 가능한가요?",
    createdAt: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(),
    assignedTo: teamMembers[1],
    slaDeadline: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
  },
  {
    id: "4",
    conversationId: "conv-4",
    customer: {
      name: "최환자",
      country: "미국",
      avatar: null,
      email: "choi@example.com",
    },
    tenant: { name: "힐링안과" },
    channel: "facebook",
    priority: "low",
    status: "resolved",
    reason: "복잡한 의료 문의",
    aiConfidence: 0.71,
    lastMessage:
      "라식과 라섹 중에 뭐가 더 좋은가요? 근시가 심한 편이에요.",
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    assignedTo: teamMembers[0],
    resolvedAt: new Date(Date.now() - 3.5 * 60 * 60 * 1000).toISOString(),
    slaDeadline: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "5",
    conversationId: "conv-5",
    customer: {
      name: "田中太郎",
      country: "일본",
      avatar: null,
      email: "tanaka@example.jp",
    },
    tenant: { name: "강남뷰티" },
    channel: "line",
    priority: "critical",
    status: "open",
    reason: "수술 부작용 보고",
    aiConfidence: 0.32,
    lastMessage:
      "코 수술 후 3일째인데 부기가 너무 심하고 피가 나요. 긴급합니다.",
    createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    assignedTo: null,
    slaDeadline: new Date(Date.now() + 18 * 60 * 1000).toISOString(),
  },
  {
    id: "6",
    conversationId: "conv-6",
    customer: {
      name: "Nguyen Van",
      country: "베트남",
      avatar: null,
      phone: "+84-905-678-901",
    },
    tenant: { name: "서울성형" },
    channel: "kakao",
    priority: "high",
    status: "open",
    reason: "결제 문제 - 환불 요청",
    aiConfidence: 0.48,
    lastMessage:
      "예약금을 냈는데 취소하고 싶어요. 환불은 어떻게 하나요?",
    createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    assignedTo: null,
    slaDeadline: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
  },
  {
    id: "7",
    conversationId: "conv-7",
    customer: {
      name: "王小明",
      country: "중국",
      avatar: null,
      email: "wang@example.cn",
    },
    tenant: { name: "스마일치과" },
    channel: "wechat",
    priority: "medium",
    status: "in_progress",
    reason: "통역 필요 - 중국어 전문 상담",
    aiConfidence: 0.55,
    lastMessage:
      "我想了解一下牙齿矫正的费用和时间, 你们有中文客服吗?",
    createdAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
    assignedTo: teamMembers[2],
    slaDeadline: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  },
  {
    id: "8",
    conversationId: "conv-8",
    customer: {
      name: "Smith John",
      country: "미국",
      avatar: null,
      email: "smith@example.com",
      phone: "+1-555-0123",
    },
    tenant: { name: "힐링안과" },
    channel: "whatsapp",
    priority: "low",
    status: "resolved",
    reason: "일반 문의 - AI 한도 초과",
    aiConfidence: 0.78,
    lastMessage:
      "What are your operating hours? Can I visit without an appointment?",
    createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    assignedTo: teamMembers[3],
    resolvedAt: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
    slaDeadline: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
];

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

const priorityConfig: Record<
  string,
  { label: string; color: string; bg: string; border: string; dot: string }
> = {
  critical: {
    label: "긴급",
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    dot: "bg-red-500",
  },
  high: {
    label: "높음",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
    dot: "bg-orange-500",
  },
  medium: {
    label: "보통",
    color: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/20",
    dot: "bg-yellow-500",
  },
  low: {
    label: "낮음",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    dot: "bg-blue-500",
  },
};

const statusConfig: Record<
  string,
  { label: string; color: string; bg: string; icon: typeof Clock }
> = {
  open: {
    label: "대기 중",
    color: "text-red-500",
    bg: "bg-red-500/10",
    icon: Clock,
  },
  in_progress: {
    label: "처리 중",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    icon: MessageSquare,
  },
  resolved: {
    label: "해결됨",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    icon: CheckCircle,
  },
};

const channelConfig: Record<
  string,
  { label: string; className: string }
> = {
  line: { label: "LINE", className: "channel-line" },
  whatsapp: { label: "WhatsApp", className: "channel-whatsapp" },
  kakao: { label: "카카오", className: "channel-kakao" },
  instagram: { label: "Instagram", className: "channel-instagram" },
  facebook: { label: "Facebook", className: "channel-facebook" },
  wechat: { label: "WeChat", className: "bg-[#07C160] text-white" },
};

function formatElapsedTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "방금 전";
  if (diffMins < 60) return `${diffMins}분 경과`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    const remainMins = diffMins % 60;
    return remainMins > 0
      ? `${diffHours}시간 ${remainMins}분 경과`
      : `${diffHours}시간 경과`;
  }
  return `${Math.floor(diffHours / 24)}일 경과`;
}

function getSLARemaining(deadline: string): {
  text: string;
  urgency: "expired" | "critical" | "warning" | "ok";
  percent: number;
} {
  const now = new Date();
  const dl = new Date(deadline);
  const diffMs = dl.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins <= 0) {
    return { text: "SLA 초과", urgency: "expired", percent: 100 };
  }
  if (diffMins <= 10) {
    return {
      text: `${diffMins}분 남음`,
      urgency: "critical",
      percent: 90,
    };
  }
  if (diffMins <= 30) {
    return {
      text: `${diffMins}분 남음`,
      urgency: "warning",
      percent: 60,
    };
  }
  if (diffMins < 60) {
    return {
      text: `${diffMins}분 남음`,
      urgency: "ok",
      percent: 30,
    };
  }
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return {
    text: mins > 0 ? `${hours}시간 ${mins}분 남음` : `${hours}시간 남음`,
    urgency: "ok",
    percent: 10,
  };
}

const slaUrgencyColors: Record<string, string> = {
  expired: "text-red-500 bg-red-500/10",
  critical: "text-red-500 bg-red-500/10",
  warning: "text-amber-500 bg-amber-500/10",
  ok: "text-emerald-500 bg-emerald-500/10",
};

const slaBarColors: Record<string, string> = {
  expired: "bg-red-500",
  critical: "bg-red-500",
  warning: "bg-amber-500",
  ok: "bg-emerald-500",
};

// ────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: string }) {
  const config = priorityConfig[priority];
  if (!config) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${config.bg} ${config.color}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot} ${priority === "critical" ? "live-dot" : ""}`} />
      {config.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status];
  if (!config) return null;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${config.bg} ${config.color}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

function ChannelBadge({ channel }: { channel: string }) {
  const config = channelConfig[channel] || {
    label: channel,
    className: "bg-gray-500 text-white",
  };
  return (
    <span
      className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide ${config.className}`}
    >
      {config.label}
    </span>
  );
}

function SLAIndicator({
  deadline,
  status,
}: {
  deadline: string;
  status: string;
}) {
  const [sla, setSla] = useState(() => getSLARemaining(deadline));

  useEffect(() => {
    if (status === "resolved") return;
    const interval = setInterval(() => {
      setSla(getSLARemaining(deadline));
    }, 30000);
    return () => clearInterval(interval);
  }, [deadline, status]);

  if (status === "resolved") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500 font-medium tabular-nums">
        <CheckCircle2 className="h-3 w-3" />
        완료
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${slaUrgencyColors[sla.urgency]}`}
      >
        {sla.urgency === "expired" && (
          <AlertTriangle className="h-3 w-3" />
        )}
        {(sla.urgency === "critical" || sla.urgency === "warning") && (
          <Timer className="h-3 w-3" />
        )}
        {sla.urgency === "ok" && <Clock className="h-3 w-3" />}
        {sla.text}
      </span>
      <div className="h-1 w-16 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${slaBarColors[sla.urgency]}`}
          style={{ width: `${Math.min(sla.percent, 100)}%` }}
        />
      </div>
    </div>
  );
}

function TeamMemberStatusDot({ status }: { status: TeamMember["status"] }) {
  const colors: Record<string, string> = {
    online: "bg-emerald-500",
    away: "bg-amber-500",
    offline: "bg-gray-400",
  };
  return (
    <span
      className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-gray-900 ${colors[status]}`}
    />
  );
}

// ────────────────────────────────────────────────────────────
// Assign Dialog Component
// ────────────────────────────────────────────────────────────

function AssignDialog({
  escalation,
  onAssign,
}: {
  escalation: Escalation;
  onAssign: (escalationId: string, member: TeamMember) => void;
}) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredMembers = teamMembers.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="h-8 gap-1.5 rounded-lg bg-primary/90 hover:bg-primary text-primary-foreground shadow-sm"
        >
          <UserPlus className="h-3.5 w-3.5" />
          담당자 할당
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
              <Users className="h-4 w-4 text-primary" />
            </div>
            담당자 할당
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Escalation summary */}
          <div className="rounded-xl bg-muted/50 p-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <PriorityBadge priority={escalation.priority} />
              <span className="text-sm font-medium">
                {escalation.customer.name}
              </span>
              <span className="text-[11px] text-muted-foreground">
                ({escalation.customer.country})
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground line-clamp-1">
              {escalation.reason}
            </p>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="이름 또는 역할로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 rounded-lg border-0 bg-muted/50"
            />
          </div>

          {/* Team member list */}
          <div className="space-y-1 max-h-[260px] overflow-y-auto">
            {filteredMembers.map((member) => (
              <button
                key={member.id}
                onClick={() => {
                  onAssign(escalation.id, member);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/80 transition-colors text-left group"
              >
                <div className="relative">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={member.avatar || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                      {member.name.slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  <TeamMemberStatusDot status={member.status} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{member.name}</span>
                    {member.status === "online" && (
                      <span className="text-[10px] text-emerald-500 font-medium">
                        온라인
                      </span>
                    )}
                    {member.status === "away" && (
                      <span className="text-[10px] text-amber-500 font-medium">
                        자리비움
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {member.role} &middot; 활성{" "}
                    <span className="tabular-nums">
                      {member.activeEscalations}
                    </span>
                    건
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────────────────────
// Escalation Card Component
// ────────────────────────────────────────────────────────────

function EscalationCard({
  escalation,
  index,
  onAssign,
  onStatusChange,
}: {
  escalation: Escalation;
  index: number;
  onAssign: (escalationId: string, member: TeamMember) => void;
  onStatusChange: (escalationId: string, newStatus: string) => void;
}) {
  const priorityBarColors: Record<string, string> = {
    critical: "bg-gradient-to-b from-red-500 to-red-600",
    high: "bg-gradient-to-b from-orange-400 to-orange-500",
    medium: "bg-gradient-to-b from-yellow-400 to-yellow-500",
    low: "bg-gradient-to-b from-blue-400 to-blue-500",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
      transition={{ delay: index * 0.04, duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
    >
      <Card className="border-0 shadow-sm hover-lift overflow-hidden group">
        <div className="flex">
          {/* Priority indicator bar */}
          <div
            className={`w-1 min-h-full flex-shrink-0 ${priorityBarColors[escalation.priority]}`}
          />

          <CardContent className="flex-1 p-5">
            <div className="flex items-start gap-4">
              {/* Customer avatar */}
              <div className="flex-shrink-0 pt-0.5">
                <Avatar className="h-10 w-10 ring-2 ring-background shadow-sm">
                  <AvatarImage src={escalation.customer.avatar || undefined} />
                  <AvatarFallback
                    className={`text-sm font-semibold ${
                      escalation.priority === "critical"
                        ? "bg-red-500/10 text-red-600"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {escalation.customer.name.slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
              </div>

              {/* Main content */}
              <div className="flex-1 min-w-0 space-y-2.5">
                {/* Top row: channel, tenant, customer */}
                <div className="flex items-center gap-2 flex-wrap">
                  <ChannelBadge channel={escalation.channel} />
                  <span className="text-sm font-semibold text-foreground">
                    {escalation.customer.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {escalation.customer.country}
                  </span>
                  <span className="text-muted-foreground/40">&middot;</span>
                  <span className="text-[11px] text-muted-foreground font-medium">
                    {escalation.tenant.name}
                  </span>
                </div>

                {/* Last message */}
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                  {escalation.lastMessage}
                </p>

                {/* Badges row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <PriorityBadge priority={escalation.priority} />
                  <StatusBadge status={escalation.status} />
                  <span className="h-3.5 w-px bg-border" />
                  <span className="text-[11px] text-muted-foreground">
                    {escalation.reason}
                  </span>
                  <span className="h-3.5 w-px bg-border" />
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    AI 신뢰도: {(escalation.aiConfidence * 100).toFixed(1)}%
                  </span>
                </div>

                {/* Assignee row */}
                {escalation.assignedTo && (
                  <div className="flex items-center gap-2 pt-0.5">
                    <div className="relative">
                      <Avatar className="h-5 w-5">
                        <AvatarImage
                          src={escalation.assignedTo.avatar || undefined}
                        />
                        <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-semibold">
                          {escalation.assignedTo.name.slice(0, 1)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {escalation.assignedTo.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60">
                      ({escalation.assignedTo.role})
                    </span>
                  </div>
                )}
              </div>

              {/* Right section: SLA, time, actions */}
              <div className="flex flex-col items-end gap-3 flex-shrink-0">
                {/* SLA indicator */}
                <SLAIndicator
                  deadline={escalation.slaDeadline}
                  status={escalation.status}
                />

                {/* Time elapsed */}
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {formatElapsedTime(escalation.createdAt)}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {/* Status flow buttons */}
                  {escalation.status === "open" && (
                    <>
                      {!escalation.assignedTo ? (
                        <AssignDialog
                          escalation={escalation}
                          onAssign={onAssign}
                        />
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 rounded-lg border-0 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 hover:text-amber-700"
                          onClick={() =>
                            onStatusChange(escalation.id, "in_progress")
                          }
                        >
                          <Play className="h-3 w-3" />
                          처리 시작
                        </Button>
                      )}
                    </>
                  )}

                  {escalation.status === "in_progress" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 rounded-lg border-0 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 hover:text-emerald-700"
                      onClick={() =>
                        onStatusChange(escalation.id, "resolved")
                      }
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      해결 완료
                    </Button>
                  )}

                  {escalation.status === "resolved" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 gap-1.5 rounded-lg text-muted-foreground hover:text-foreground"
                      onClick={() =>
                        onStatusChange(escalation.id, "open")
                      }
                    >
                      <RotateCcw className="h-3 w-3" />
                      재오픈
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 rounded-lg text-muted-foreground hover:text-primary"
                  >
                    대화 보기
                    <ArrowUpRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </div>
      </Card>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────
// Stats Card Component
// ────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconBg,
  iconColor,
  valueColor,
  trend,
  trendLabel,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: typeof AlertTriangle;
  iconBg: string;
  iconColor: string;
  valueColor?: string;
  trend?: "up" | "down";
  trendLabel?: string;
}) {
  return (
    <Card className="border-0 shadow-sm hover-lift">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {title}
            </p>
            <p
              className={`text-2xl font-bold tabular-nums ${valueColor || "text-foreground"}`}
            >
              {value}
            </p>
            {trend && trendLabel ? (
              <div
                className={`flex items-center gap-1 text-[11px] font-medium ${
                  trend === "down" ? "text-emerald-500" : "text-red-500"
                }`}
              >
                <TrendingDown
                  className={`h-3 w-3 ${trend === "up" ? "rotate-180" : ""}`}
                />
                {trendLabel}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}
          >
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────
// Main Page Component
// ────────────────────────────────────────────────────────────

export default function EscalationsPage() {
  const [escalations, setEscalations] = useState<Escalation[]>(mockEscalations);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [tenantFilter, setTenantFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Derive unique tenants
  const tenants = useMemo(() => {
    const set = new Set(escalations.map((e) => e.tenant.name));
    return Array.from(set).sort();
  }, [escalations]);

  // Derive unique assignees
  const assignees = useMemo(() => {
    const map = new Map<string, string>();
    escalations.forEach((e) => {
      if (e.assignedTo) {
        map.set(e.assignedTo.id, e.assignedTo.name);
      }
    });
    return Array.from(map.entries());
  }, [escalations]);

  // Filter escalations
  const filteredEscalations = useMemo(() => {
    return escalations.filter((esc) => {
      const matchesStatus =
        statusFilter === "all" || esc.status === statusFilter;
      const matchesPriority =
        priorityFilter === "all" || esc.priority === priorityFilter;
      const matchesAssignee =
        assigneeFilter === "all" ||
        (assigneeFilter === "unassigned" && !esc.assignedTo) ||
        esc.assignedTo?.id === assigneeFilter;
      const matchesTenant =
        tenantFilter === "all" || esc.tenant.name === tenantFilter;
      const matchesSearch =
        !searchQuery ||
        esc.customer.name
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        esc.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
        esc.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()) ||
        esc.tenant.name.toLowerCase().includes(searchQuery.toLowerCase());
      return (
        matchesStatus &&
        matchesPriority &&
        matchesAssignee &&
        matchesTenant &&
        matchesSearch
      );
    });
  }, [
    escalations,
    statusFilter,
    priorityFilter,
    assigneeFilter,
    tenantFilter,
    searchQuery,
  ]);

  // Stats
  const stats = useMemo(() => {
    const openCount = escalations.filter((e) => e.status === "open").length;
    const criticalCount = escalations.filter(
      (e) => e.priority === "critical" && e.status !== "resolved"
    ).length;
    const resolvedToday = escalations.filter((e) => {
      if (!e.resolvedAt) return false;
      const resolved = new Date(e.resolvedAt);
      const today = new Date();
      return resolved.toDateString() === today.toDateString();
    }).length;
    const resolvedEscalations = escalations.filter((e) => e.resolvedAt);
    const avgResolutionMs =
      resolvedEscalations.length > 0
        ? resolvedEscalations.reduce((sum, e) => {
            return (
              sum +
              (new Date(e.resolvedAt!).getTime() -
                new Date(e.createdAt).getTime())
            );
          }, 0) / resolvedEscalations.length
        : 0;
    const avgResolutionMin = Math.round(avgResolutionMs / 60000);
    const total = escalations.length;
    const resolutionRate =
      total > 0
        ? Math.round((resolvedEscalations.length / total) * 100)
        : 0;

    return {
      openCount,
      criticalCount,
      avgResolutionMin,
      resolutionRate,
    };
  }, [escalations]);

  // Handlers
  const handleAssign = useCallback(
    (escalationId: string, member: TeamMember) => {
      setEscalations((prev) =>
        prev.map((esc) =>
          esc.id === escalationId
            ? { ...esc, assignedTo: member }
            : esc
        )
      );
    },
    []
  );

  const handleStatusChange = useCallback(
    (escalationId: string, newStatus: string) => {
      setEscalations((prev) =>
        prev.map((esc) => {
          if (esc.id !== escalationId) return esc;
          const updates: Partial<Escalation> = {
            status: newStatus as Escalation["status"],
          };
          if (newStatus === "resolved") {
            updates.resolvedAt = new Date().toISOString();
          }
          if (newStatus === "open") {
            updates.resolvedAt = undefined;
          }
          return { ...esc, ...updates };
        })
      );
    },
    []
  );

  const activeFilterCount = [
    statusFilter !== "all",
    priorityFilter !== "all",
    assigneeFilter !== "all",
    tenantFilter !== "all",
  ].filter(Boolean).length;

  const resetFilters = () => {
    setStatusFilter("all");
    setPriorityFilter("all");
    setAssigneeFilter("all");
    setTenantFilter("all");
    setSearchQuery("");
  };

  // ──────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-in-up">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
              <Shield className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                에스컬레이션
              </h1>
              <p className="text-sm text-muted-foreground">
                AI가 처리하지 못한 문의를 담당자가 직접 처리합니다
              </p>
            </div>
          </div>
        </div>

        {/* Live indicator */}
        <div className="flex items-center gap-2 rounded-full bg-muted/50 px-4 py-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 live-dot" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[11px] font-medium text-muted-foreground">
            실시간 모니터링
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4 stagger-children">
        <StatCard
          title="미처리 건수"
          value={stats.openCount}
          subtitle="즉시 처리 필요"
          icon={Flame}
          iconBg="bg-red-500/10"
          iconColor="text-red-500"
          valueColor="text-red-500"
        />
        <StatCard
          title="긴급 에스컬레이션"
          value={stats.criticalCount}
          subtitle="Critical 우선순위"
          icon={Zap}
          iconBg="bg-orange-500/10"
          iconColor="text-orange-500"
          valueColor="text-orange-500"
        />
        <StatCard
          title="평균 처리시간"
          value={`${stats.avgResolutionMin}분`}
          subtitle=""
          icon={Timer}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-500"
          trend="down"
          trendLabel="전일 대비 -5분"
        />
        <StatCard
          title="해결률"
          value={`${stats.resolutionRate}%`}
          subtitle=""
          icon={CheckCircle}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-500"
          valueColor="text-emerald-500"
          trend="down"
          trendLabel="전일 대비 +3%"
        />
      </div>

      {/* Filter Bar */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="고객명, 사유, 내용 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 rounded-lg border-0 bg-muted/50"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground mr-1">
                <Filter className="h-3.5 w-3.5" />
                필터
              </div>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="h-8 w-[130px] rounded-lg border-0 bg-muted/50 text-xs">
                  <SelectValue placeholder="우선순위" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모든 우선순위</SelectItem>
                  <SelectItem value="critical">긴급</SelectItem>
                  <SelectItem value="high">높음</SelectItem>
                  <SelectItem value="medium">보통</SelectItem>
                  <SelectItem value="low">낮음</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-[120px] rounded-lg border-0 bg-muted/50 text-xs">
                  <SelectValue placeholder="상태" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모든 상태</SelectItem>
                  <SelectItem value="open">대기 중</SelectItem>
                  <SelectItem value="in_progress">처리 중</SelectItem>
                  <SelectItem value="resolved">해결됨</SelectItem>
                </SelectContent>
              </Select>

              <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                <SelectTrigger className="h-8 w-[130px] rounded-lg border-0 bg-muted/50 text-xs">
                  <SelectValue placeholder="담당자" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모든 담당자</SelectItem>
                  <SelectItem value="unassigned">미배정</SelectItem>
                  {assignees.map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={tenantFilter} onValueChange={setTenantFilter}>
                <SelectTrigger className="h-8 w-[130px] rounded-lg border-0 bg-muted/50 text-xs">
                  <SelectValue placeholder="테넌트" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모든 테넌트</SelectItem>
                  {tenants.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-lg text-[11px] text-muted-foreground hover:text-foreground gap-1"
                  onClick={resetFilters}
                >
                  <RotateCcw className="h-3 w-3" />
                  초기화
                  <Badge
                    variant="secondary"
                    className="ml-0.5 h-4 w-4 p-0 flex items-center justify-center text-[10px] rounded-full"
                  >
                    {activeFilterCount}
                  </Badge>
                </Button>
              )}
            </div>
          </div>

          {/* Results count */}
          <div className="mt-3 flex items-center gap-2 border-t border-border/50 pt-3">
            <span className="text-[11px] text-muted-foreground">
              <span className="tabular-nums font-semibold text-foreground">
                {filteredEscalations.length}
              </span>
              건 표시 중
              {activeFilterCount > 0 && (
                <span>
                  {" "}
                  (전체{" "}
                  <span className="tabular-nums">{escalations.length}</span>건)
                </span>
              )}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Escalation List */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {filteredEscalations.map((esc, index) => (
            <EscalationCard
              key={esc.id}
              escalation={esc}
              index={index}
              onAssign={handleAssign}
              onStatusChange={handleStatusChange}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Empty State */}
      {filteredEscalations.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border-0 shadow-sm">
            <CardContent className="py-16 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10">
                <CheckCircle className="h-8 w-8 text-emerald-500" />
              </div>
              <h3 className="text-lg font-semibold mb-1.5">
                {activeFilterCount > 0
                  ? "조건에 맞는 에스컬레이션이 없습니다"
                  : "모든 에스컬레이션 처리 완료!"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {activeFilterCount > 0
                  ? "필터 조건을 변경하거나 초기화해 보세요."
                  : "현재 대기 중인 에스컬레이션이 없습니다."}
              </p>
              {activeFilterCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg border-0 bg-muted/50"
                  onClick={resetFilters}
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  필터 초기화
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
