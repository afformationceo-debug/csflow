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
    id?: string;
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
  // NEW: Enhanced fields for AI request UI
  customerQuestion?: string;
  aiReasoning?: string;
  detectedQuestions?: string[]; // Example questions from AI analysis
  recommendedAction?: "knowledge_base" | "tenant_info";
  missingInfo?: string[];
}

// Mock data removed -- data is now fetched from /api/escalations

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
      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${config.className}`}
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
          className={`h-full rounded-full transition-all duration-500 progress-shine ${slaBarColors[sla.urgency]}`}
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
  teamMembersList,
}: {
  escalation: Escalation;
  onAssign: (escalationId: string, member: TeamMember) => void;
  teamMembersList: TeamMember[];
}) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredMembers = teamMembersList.filter((m) =>
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
// Update Knowledge Base Dialog
// ────────────────────────────────────────────────────────────

function UpdateKnowledgeBaseDialog({
  escalation,
  onUpdate,
}: {
  escalation: Escalation;
  onUpdate: (data: { title: string; content: string; category: string; tags: string[] }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("medical");
  const [tags, setTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-fill with example based on escalation and AI-detected questions
  const handleOpen = () => {
    // Use AI-detected questions if available, otherwise use customer question
    const detectedQ = escalation.detectedQuestions?.[0] || escalation.customerQuestion || escalation.lastMessage;

    // Generate short, clear title (RAG-optimized)
    const suggestedTitle = generateKBTitle(detectedQ);

    // Generate RAG-optimized content (clear, structured, query-friendly)
    const suggestedContent = generateKBExample(detectedQ);

    setTitle(suggestedTitle);
    setContent(suggestedContent);

    // Smart tag generation based on detected topic
    const detectedTags = extractTagsFromQuestion(detectedQ);
    setTags([escalation.tenant.name, escalation.channel, ...detectedTags]);

    setOpen(true);
  };

  // Helper: Generate short, clear KB title (RAG-optimized)
  const generateKBTitle = (question: string): string => {
    const q = question.toLowerCase();
    const hospitalName = escalation.tenant.name || "OO병원";

    if (/예약|booking|reservation|appointment/i.test(q)) return "예약가능날짜";
    if (/가격|비용|price|cost|얼마/i.test(q)) return "시술가격";
    if (/시간|영업|언제|when|hours/i.test(q)) return "영업시간";
    if (/위치|주소|location|address|찾아오/i.test(q)) return "병원위치";
    if (/의사|doctor|선생님/i.test(q)) return "의료진정보";
    if (/회복|recovery|기간|period/i.test(q)) return "회복기간";

    // Default: extract first meaningful noun
    return question.length > 20 ? question.slice(0, 20) : question;
  };

  // Helper: Generate RAG-optimized KB content (clear, structured, query-friendly)
  const generateKBExample = (question: string): string => {
    const q = question.toLowerCase();
    const hospitalName = escalation.tenant.name || "OO병원";

    if (/예약|booking|reservation|appointment/i.test(q)) {
      return `${hospitalName} 예약가능 날짜는 월요일 오전 9시부터 오후 6시까지, 화요일 오전 9시부터 오후 6시까지, 수요일 오전 9시부터 오후 6시까지, 목요일 오전 9시부터 오후 6시까지, 금요일 오전 9시부터 오후 6시까지, 토요일 오전 9시부터 오후 1시까지입니다. 일요일과 공휴일은 휴무입니다.

예약 방법은 전화 [전화번호], 카카오톡 [채널명], 온라인 예약 [URL]로 가능합니다.

예약시 신분증을 지참해주세요.`;
    }

    if (/가격|비용|price|cost|얼마/i.test(q)) {
      return `${hospitalName} 라식 수술 가격은 양안 기준 150만원입니다. 라섹 수술 가격은 180만원, 스마일라식 가격은 250만원입니다.

가격에는 정밀 검사, 시술 비용, 1개월 사후관리, 안약 처방이 포함됩니다.

조기 예약 시 10% 할인, 학생은 5% 추가 할인됩니다.`;
    }

    if (/시간|영업|언제|when|hours/i.test(q)) {
      return `${hospitalName} 영업시간은 월요일부터 금요일까지 오전 9시부터 오후 6시까지이고, 토요일은 오전 9시부터 오후 1시까지입니다. 일요일과 공휴일은 휴무입니다.

점심시간은 오후 12시부터 오후 1시까지이며, 응급 상담은 점심시간에도 가능합니다.`;
    }

    if (/위치|주소|location|address|찾아오/i.test(q)) {
      return `${hospitalName} 주소는 [시/도] [구/군] [도로명] [건물번호]입니다. [건물명] [층]에 위치해있습니다.

지하철은 [호선] [역명] [번 출구]에서 도보 [분] 거리입니다. 버스는 [버스번호]를 타고 [정류장명]에서 하차하시면 됩니다.

주차는 건물 지하 주차장 이용 가능하며, 2시간 무료입니다.`;
    }

    if (/의사|doctor|선생님|staff/i.test(q)) {
      return `${hospitalName} 의료진은 [의사명] 원장 (전문 분야: [분야], 경력: [년]년), [의사명] 과장 (전문 분야: [분야], 경력: [년]년)입니다.

모든 의료진은 [관련 학회] 정회원이며, [자격증/인증] 보유자입니다.`;
    }

    if (/회복|recovery|기간|period/i.test(q)) {
      return `${hospitalName} 라식 수술 회복기간은 수술 당일 약간의 눈물과 이물감이 있을 수 있으며, 1~2일 후 대부분의 불편감이 사라집니다. 1주일 후 시력이 안정화되기 시작하고, 1개월 후 최종 시력에 도달합니다. 3개월 후 완전히 회복됩니다.

수술 후 1주일간 눈에 물이 들어가지 않도록 주의하고, 정기 검진(1일, 1주일, 1개월, 3개월)을 받으셔야 합니다.`;
    }

    // Default template
    return `${hospitalName}에서 고객님의 질문 "${question}"에 대한 답변입니다.

[여기에 구체적이고 정확한 답변을 "OO병원의 XXX는 YYY입니다" 형식으로 작성해주세요]

[추가 관련 정보가 있다면 같은 형식으로 계속 작성해주세요]`;
  };

  // Helper: Extract relevant tags from question
  const extractTagsFromQuestion = (question: string): string[] => {
    const q = question.toLowerCase();
    const tags: string[] = [];

    if (/예약|booking|reservation/i.test(q)) tags.push("예약");
    if (/가격|비용|price|cost/i.test(q)) tags.push("가격");
    if (/시간|영업|hours/i.test(q)) tags.push("영업시간");
    if (/위치|주소|location/i.test(q)) tags.push("위치");
    if (/라식|lasik/i.test(q)) tags.push("라식");
    if (/라섹|lasek/i.test(q)) tags.push("라섹");
    if (/일본|japan/i.test(q)) tags.push("일본");
    if (/중국|china/i.test(q)) tags.push("중국");

    return tags;
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      // Call API to create knowledge base document
      const response = await fetch("/api/knowledge/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: escalation.tenant.id || "default-tenant-id", // TODO: Get actual tenant ID
          title,
          content,
          category,
          tags,
          metadata: {
            source: "escalation",
            escalation_id: escalation.id,
            conversation_id: escalation.conversationId,
            customer_question: escalation.customerQuestion || escalation.lastMessage,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create knowledge document");
      }

      const data = await response.json();
      console.log("✅ Knowledge document created:", data.document.id);

      // Generate embeddings
      const embedResponse = await fetch(`/api/knowledge/documents/${data.document.id}/embed`, {
        method: "POST",
      });

      if (!embedResponse.ok) {
        console.warn("⚠️ Embedding generation failed, but document is saved");
      } else {
        console.log("✅ Embeddings generated successfully");
      }

      // Call parent onUpdate callback
      onUpdate({ title, content, category, tags });
      setOpen(false);
    } catch (error) {
      console.error("❌ Error creating knowledge document:", error);
      alert("지식베이스 업데이트 실패: " + (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={handleOpen}
        className="h-8 gap-1.5 rounded-lg border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
      >
        <Hash className="h-3.5 w-3.5" />
        지식베이스 업데이트
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10">
                <Hash className="h-4 w-4 text-amber-600" />
              </div>
              지식베이스에 추가
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Context */}
            <div className="rounded-xl bg-gradient-to-r from-blue-500/5 to-violet-500/5 border border-blue-500/20 p-4 space-y-2">
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">📋 에스컬레이션 컨텍스트</p>
              <p className="text-xs text-muted-foreground">
                고객: {escalation.customer.name} ({escalation.customer.country})
              </p>
              <p className="text-xs text-muted-foreground">
                질문: {escalation.customerQuestion || escalation.lastMessage}
              </p>
            </div>

            {/* Form */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="kb-title" className="text-sm font-medium">
                  제목 <span className="text-xs text-muted-foreground">(지식베이스 문서 제목)</span>
                </Label>
                <Input
                  id="kb-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 라식 수술 가격 및 절차 안내"
                  className="h-9 rounded-lg"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="kb-category" className="text-sm font-medium">
                  카테고리
                </Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="kb-category" className="h-9 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="medical">의료/시술</SelectItem>
                    <SelectItem value="pricing">가격 정보</SelectItem>
                    <SelectItem value="booking">예약/일정</SelectItem>
                    <SelectItem value="faq">자주 묻는 질문</SelectItem>
                    <SelectItem value="policy">정책/규정</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="kb-content" className="text-sm font-medium">
                  내용 <span className="text-xs text-muted-foreground">(예시가 포함되어 있습니다. 수정해주세요)</span>
                </Label>
                <textarea
                  id="kb-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={10}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="질문과 답변을 자세히 작성해주세요..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="kb-tags" className="text-sm font-medium">
                  태그 <span className="text-xs text-muted-foreground">(쉼표로 구분)</span>
                </Label>
                <Input
                  id="kb-tags"
                  value={tags.join(", ")}
                  onChange={(e) => setTags(e.target.value.split(",").map(t => t.trim()).filter(Boolean))}
                  placeholder="예: 라식, 가격, 일본"
                  className="h-9 rounded-lg"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !title || !content}
                className="flex-1 h-9 rounded-lg bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
              >
                {isSubmitting ? "저장 중..." : "저장 및 해결 완료"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
                className="h-9 rounded-lg"
              >
                취소
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ────────────────────────────────────────────────────────────
// Update Tenant Info Dialog
// ────────────────────────────────────────────────────────────

function UpdateTenantInfoDialog({
  escalation,
  onUpdate,
}: {
  escalation: Escalation;
  onUpdate: (data: { field: string; value: string; notes: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [field, setField] = useState("operating_hours");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-fill with RAG-optimized example values based on escalation and AI-detected questions
  const handleOpen = () => {
    // Use AI-detected questions if available
    const detectedQ = escalation.detectedQuestions?.[0] || escalation.customerQuestion || escalation.lastMessage;
    const suggestedNotes = `에스컬레이션: ${escalation.reason}\nAI 감지 질문: ${detectedQ}`;
    setNotes(suggestedNotes);

    const hospitalName = escalation.tenant.name || "OO병원";

    // Auto-detect field type from detected question and generate RAG-optimized values
    const q = detectedQ.toLowerCase();
    if (/예약|booking|reservation|appointment|언제.*가능|available/i.test(q)) {
      setField("operating_hours");
      setValue(`${hospitalName} 예약가능 시간은 월요일 오전 9시부터 오후 6시, 화요일 오전 9시부터 오후 6시, 수요일 오전 9시부터 오후 6시, 목요일 오전 9시부터 오후 6시, 금요일 오전 9시부터 오후 6시, 토요일 오전 9시부터 오후 1시입니다. 일요일과 공휴일은 휴무입니다. 예약은 전화 [전화번호], 카카오톡 [채널명], 온라인 [URL]로 가능합니다.`);
    } else if (/가격|비용|price|cost|얼마|how much/i.test(q)) {
      setField("pricing");
      setValue(`${hospitalName} 라식 수술 가격은 양안 기준 150만원, 라섹 수술은 180만원, 스마일라식은 250만원, 노안라식은 300만원입니다. 가격에는 정밀 검사, 시술 비용, 1개월 사후관리, 안약 처방이 포함됩니다. 조기 예약시 10% 할인, 학생 5% 추가 할인됩니다.`);
    } else if (/위치|주소|어디|where|location|address|찾아오/i.test(q)) {
      setField("location");
      setValue(`${hospitalName} 주소는 [시/도] [구/군] [도로명] [번호] [건물명] [층]입니다. 지하철 [호선] [역명] [번 출구]에서 도보 [분] 거리이고, 버스 [번호]를 타고 [정류장명]에서 하차하시면 됩니다. 주차는 건물 지하 주차장 2시간 무료입니다.`);
    } else if (/연락|전화|이메일|contact|phone|email/i.test(q)) {
      setField("contact");
      setValue(`${hospitalName} 대표 전화번호는 02-1234-5678이고 예약 전용 번호는 02-1234-5679입니다. 응급 상담은 010-1234-5678로 가능합니다. 이메일은 일반 문의 info@example.com, 예약 문의 reservation@example.com입니다. 카카오톡 채널은 [병원명] 채널 ID @example입니다. 운영 시간은 평일 09:00~18:00, 토요일 09:00~13:00이며 일요일과 공휴일은 휴무입니다.`);
    } else if (/의사|doctor|선생님|staff/i.test(q)) {
      setField("doctors");
      setValue(`${hospitalName} 대표원장은 [이름] 원장이며 전문 분야는 [전문분야]이고 경력은 [경력]입니다. 진료 의사는 [이름1] 원장(전문분야: [분야1]), [이름2] 원장(전문분야: [분야2])입니다. 수술 건수는 연간 [건수]건 이상, 누적 [건수]건 이상입니다. 의료진 상담 예약은 전화 [전화번호] 또는 온라인 [URL]로 가능합니다.`);
    } else if (/장비|시설|equipment|facility/i.test(q)) {
      setField("equipment");
      setValue(`${hospitalName} 보유 장비는 [장비명1] [제조사/모델](용도: [용도]), [장비명2] [제조사/모델](용도: [용도]), [장비명3] [제조사/모델](용도: [용도])입니다. 시설은 무균 수술실 [개]실, 회복실 [개]실, 대기실 [평수]평이며 주차장은 [대]대 수용 가능합니다. [인증/수상] 인증을 보유하고 있습니다.`);
    } else {
      // Default - still provide RAG-optimized example
      setValue(`${hospitalName}의 [정보 종류]는 [구체적인 값]입니다. [관련 정보1]은 [값1]이고, [관련 정보2]는 [값2]입니다. [추가 정보]는 [값]입니다.`);
    }

    setOpen(true);
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      // Get current tenant settings
      const tenantId = escalation.tenant.id || "default-tenant-id"; // TODO: Get actual tenant ID

      // Call API to update tenant settings
      const response = await fetch("/api/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: tenantId,
          settings: {
            [field]: value,
            [`${field}_updated_by`]: "escalation",
            [`${field}_updated_at`]: new Date().toISOString(),
            [`${field}_notes`]: notes,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update tenant info");
      }

      const data = await response.json();
      console.log("✅ Tenant info updated:", tenantId, field);

      // Call parent onUpdate callback
      onUpdate({ field, value, notes });
      setOpen(false);
    } catch (error) {
      console.error("❌ Error updating tenant info:", error);
      alert("거래처 정보 업데이트 실패: " + (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={handleOpen}
        className="h-8 gap-1.5 rounded-lg border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20"
      >
        <Shield className="h-3.5 w-3.5" />
        거래처 정보 업데이트
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10">
                <Shield className="h-4 w-4 text-emerald-600" />
              </div>
              거래처 정보 업데이트
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Context */}
            <div className="rounded-xl bg-gradient-to-r from-emerald-500/5 to-teal-500/5 border border-emerald-500/20 p-4 space-y-2">
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">🏥 거래처 정보</p>
              <p className="text-xs text-muted-foreground">
                거래처: {escalation.tenant.name}
              </p>
              <p className="text-xs text-muted-foreground">
                고객 질문: {escalation.customerQuestion || escalation.lastMessage}
              </p>
            </div>

            {/* Form */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="tenant-field" className="text-sm font-medium">
                  업데이트할 필드
                </Label>
                <Select value={field} onValueChange={setField}>
                  <SelectTrigger id="tenant-field" className="h-9 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operating_hours">운영 시간</SelectItem>
                    <SelectItem value="pricing">가격 정보</SelectItem>
                    <SelectItem value="contact">연락처</SelectItem>
                    <SelectItem value="location">위치/주소</SelectItem>
                    <SelectItem value="services">제공 서비스</SelectItem>
                    <SelectItem value="doctors">의료진 정보</SelectItem>
                    <SelectItem value="equipment">장비/시설</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tenant-value" className="text-sm font-medium">
                  값 <span className="text-xs text-muted-foreground">(예시가 포함되어 있습니다. 수정해주세요)</span>
                </Label>
                <textarea
                  id="tenant-value"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="업데이트할 정보를 입력해주세요..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tenant-notes" className="text-sm font-medium">
                  메모 <span className="text-xs text-muted-foreground">(업데이트 사유)</span>
                </Label>
                <textarea
                  id="tenant-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="업데이트 사유를 작성해주세요..."
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !value}
                className="flex-1 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
              >
                {isSubmitting ? "저장 중..." : "저장 및 해결 완료"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
                className="h-9 rounded-lg"
              >
                취소
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
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
  teamMembersList,
}: {
  escalation: Escalation;
  index: number;
  onAssign: (escalationId: string, member: TeamMember) => void;
  onStatusChange: (escalationId: string, newStatus: string) => void;
  teamMembersList: TeamMember[];
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
      transition={{ delay: index * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
    >
      <Card className="border-0 shadow-sm card-3d rounded-2xl overflow-hidden group">
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

                {/* Customer Question Box - Prominent Display */}
                <div className="rounded-xl bg-gradient-to-r from-blue-500/5 via-violet-500/5 to-purple-500/5 border border-blue-500/20 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">고객 질문</span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">
                    {escalation.customerQuestion || escalation.lastMessage}
                  </p>
                </div>

                {/* AI Reasoning Section */}
                <div className="rounded-xl bg-gradient-to-r from-violet-500/5 to-purple-500/5 border border-violet-500/20 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                    <span className="text-xs font-semibold text-violet-600 dark:text-violet-400">AI 분석</span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      💡 <span className="font-medium">답변하지 못한 이유:</span> {escalation.aiReasoning || escalation.reason || "충분한 정보가 없습니다"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      🎯 <span className="font-medium">AI 신뢰도:</span> <span className="tabular-nums">{(escalation.aiConfidence * 100).toFixed(1)}%</span>
                    </p>

                    {/* 명확한 업데이트 필요 정보 표시 */}
                    {escalation.recommendedAction && (
                      <div className="space-y-1.5 pt-1">
                        <p className="text-xs font-semibold text-foreground">
                          {escalation.recommendedAction === "tenant_info" ? "🏥 거래처 정보" : "📚 지식베이스"}에 다음 정보가 필요합니다:
                        </p>
                        {escalation.missingInfo && escalation.missingInfo.length > 0 ? (
                          <ul className="text-xs text-muted-foreground space-y-0.5 ml-5">
                            {escalation.missingInfo.map((info, idx) => (
                              <li key={idx} className="list-disc">
                                {escalation.recommendedAction === "tenant_info"
                                  ? `거래처정보에 ${info} 정보가 있어야 합니다`
                                  : `지식베이스에 ${info} 관련 정보가 필요합니다`}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-muted-foreground ml-5">
                            {escalation.recommendedAction === "tenant_info"
                              ? "거래처 운영 정보(영업시간, 가격, 위치 등)를 업데이트해주세요"
                              : "관련 FAQ 및 상세 답변을 지식베이스에 추가해주세요"}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Badges row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <PriorityBadge priority={escalation.priority} />
                  <StatusBadge status={escalation.status} />
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

                {/* AI Request Section - Action Buttons */}
                {escalation.status !== "resolved" && (
                  <div className="mt-4 rounded-xl bg-gradient-to-r from-amber-500/5 to-orange-500/5 border border-amber-500/20 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                        🤖 AI가 도움을 요청합니다
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {escalation.recommendedAction === "knowledge_base"
                        ? "지식베이스에 관련 정보를 추가하면 앞으로 같은 질문에 자동으로 답변할 수 있습니다."
                        : escalation.recommendedAction === "tenant_info"
                        ? "거래처 정보를 업데이트하면 더 정확한 답변을 제공할 수 있습니다."
                        : "아래 버튼을 눌러 필요한 정보를 추가해주세요. DB에 반영되면 같은 에스컬레이션이 발생하지 않습니다."}
                    </p>
                    <div className="flex items-center gap-2">
                      <UpdateKnowledgeBaseDialog
                        escalation={escalation}
                        onUpdate={(data) => {
                          // TODO: Call API to update knowledge base
                          console.log("Update KB:", data);
                          onStatusChange(escalation.id, "resolved");
                        }}
                      />
                      <UpdateTenantInfoDialog
                        escalation={escalation}
                        onUpdate={(data) => {
                          // TODO: Call API to update tenant info
                          console.log("Update Tenant:", data);
                          onStatusChange(escalation.id, "resolved");
                        }}
                      />
                    </div>
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
                          teamMembersList={teamMembersList}
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
    <Card className="border-0 shadow-sm card-3d rounded-2xl">
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
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [teamMembersList, setTeamMembersList] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [tenantFilter, setTenantFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Load escalations from API
  const loadEscalations = useCallback(async () => {
    try {
      const res = await fetch("/api/escalations");
      const data = await res.json();
      if (data.escalations) {
        setEscalations(data.escalations);
      }
      if (data.teamMembers) {
        setTeamMembersList(data.teamMembers);
      }
    } catch (error) {
      console.error("Failed to load escalations:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load + auto-refresh every 30 seconds
  useEffect(() => {
    loadEscalations();
    const interval = setInterval(loadEscalations, 30000);
    return () => clearInterval(interval);
  }, [loadEscalations]);

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
    async (escalationId: string, member: TeamMember) => {
      // Optimistic update
      setEscalations((prev) =>
        prev.map((esc) =>
          esc.id === escalationId
            ? { ...esc, assignedTo: member }
            : esc
        )
      );

      try {
        await fetch("/api/escalations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: escalationId,
            assigned_to: member.id,
          }),
        });
        // Refresh from server to get authoritative state
        loadEscalations();
      } catch (error) {
        console.error("Failed to assign escalation:", error);
        loadEscalations(); // Revert on error
      }
    },
    [loadEscalations]
  );

  const handleStatusChange = useCallback(
    async (escalationId: string, newStatus: string) => {
      // Optimistic update
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

      try {
        await fetch("/api/escalations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: escalationId,
            status: newStatus,
          }),
        });
        // Refresh from server to get authoritative state
        loadEscalations();
      } catch (error) {
        console.error("Failed to update escalation status:", error);
        loadEscalations(); // Revert on error
      }
    },
    [loadEscalations]
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-rose-500 shadow-lg shadow-red-500/20">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                에스컬레이션
              </h1>
              <p className="text-sm text-muted-foreground">
                AI가 처리하지 못한 문의를 빠르게 해결하세요
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
      <Card className="border-0 shadow-sm rounded-2xl">
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

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="border-0 shadow-sm rounded-2xl overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-start gap-4 animate-pulse">
                  <div className="h-10 w-10 rounded-full bg-muted" />
                  <div className="flex-1 space-y-3">
                    <div className="h-4 w-48 rounded bg-muted" />
                    <div className="h-3 w-full rounded bg-muted" />
                    <div className="flex gap-2">
                      <div className="h-5 w-16 rounded-full bg-muted" />
                      <div className="h-5 w-16 rounded-full bg-muted" />
                      <div className="h-5 w-32 rounded bg-muted" />
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="h-5 w-20 rounded-full bg-muted" />
                    <div className="h-3 w-16 rounded bg-muted" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Escalation List */}
      {!isLoading && (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredEscalations.map((esc, index) => (
              <EscalationCard
                key={esc.id}
                escalation={esc}
                index={index}
                onAssign={handleAssign}
                onStatusChange={handleStatusChange}
                teamMembersList={teamMembersList}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredEscalations.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border-0 shadow-sm rounded-2xl">
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
