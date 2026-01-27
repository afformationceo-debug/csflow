"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Send,
  Paperclip,
  Globe,
  Bot,
  User,
  Phone,
  MapPin,
  Calendar,
  Tag,
  ExternalLink,
  Sparkles,
  Languages,
  Clock,
  CheckCircle2,
  AlertCircle,
  StickyNote,
  AtSign,
  MessageSquare,
  Lock,
  Timer,
  Heart,
  Shield,
  Zap,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── 유틸리티 함수들 ──

function calculateWaitTime(lastMessageAt: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - lastMessageAt.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}일 ${hours % 24}시간`;
  if (hours > 0) return `${hours}시간 ${minutes % 60}분`;
  if (minutes > 0) return `${minutes}분`;
  return "방금";
}

function getWaitTimeColor(lastMessageAt: Date): { color: string; bg: string; urgent: boolean } {
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - lastMessageAt.getTime()) / 60000);

  if (diffMinutes > 1440) return { color: "text-red-600", bg: "bg-red-100 dark:bg-red-950/40", urgent: true };
  if (diffMinutes > 480) return { color: "text-orange-600", bg: "bg-orange-100 dark:bg-orange-950/40", urgent: false };
  if (diffMinutes > 60) return { color: "text-yellow-600", bg: "bg-yellow-100 dark:bg-yellow-950/40", urgent: false };
  return { color: "text-green-600", bg: "bg-green-100 dark:bg-green-950/40", urgent: false };
}

// 상담 태그 타입 (Channel.io 참고)
type ConsultationTag = "prospect" | "potential" | "first_booking" | "confirmed" | "completed" | "cancelled";

const consultationTagConfig: Record<ConsultationTag, { label: string; color: string; bg: string }> = {
  prospect: { label: "가망", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-950/40" },
  potential: { label: "잠재", color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-100 dark:bg-cyan-950/40" },
  first_booking: { label: "1차예약", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-950/40" },
  confirmed: { label: "확정예약", color: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-950/40" },
  completed: { label: "시술완료", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-950/40" },
  cancelled: { label: "취소", color: "text-gray-600 dark:text-gray-400", bg: "bg-gray-100 dark:bg-gray-950/40" },
};

// ── Mock 데이터 ──

const mockConversations = [
  {
    id: "1",
    customer: { name: "김환자", country: "일본", language: "ja", avatar: "KH" },
    hospital: { name: "힐링안과", id: "healing" },
    channel: "line",
    lastMessage: "ラシック手術の費用はいくらですか？",
    lastMessageTranslated: "라식 수술 비용이 얼마인가요?",
    lastMessageAt: new Date(Date.now() - 5 * 60 * 1000),
    status: "urgent",
    unread: 2,
    aiConfidence: null,
    consultationTag: "first_booking" as ConsultationTag,
  },
  {
    id: "2",
    customer: { name: "이환자", country: "한국", language: "ko", avatar: "LH" },
    hospital: { name: "스마일치과", id: "smile" },
    channel: "kakao",
    lastMessage: "예약 변경하고 싶어요",
    lastMessageTranslated: null,
    lastMessageAt: new Date(Date.now() - 60 * 60 * 1000),
    status: "pending",
    unread: 0,
    aiConfidence: null,
    consultationTag: "confirmed" as ConsultationTag,
  },
  {
    id: "3",
    customer: { name: "박환자", country: "대만", language: "zh-TW", avatar: "PH" },
    hospital: { name: "서울성형", id: "seoul" },
    channel: "instagram",
    lastMessage: "수술 전후 사진 보고 싶어요",
    lastMessageTranslated: null,
    lastMessageAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    status: "resolved",
    unread: 0,
    aiConfidence: 92,
    consultationTag: "completed" as ConsultationTag,
  },
  {
    id: "4",
    customer: { name: "John Smith", country: "미국", language: "en", avatar: "JS" },
    hospital: { name: "힐링안과", id: "healing" },
    channel: "whatsapp",
    lastMessage: "What's the price for LASIK surgery?",
    lastMessageTranslated: "라식 수술 가격이 어떻게 되나요?",
    lastMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    status: "ai_processing",
    unread: 1,
    aiConfidence: 87,
    consultationTag: "prospect" as ConsultationTag,
  },
  {
    id: "5",
    customer: { name: "田中太郎", country: "일본", language: "ja", avatar: "TT" },
    hospital: { name: "강남피부과", id: "gangnam" },
    channel: "line",
    lastMessage: "治療の予約をしたいです",
    lastMessageTranslated: "치료 예약을 하고 싶습니다",
    lastMessageAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    status: "pending",
    unread: 0,
    aiConfidence: null,
    consultationTag: "potential" as ConsultationTag,
  },
];

type MessageType = "customer" | "ai" | "agent" | "internal_note";

const mockMessages = [
  {
    id: "m1",
    sender: "customer" as MessageType,
    content: "ラシック手術の費用はいくらですか？",
    translatedContent: "라식 수술 비용이 얼마인가요?",
    time: "14:30",
    language: "ja",
  },
  {
    id: "m2",
    sender: "ai" as MessageType,
    content: "라식 수술 비용은 양안 기준 150만원~200만원입니다. 정확한 비용은 사전 검사 후 확정됩니다. 상담 예약을 도와드릴까요?",
    translatedContent: "ラシック手術の費用は両眼で150万ウォン〜200万ウォンです。正確な費用は事前検査後に確定します。相談予約をお手伝いしましょうか？",
    time: "14:31",
    confidence: 92,
    sources: ["가격표.pdf", "라식FAQ.md"],
  },
  {
    id: "m-internal-1",
    sender: "internal_note" as MessageType,
    content: "VIP 고객입니다. 특별 할인 적용 가능 - 담당: 김코디",
    time: "14:32",
    author: "김코디",
  },
  {
    id: "m3",
    sender: "customer" as MessageType,
    content: "はい、予約したいです。来月の15日は空いていますか？",
    translatedContent: "네, 예약하고 싶어요. 다음달 15일 가능한가요?",
    time: "14:35",
    language: "ja",
  },
  {
    id: "m-internal-2",
    sender: "internal_note" as MessageType,
    content: "@박상담 2월 15일 예약 가능 여부 확인 부탁드립니다.",
    time: "14:36",
    author: "김코디",
    mentions: ["박상담"],
  },
];

const customerProfile = {
  name: "김환자",
  country: "일본",
  city: "도쿄",
  language: "일본어",
  channels: [
    { type: "line", id: "healing_user_123" },
    { type: "whatsapp", id: "+81-90-xxxx-xxxx" },
  ],
  interests: ["라식", "라섹", "스마일라식"],
  booking: { date: "2024-02-15", time: "10:00", type: "상담 예약" },
  consultationTag: "first_booking" as ConsultationTag,
  tags: ["VIP", "일본어 가능", "가격 문의"],
  notes: "일본 도쿄 거주, 한국어 가능, 2월 방문 예정",
  crmId: "CRM-12345",
};

// ── 설정 함수 ──

function getStatusConfig(status: string) {
  const configs: Record<string, { color: string; bg: string; label: string; icon: React.ElementType }> = {
    urgent: { color: "text-red-500", bg: "bg-red-500/10", label: "긴급", icon: AlertCircle },
    pending: { color: "text-yellow-500", bg: "bg-yellow-500/10", label: "대기", icon: Clock },
    resolved: { color: "text-green-500", bg: "bg-green-500/10", label: "해결", icon: CheckCircle2 },
    ai_processing: { color: "text-violet-500", bg: "bg-violet-500/10", label: "AI 처리", icon: Bot },
  };
  return configs[status] || configs.pending;
}

function getChannelConfig(channel: string) {
  const configs: Record<string, { bg: string; text: string; label: string }> = {
    line: { bg: "bg-[#06C755]", text: "text-white", label: "LINE" },
    whatsapp: { bg: "bg-[#25D366]", text: "text-white", label: "WhatsApp" },
    kakao: { bg: "bg-[#FEE500]", text: "text-[#3C1E1E]", label: "카카오" },
    instagram: { bg: "bg-gradient-to-r from-[#f09433] to-[#bc1888]", text: "text-white", label: "Instagram" },
    facebook: { bg: "bg-[#1877F2]", text: "text-white", label: "Facebook" },
  };
  return configs[channel] || { bg: "bg-gray-500", text: "text-white", label: channel };
}

// ── 애니메이션 프리셋 ──
const smoothEase = [0.22, 1, 0.36, 1] as [number, number, number, number];

// ── 메인 컴포넌트 ──

export default function InboxPage() {
  const [selectedConversation, setSelectedConversation] = useState(mockConversations[0]);
  const [showTranslation, setShowTranslation] = useState(true);
  const [messageInput, setMessageInput] = useState("");
  const [filterChannel, setFilterChannel] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterConsultationTag, setFilterConsultationTag] = useState("all");
  const [messageViewMode, setMessageViewMode] = useState<"all" | "customer" | "internal">("all");
  const [isInternalNote, setIsInternalNote] = useState(false);

  const filteredConversations = mockConversations.filter((conv) => {
    if (filterChannel !== "all" && conv.channel !== filterChannel) return false;
    if (filterStatus !== "all" && conv.status !== filterStatus) return false;
    if (filterConsultationTag !== "all" && conv.consultationTag !== filterConsultationTag) return false;
    return true;
  });

  const filteredMessages = mockMessages.filter((msg) => {
    if (messageViewMode === "all") return true;
    if (messageViewMode === "customer") return msg.sender !== "internal_note";
    if (messageViewMode === "internal") return msg.sender === "internal_note";
    return true;
  });

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-3">
      {/* ─── 좌측: 대화 목록 ─── */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: smoothEase }}
        className="w-96 flex flex-col border rounded-2xl bg-card/80 backdrop-blur-sm overflow-hidden"
      >
        {/* 상단: 검색/필터 */}
        <div className="p-4 border-b space-y-3">
          {/* 인박스 헤더 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
                <MessageCircle className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-sm">통합 인박스</h2>
                <p className="text-[10px] text-muted-foreground">
                  {mockConversations.length}건의 대화
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px] border-violet-500/30 text-violet-500 bg-violet-500/5">
              <Zap className="h-2.5 w-2.5 mr-0.5" />
              실시간
            </Badge>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="고객, 메시지 검색..."
              className="pl-9 bg-muted/50 border-0 rounded-xl h-9"
            />
          </div>

          <div className="flex gap-2">
            <Select value={filterChannel} onValueChange={setFilterChannel}>
              <SelectTrigger className="flex-1 h-8 text-xs rounded-lg">
                <SelectValue placeholder="채널" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 채널</SelectItem>
                <SelectItem value="line">LINE</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="kakao">카카오톡</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="flex-1 h-8 text-xs rounded-lg">
                <SelectValue placeholder="상태" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 상태</SelectItem>
                <SelectItem value="urgent">긴급</SelectItem>
                <SelectItem value="pending">대기</SelectItem>
                <SelectItem value="ai_processing">AI 처리</SelectItem>
                <SelectItem value="resolved">해결</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 상담 태그 필터 */}
          <div className="flex gap-1 flex-wrap">
            <Button
              variant={filterConsultationTag === "all" ? "secondary" : "ghost"}
              size="sm"
              className="h-6 text-[10px] px-2 rounded-full"
              onClick={() => setFilterConsultationTag("all")}
            >
              전체
            </Button>
            {Object.entries(consultationTagConfig).map(([key, config]) => (
              <Button
                key={key}
                variant={filterConsultationTag === key ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "h-6 text-[10px] px-2 rounded-full transition-all",
                  filterConsultationTag === key && cn(config.bg, config.color)
                )}
                onClick={() => setFilterConsultationTag(key)}
              >
                {config.label}
              </Button>
            ))}
          </div>
        </div>

        {/* 대화 아이템 목록 */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            <AnimatePresence mode="popLayout">
              {filteredConversations.map((conv, index) => {
                const status = getStatusConfig(conv.status);
                const channel = getChannelConfig(conv.channel);
                const isSelected = selectedConversation?.id === conv.id;

                return (
                  <motion.div
                    key={conv.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, delay: index * 0.03, ease: smoothEase }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setSelectedConversation(conv)}
                    className={cn(
                      "p-3 rounded-xl cursor-pointer transition-all duration-200",
                      isSelected
                        ? "bg-primary/8 border border-primary/20 shadow-sm"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className={cn(
                            "text-sm font-medium",
                            isSelected ? "bg-primary/15 text-primary" : "bg-muted"
                          )}>
                            {conv.customer.avatar}
                          </AvatarFallback>
                        </Avatar>
                        {conv.status === "urgent" && (
                          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 border-2 border-background status-urgent-pulse" />
                        )}
                        {conv.status === "ai_processing" && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-violet-500/20 flex items-center justify-center">
                            <Bot className="h-2.5 w-2.5 text-violet-500" />
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className={cn("px-1.5 py-0.5 rounded-md text-[10px] font-medium", channel.bg, channel.text)}>
                            {channel.label}
                          </span>
                          <span className="text-xs font-medium truncate">{conv.hospital.name}</span>
                          {conv.consultationTag && (
                            <span className={cn(
                              "px-1.5 py-0.5 rounded-full text-[10px] font-medium",
                              consultationTagConfig[conv.consultationTag].bg,
                              consultationTagConfig[conv.consultationTag].color
                            )}>
                              {consultationTagConfig[conv.consultationTag].label}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mb-1">
                          <span className="font-medium text-sm truncate">{conv.customer.name}</span>
                          <span className="text-xs text-muted-foreground">({conv.customer.country})</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {conv.lastMessageTranslated || conv.lastMessage}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {conv.lastMessageAt && conv.status !== "resolved" && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className={cn(
                                  "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium",
                                  getWaitTimeColor(conv.lastMessageAt).bg,
                                  getWaitTimeColor(conv.lastMessageAt).color
                                )}>
                                  <Timer className="h-2.5 w-2.5" />
                                  {calculateWaitTime(conv.lastMessageAt)}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="left">
                                <p className="text-xs">
                                  마지막 메시지: {conv.lastMessageAt.toLocaleString("ko-KR")}
                                </p>
                                {getWaitTimeColor(conv.lastMessageAt).urgent && (
                                  <p className="text-xs text-red-500 font-medium mt-1">
                                    SLA 초과 — 긴급 응대 필요
                                  </p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {conv.status === "resolved" && (
                          <span className="text-[10px] text-muted-foreground">
                            {conv.lastMessageAt ? calculateWaitTime(conv.lastMessageAt) : ""}
                          </span>
                        )}
                        <div className="flex items-center gap-1">
                          {conv.aiConfidence && (
                            <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-violet-500/10 text-violet-500 border-violet-500/20">
                              <Bot className="h-2.5 w-2.5 mr-0.5" />
                              {conv.aiConfidence}%
                            </Badge>
                          )}
                          {conv.unread > 0 && (
                            <Badge className="h-5 w-5 p-0 flex items-center justify-center text-[10px] rounded-full">
                              {conv.unread}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {filteredConversations.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-12 text-muted-foreground"
              >
                <MessageCircle className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">조건에 맞는 대화가 없습니다</p>
                <p className="text-xs mt-1">필터를 변경해보세요</p>
              </motion.div>
            )}
          </div>
        </ScrollArea>
      </motion.div>

      {/* ─── 중앙: 채팅 영역 ─── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: smoothEase }}
        className="flex-1 flex flex-col border rounded-2xl bg-card/80 backdrop-blur-sm overflow-hidden"
      >
        {selectedConversation ? (
          <>
            {/* 채팅 헤더 */}
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {selectedConversation.customer.avatar}
                    </AvatarFallback>
                  </Avatar>
                  {selectedConversation.status === "urgent" && (
                    <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-red-500 border-2 border-background status-urgent-pulse" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{selectedConversation.customer.name}</span>
                    <span className="text-sm text-muted-foreground">
                      ({selectedConversation.customer.country})
                    </span>
                    <Badge
                      variant="outline"
                      className={cn("h-5 text-[10px] rounded-full", getStatusConfig(selectedConversation.status).bg, getStatusConfig(selectedConversation.status).color)}
                    >
                      {getStatusConfig(selectedConversation.status).label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span className={cn("px-1.5 py-0.5 rounded-md text-[10px]", getChannelConfig(selectedConversation.channel).bg, getChannelConfig(selectedConversation.channel).text)}>
                      {getChannelConfig(selectedConversation.channel).label}
                    </span>
                    <span className="text-muted-foreground/50">•</span>
                    <span>{selectedConversation.hospital.name}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={showTranslation ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setShowTranslation(!showTranslation)}
                        className={cn(
                          "h-8 text-xs rounded-lg transition-all",
                          showTranslation && "bg-blue-500/10 text-blue-600 hover:bg-blue-500/15 dark:text-blue-400"
                        )}
                      >
                        <Languages className="h-3.5 w-3.5 mr-1" />
                        번역 {showTranslation ? "ON" : "OFF"}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">DeepL 실시간 번역을 {showTranslation ? "끕니다" : "켭니다"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* 메시지 뷰 탭 */}
            <div className="px-4 py-2 border-b flex items-center gap-3">
              <div className="flex items-center bg-muted/60 rounded-lg p-0.5">
                {[
                  { key: "all", label: "전체", icon: MessageSquare },
                  { key: "customer", label: "고객대화", icon: User },
                  { key: "internal", label: "내부노트", icon: Lock },
                ].map((tab) => (
                  <Button
                    key={tab.key}
                    variant={messageViewMode === tab.key ? "secondary" : "ghost"}
                    size="sm"
                    className={cn(
                      "h-7 text-xs px-3 rounded-md transition-all",
                      messageViewMode === tab.key && "shadow-sm"
                    )}
                    onClick={() => setMessageViewMode(tab.key as typeof messageViewMode)}
                  >
                    <tab.icon className="h-3 w-3 mr-1" />
                    {tab.label}
                  </Button>
                ))}
              </div>
              {/* AI 보조 상태 */}
              <div className="flex items-center gap-1.5 ml-auto text-xs text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                <span>AI 어시스턴트 활성</span>
              </div>
            </div>

            {/* 메시지 영역 */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                <AnimatePresence>
                  {filteredMessages.map((msg, idx) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: idx * 0.05, ease: smoothEase }}
                      className={cn(
                        "flex gap-3",
                        msg.sender === "customer" ? "justify-start" :
                        msg.sender === "internal_note" ? "justify-center" : "justify-end"
                      )}
                    >
                      {/* ── 내부 노트 ── */}
                      {msg.sender === "internal_note" ? (
                        <div className="max-w-[85%] w-full">
                          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/50 rounded-xl px-4 py-3">
                            <div className="flex items-center gap-2 mb-1.5 text-xs text-amber-700 dark:text-amber-400">
                              <StickyNote className="h-3 w-3" />
                              <span className="font-semibold">내부 노트</span>
                              <span className="text-amber-600/60 dark:text-amber-500/60">• {msg.author}</span>
                            </div>
                            <p className="text-sm text-amber-900 dark:text-amber-100">
                              {msg.content}
                            </p>
                            {msg.mentions && msg.mentions.length > 0 && (
                              <div className="flex items-center gap-1 mt-2 text-xs text-amber-600 dark:text-amber-400">
                                <AtSign className="h-3 w-3" />
                                {msg.mentions.join(", ")}
                              </div>
                            )}
                          </div>
                          <div className="text-center mt-1">
                            <span className="text-[10px] text-muted-foreground">{msg.time}</span>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* ── 고객 메시지 ── */}
                          {msg.sender === "customer" && (
                            <Avatar className="h-8 w-8 flex-shrink-0 mt-1">
                              <AvatarFallback className="bg-muted text-xs">
                                {selectedConversation.customer.avatar}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <div className={cn(
                            "max-w-[70%] space-y-1",
                            msg.sender === "customer" ? "items-start" : "items-end"
                          )}>
                            <div className={cn(
                              "rounded-2xl px-4 py-3",
                              msg.sender === "customer"
                                ? "bg-muted/80 rounded-tl-sm"
                                : msg.sender === "ai"
                                ? "bg-violet-500/8 border border-violet-500/15 rounded-tr-sm"
                                : "bg-primary text-primary-foreground rounded-tr-sm"
                            )}>
                              {msg.sender === "ai" && (
                                <div className="flex items-center gap-1.5 mb-2 text-xs text-violet-600 dark:text-violet-400">
                                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-violet-500/10">
                                    <Sparkles className="h-3 w-3" />
                                    <span className="font-semibold">AI 어시스턴트</span>
                                  </div>
                                  {msg.confidence && (
                                    <Badge variant="outline" className="h-4 px-1.5 text-[10px] border-violet-500/20 bg-violet-500/5 text-violet-600 dark:text-violet-400">
                                      신뢰도 {msg.confidence}%
                                    </Badge>
                                  )}
                                </div>
                              )}
                              <p className="text-sm leading-relaxed">{msg.content}</p>
                              {showTranslation && msg.translatedContent && (
                                <div className="mt-2.5 pt-2.5 border-t border-border/40">
                                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                                    <Globe className="h-2.5 w-2.5" />
                                    번역
                                  </div>
                                  <p className="text-xs text-muted-foreground leading-relaxed">{msg.translatedContent}</p>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 px-1">
                              <span className="text-[10px] text-muted-foreground">{msg.time}</span>
                              {msg.sources && (
                                <span className="text-[10px] text-muted-foreground">
                                  • 참조: {msg.sources.join(", ")}
                                </span>
                              )}
                            </div>
                          </div>
                          {/* ── AI 아바타 ── */}
                          {msg.sender === "ai" && (
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500/20 to-blue-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                              <Sparkles className="h-4 w-4 text-violet-500" />
                            </div>
                          )}
                        </>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </ScrollArea>

            {/* 메시지 입력 */}
            <div className="p-4 border-t bg-card/50">
              {/* 내부 노트 토글 */}
              <div className="flex items-center gap-2 mb-2">
                <Button
                  variant={isInternalNote ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-7 text-xs rounded-lg transition-all",
                    isInternalNote && "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300"
                  )}
                  onClick={() => setIsInternalNote(!isInternalNote)}
                >
                  <StickyNote className="h-3 w-3 mr-1" />
                  내부 노트 {isInternalNote ? "ON" : "OFF"}
                </Button>
                {isInternalNote && (
                  <motion.span
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1"
                  >
                    <Shield className="h-3 w-3" />
                    이 메시지는 고객에게 보이지 않습니다
                  </motion.span>
                )}
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1 relative">
                  <Textarea
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder={isInternalNote ? "팀원에게 메모를 남기세요... (@멘션 가능)" : "메시지를 입력하세요... (자동 번역됩니다)"}
                    className={cn(
                      "min-h-[80px] pr-24 resize-none rounded-xl transition-all",
                      isInternalNote && "border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30 focus-visible:ring-amber-400"
                    )}
                  />
                  <div className="absolute bottom-2 right-2 flex items-center gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg">
                            <Paperclip className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p className="text-xs">파일 첨부</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {!isInternalNote && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg">
                              <Bot className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p className="text-xs">AI 답변 추천</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {isInternalNote && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg">
                              <AtSign className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p className="text-xs">팀원 멘션</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
                <Button
                  size="icon"
                  className={cn(
                    "h-10 w-10 rounded-xl transition-all",
                    isInternalNote ? "bg-amber-500 hover:bg-amber-600" : "bg-primary hover:bg-primary/90"
                  )}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                {!isInternalNote ? (
                  <>
                    <div className="flex items-center gap-1">
                      <Globe className="h-3 w-3 text-blue-500" />
                      <span>DeepL 자동번역 ON</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-violet-500" />
                      <span>AI 제안 사용 가능</span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <Lock className="h-3 w-3" />
                    <span>내부 노트 모드 — 팀원만 볼 수 있습니다</span>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center">
              <MessageCircle className="h-8 w-8 opacity-30" />
            </div>
            <p className="font-medium">대화를 선택해주세요</p>
            <p className="text-sm">좌측 목록에서 대화를 선택하면 여기에 표시됩니다</p>
          </div>
        )}
      </motion.div>

      {/* ─── 우측: 고객 프로필 패널 ─── */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease: smoothEase }}
        className="w-80 border rounded-2xl bg-card/80 backdrop-blur-sm overflow-hidden"
      >
        <ScrollArea className="h-full">
          <div className="p-4 space-y-4">
            {/* 프로필 헤더 */}
            <div className="text-center">
              <div className="relative inline-block">
                <Avatar className="h-16 w-16 mx-auto mb-3 ring-2 ring-primary/10 ring-offset-2 ring-offset-background">
                  <AvatarFallback className="bg-gradient-to-br from-primary/20 to-violet-500/20 text-primary text-xl font-medium">
                    {customerProfile.name.slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
                  <Heart className="h-2.5 w-2.5 text-white" />
                </div>
              </div>
              <h3 className="font-semibold text-lg">{customerProfile.name}</h3>
              <div className="flex items-center justify-center gap-2 mt-1">
                <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 text-[10px]">VIP</Badge>
                <span className="text-sm text-muted-foreground">{customerProfile.country}</span>
              </div>

              {/* 상담 태그 */}
              <div className="mt-3">
                <Select defaultValue={customerProfile.consultationTag}>
                  <SelectTrigger className="w-full h-8 rounded-lg">
                    <SelectValue placeholder="상담 단계 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(consultationTagConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", config.bg, config.color)}>
                          {config.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* 연결된 채널 */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                연결된 채널
              </h4>
              <div className="space-y-2">
                {customerProfile.channels.map((ch, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-muted/30">
                    <span className={cn("px-1.5 py-0.5 rounded-md text-[10px]", getChannelConfig(ch.type).bg, getChannelConfig(ch.type).text)}>
                      {getChannelConfig(ch.type).label}
                    </span>
                    <span className="text-muted-foreground text-xs">{ch.id}</span>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* 위치 */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                위치
              </h4>
              <p className="text-sm text-muted-foreground">
                {customerProfile.city}, {customerProfile.country}
              </p>
            </div>

            <Separator />

            {/* 예약 정보 */}
            {customerProfile.booking && (
              <>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    예약 정보
                  </h4>
                  <div className="p-3 rounded-xl bg-gradient-to-r from-primary/5 to-violet-500/5 border border-primary/10">
                    <p className="text-sm font-medium">{customerProfile.booking.type}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {customerProfile.booking.date} {customerProfile.booking.time}
                    </p>
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* 관심 시술 */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                관심 시술
              </h4>
              <div className="flex flex-wrap gap-1">
                {customerProfile.interests.map((interest) => (
                  <Badge key={interest} variant="outline" className="text-xs rounded-full">
                    {interest}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            {/* 태그 */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                태그
              </h4>
              <div className="flex flex-wrap gap-1">
                {customerProfile.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs rounded-full">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            {/* 메모 */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">메모</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{customerProfile.notes}</p>
            </div>

            <Separator />

            {/* 액션 버튼 */}
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start rounded-lg" size="sm">
                <Calendar className="h-4 w-4 mr-2" />
                예약 등록
              </Button>
              <Button variant="outline" className="w-full justify-start rounded-lg" size="sm">
                <ExternalLink className="h-4 w-4 mr-2" />
                CRM에서 열기
              </Button>
              <Button variant="outline" className="w-full justify-start rounded-lg" size="sm">
                <Tag className="h-4 w-4 mr-2" />
                태그 추가
              </Button>
            </div>
          </div>
        </ScrollArea>
      </motion.div>
    </div>
  );
}
