"use client";

import { useState, useEffect, useMemo } from "react";
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
  Filter,
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
} from "lucide-react";
import { cn } from "@/lib/utils";

// SLA 대기 시간 계산 함수
function calculateWaitTime(lastMessageAt: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - lastMessageAt.getTime();

  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}일 ${hours % 24}시간`;
  } else if (hours > 0) {
    return `${hours}시간 ${minutes % 60}분`;
  } else if (minutes > 0) {
    return `${minutes}분`;
  } else {
    return "방금";
  }
}

// SLA 상태에 따른 색상
function getWaitTimeColor(lastMessageAt: Date): { color: string; bg: string; urgent: boolean } {
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - lastMessageAt.getTime()) / 60000);

  if (diffMinutes > 1440) { // 24시간 이상
    return { color: "text-red-600", bg: "bg-red-100", urgent: true };
  } else if (diffMinutes > 480) { // 8시간 이상
    return { color: "text-orange-600", bg: "bg-orange-100", urgent: false };
  } else if (diffMinutes > 60) { // 1시간 이상
    return { color: "text-yellow-600", bg: "bg-yellow-100", urgent: false };
  } else {
    return { color: "text-green-600", bg: "bg-green-100", urgent: false };
  }
}

// 상담 태그 타입 (Channel.io 참고)
type ConsultationTag = "prospect" | "potential" | "first_booking" | "confirmed" | "completed" | "cancelled";

const consultationTagConfig: Record<ConsultationTag, { label: string; color: string; bg: string }> = {
  prospect: { label: "가망", color: "text-blue-600", bg: "bg-blue-100" },
  potential: { label: "잠재", color: "text-cyan-600", bg: "bg-cyan-100" },
  first_booking: { label: "1차예약", color: "text-amber-600", bg: "bg-amber-100" },
  confirmed: { label: "확정예약", color: "text-green-600", bg: "bg-green-100" },
  completed: { label: "시술완료", color: "text-purple-600", bg: "bg-purple-100" },
  cancelled: { label: "취소", color: "text-gray-600", bg: "bg-gray-100" },
};

// Mock Data (실제 구현 시 useConversations 훅 사용)
const mockConversations = [
  {
    id: "1",
    customer: {
      name: "김환자",
      country: "일본",
      language: "ja",
      avatar: "KH",
    },
    hospital: { name: "힐링안과", id: "healing" },
    channel: "line",
    lastMessage: "ラシック手術の費用はいくらですか？",
    lastMessageTranslated: "라식 수술 비용이 얼마인가요?",
    lastMessageAt: new Date(Date.now() - 5 * 60 * 1000), // 5분 전
    status: "urgent",
    unread: 2,
    aiConfidence: null,
    consultationTag: "first_booking" as ConsultationTag,
  },
  {
    id: "2",
    customer: {
      name: "이환자",
      country: "한국",
      language: "ko",
      avatar: "LH",
    },
    hospital: { name: "스마일치과", id: "smile" },
    channel: "kakao",
    lastMessage: "예약 변경하고 싶어요",
    lastMessageTranslated: null,
    lastMessageAt: new Date(Date.now() - 60 * 60 * 1000), // 1시간 전
    status: "pending",
    unread: 0,
    aiConfidence: null,
    consultationTag: "confirmed" as ConsultationTag,
  },
  {
    id: "3",
    customer: {
      name: "박환자",
      country: "대만",
      language: "zh-TW",
      avatar: "PH",
    },
    hospital: { name: "서울성형", id: "seoul" },
    channel: "instagram",
    lastMessage: "수술 전후 사진 보고 싶어요",
    lastMessageTranslated: null,
    lastMessageAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1일 전
    status: "resolved",
    unread: 0,
    aiConfidence: 92,
    consultationTag: "completed" as ConsultationTag,
  },
  {
    id: "4",
    customer: {
      name: "John Smith",
      country: "미국",
      language: "en",
      avatar: "JS",
    },
    hospital: { name: "힐링안과", id: "healing" },
    channel: "whatsapp",
    lastMessage: "What's the price for LASIK surgery?",
    lastMessageTranslated: "라식 수술 가격이 어떻게 되나요?",
    lastMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2시간 전
    status: "ai_processing",
    unread: 1,
    aiConfidence: 87,
    consultationTag: "prospect" as ConsultationTag,
  },
  {
    id: "5",
    customer: {
      name: "田中太郎",
      country: "일본",
      language: "ja",
      avatar: "TT",
    },
    hospital: { name: "강남피부과", id: "gangnam" },
    channel: "line",
    lastMessage: "治療の予約をしたいです",
    lastMessageTranslated: "치료 예약을 하고 싶습니다",
    lastMessageAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3시간 전
    status: "pending",
    unread: 0,
    aiConfidence: null,
    consultationTag: "potential" as ConsultationTag,
  },
];

// 메시지 타입 확장 - 내부 노트 포함
type MessageType = "customer" | "ai" | "agent" | "internal_note";

const messages = [
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
  booking: {
    date: "2024-02-15",
    time: "10:00",
    type: "상담 예약",
  },
  consultationTag: "first_booking" as ConsultationTag,
  tags: ["VIP", "일본어 가능", "가격 문의"],
  notes: "일본 도쿄 거주, 한국어 가능, 2월 방문 예정",
  crmId: "CRM-12345",
};

function getStatusConfig(status: string) {
  const configs: Record<string, { color: string; bg: string; label: string; icon: React.ElementType }> = {
    urgent: { color: "text-red-500", bg: "bg-red-500/10", label: "긴급", icon: AlertCircle },
    pending: { color: "text-yellow-500", bg: "bg-yellow-500/10", label: "대기", icon: Clock },
    resolved: { color: "text-green-500", bg: "bg-green-500/10", label: "해결", icon: CheckCircle2 },
    ai_processing: { color: "text-purple-500", bg: "bg-purple-500/10", label: "AI 처리", icon: Bot },
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

export default function InboxPage() {
  const [selectedConversation, setSelectedConversation] = useState(mockConversations[0]);
  const [showTranslation, setShowTranslation] = useState(true);
  const [messageInput, setMessageInput] = useState("");
  const [filterChannel, setFilterChannel] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterConsultationTag, setFilterConsultationTag] = useState("all");
  const [messageViewMode, setMessageViewMode] = useState<"all" | "customer" | "internal">("all");
  const [isInternalNote, setIsInternalNote] = useState(false);

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4">
      {/* Conversation List */}
      <div className="w-96 flex flex-col border rounded-xl bg-card overflow-hidden">
        {/* Search & Filters */}
        <div className="p-4 border-b space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="고객, 메시지 검색..."
              className="pl-9 bg-muted/50 border-0"
            />
          </div>
          <div className="flex gap-2">
            <Select value={filterChannel} onValueChange={setFilterChannel}>
              <SelectTrigger className="flex-1 h-8 text-xs">
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
              <SelectTrigger className="flex-1 h-8 text-xs">
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
          {/* 상담 태그 필터 (Channel.io 스타일) */}
          <div className="flex gap-1 flex-wrap">
            <Button
              variant={filterConsultationTag === "all" ? "secondary" : "ghost"}
              size="sm"
              className="h-6 text-[10px] px-2"
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
                  "h-6 text-[10px] px-2",
                  filterConsultationTag === key && cn(config.bg, config.color)
                )}
                onClick={() => setFilterConsultationTag(key)}
              >
                {config.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Conversation Items */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {mockConversations.map((conv) => {
              const status = getStatusConfig(conv.status);
              const channel = getChannelConfig(conv.channel);
              const isSelected = selectedConversation?.id === conv.id;

              return (
                <motion.div
                  key={conv.id}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setSelectedConversation(conv)}
                  className={cn(
                    "p-3 rounded-lg cursor-pointer transition-colors",
                    isSelected
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-muted text-sm font-medium">
                          {conv.customer.avatar}
                        </AvatarFallback>
                      </Avatar>
                      {conv.status === "urgent" && (
                        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 border-2 border-background status-urgent-pulse" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", channel.bg, channel.text)}>
                          {channel.label}
                        </span>
                        <span className="text-xs font-medium truncate">{conv.hospital.name}</span>
                        {conv.consultationTag && (
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-medium",
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
                      {/* SLA 대기 시간 표시 */}
                      {conv.lastMessageAt && conv.status !== "resolved" && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={cn(
                                "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
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
                                  SLA 초과 - 긴급 응대 필요
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
                          <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-purple-500/10 text-purple-500 border-purple-500/20">
                            <Bot className="h-2.5 w-2.5 mr-0.5" />
                            {conv.aiConfidence}%
                          </Badge>
                        )}
                        {conv.unread > 0 && (
                          <Badge variant="default" className="h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                            {conv.unread}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Chat View */}
      <div className="flex-1 flex flex-col border rounded-xl bg-card overflow-hidden">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {selectedConversation.customer.avatar}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{selectedConversation.customer.name}</span>
                    <span className="text-sm text-muted-foreground">
                      ({selectedConversation.customer.country})
                    </span>
                    <Badge
                      variant="outline"
                      className={cn("h-5 text-[10px]", getStatusConfig(selectedConversation.status).bg, getStatusConfig(selectedConversation.status).color)}
                    >
                      {getStatusConfig(selectedConversation.status).label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className={cn("px-1.5 py-0.5 rounded", getChannelConfig(selectedConversation.channel).bg, getChannelConfig(selectedConversation.channel).text)}>
                      {getChannelConfig(selectedConversation.channel).label}
                    </span>
                    <span>•</span>
                    <span>{selectedConversation.hospital.name}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={showTranslation ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setShowTranslation(!showTranslation)}
                  className="h-8 text-xs"
                >
                  <Languages className="h-3.5 w-3.5 mr-1" />
                  번역 {showTranslation ? "ON" : "OFF"}
                </Button>
              </div>
            </div>

            {/* Message View Tabs - 내부대화 분리 (Channel.io 참고) */}
            <div className="px-4 py-2 border-b flex items-center gap-2">
              <div className="flex items-center bg-muted rounded-lg p-0.5">
                <Button
                  variant={messageViewMode === "all" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 text-xs px-3"
                  onClick={() => setMessageViewMode("all")}
                >
                  <MessageSquare className="h-3 w-3 mr-1" />
                  전체
                </Button>
                <Button
                  variant={messageViewMode === "customer" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 text-xs px-3"
                  onClick={() => setMessageViewMode("customer")}
                >
                  <User className="h-3 w-3 mr-1" />
                  고객대화
                </Button>
                <Button
                  variant={messageViewMode === "internal" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 text-xs px-3"
                  onClick={() => setMessageViewMode("internal")}
                >
                  <Lock className="h-3 w-3 mr-1" />
                  내부노트
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages
                  .filter((msg) => {
                    if (messageViewMode === "all") return true;
                    if (messageViewMode === "customer") return msg.sender !== "internal_note";
                    if (messageViewMode === "internal") return msg.sender === "internal_note";
                    return true;
                  })
                  .map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "flex gap-3",
                      msg.sender === "customer" ? "justify-start" :
                      msg.sender === "internal_note" ? "justify-center" : "justify-end"
                    )}
                  >
                    {/* 내부 노트 스타일 (Channel.io 참고) */}
                    {msg.sender === "internal_note" ? (
                      <div className="max-w-[85%] w-full">
                        <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg px-4 py-2.5">
                          <div className="flex items-center gap-2 mb-1 text-xs text-yellow-700 dark:text-yellow-400">
                            <StickyNote className="h-3 w-3" />
                            <span className="font-medium">내부 노트</span>
                            <span className="text-yellow-600/70 dark:text-yellow-500/70">• {msg.author}</span>
                          </div>
                          <p className="text-sm text-yellow-900 dark:text-yellow-100">
                            {msg.content}
                          </p>
                          {msg.mentions && msg.mentions.length > 0 && (
                            <div className="flex items-center gap-1 mt-2 text-xs text-yellow-600 dark:text-yellow-400">
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
                        {msg.sender === "customer" && (
                          <Avatar className="h-8 w-8 flex-shrink-0">
                            <AvatarFallback className="bg-muted text-xs">
                              {selectedConversation.customer.avatar}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div
                          className={cn(
                            "max-w-[70%] space-y-1",
                            msg.sender === "customer" ? "items-start" : "items-end"
                          )}
                        >
                          <div
                            className={cn(
                              "rounded-2xl px-4 py-2.5",
                              msg.sender === "customer"
                                ? "bg-muted rounded-tl-sm"
                                : msg.sender === "ai"
                                ? "bg-purple-500/10 border border-purple-500/20 rounded-tr-sm"
                                : "bg-primary text-primary-foreground rounded-tr-sm"
                            )}
                          >
                            {msg.sender === "ai" && (
                              <div className="flex items-center gap-1 mb-1 text-xs text-purple-500">
                                <Bot className="h-3 w-3" />
                                <span className="font-medium">AI BOT</span>
                                {msg.confidence && (
                                  <Badge variant="outline" className="h-4 px-1 text-[10px] border-purple-500/30 bg-purple-500/10">
                                    신뢰도 {msg.confidence}%
                                  </Badge>
                                )}
                              </div>
                            )}
                            <p className="text-sm">{msg.content}</p>
                            {showTranslation && msg.translatedContent && (
                              <div className="mt-2 pt-2 border-t border-border/50">
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                                  <Globe className="h-2.5 w-2.5" />
                                  번역
                                </div>
                                <p className="text-xs text-muted-foreground">{msg.translatedContent}</p>
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
                        {msg.sender === "ai" && (
                          <div className="h-8 w-8 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                            <Sparkles className="h-4 w-4 text-purple-500" />
                          </div>
                        )}
                      </>
                    )}
                  </motion.div>
                ))}
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t">
              {/* 내부 노트 토글 (Channel.io 참고) */}
              <div className="flex items-center gap-2 mb-2">
                <Button
                  variant={isInternalNote ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-7 text-xs",
                    isInternalNote && "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-950 dark:text-yellow-300"
                  )}
                  onClick={() => setIsInternalNote(!isInternalNote)}
                >
                  <StickyNote className="h-3 w-3 mr-1" />
                  내부 노트 {isInternalNote ? "ON" : "OFF"}
                </Button>
                {isInternalNote && (
                  <span className="text-xs text-yellow-600 dark:text-yellow-400">
                    이 메시지는 고객에게 보이지 않습니다
                  </span>
                )}
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1 relative">
                  <Textarea
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder={isInternalNote ? "팀원에게 메모를 남기세요... (@멘션 가능)" : "메시지를 입력하세요... (자동 번역됩니다)"}
                    className={cn(
                      "min-h-[80px] pr-24 resize-none",
                      isInternalNote && "border-yellow-300 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-950/30"
                    )}
                  />
                  <div className="absolute bottom-2 right-2 flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    {!isInternalNote && (
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Bot className="h-4 w-4" />
                      </Button>
                    )}
                    {isInternalNote && (
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <AtSign className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <Button
                  size="icon"
                  className={cn(
                    "h-10 w-10",
                    isInternalNote && "bg-yellow-500 hover:bg-yellow-600"
                  )}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                {!isInternalNote && (
                  <>
                    <div className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      <span>DeepL 자동번역 ON</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Bot className="h-3 w-3" />
                      <span>AI 제안 사용 가능</span>
                    </div>
                  </>
                )}
                {isInternalNote && (
                  <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                    <Lock className="h-3 w-3" />
                    <span>내부 노트 모드 - 팀원만 볼 수 있습니다</span>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            대화를 선택해주세요
          </div>
        )}
      </div>

      {/* Customer Profile Panel */}
      <div className="w-80 border rounded-xl bg-card overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-4">
            {/* Profile Header */}
            <div className="text-center">
              <Avatar className="h-16 w-16 mx-auto mb-3">
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-medium">
                  {customerProfile.name.slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <h3 className="font-semibold text-lg">{customerProfile.name}</h3>
              <div className="flex items-center justify-center gap-2 mt-1">
                <Badge variant="secondary">VIP</Badge>
                <span className="text-sm text-muted-foreground">{customerProfile.country}</span>
              </div>
              {/* 상담 태그 선택 (Channel.io 스타일) */}
              <div className="mt-3">
                <Select defaultValue={customerProfile.consultationTag}>
                  <SelectTrigger className="w-full h-8">
                    <SelectValue placeholder="상담 단계 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(consultationTagConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <span className={cn("px-2 py-0.5 rounded text-xs font-medium", config.bg, config.color)}>
                          {config.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Contact Info */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Phone className="h-4 w-4" />
                연결된 채널
              </h4>
              <div className="space-y-2">
                {customerProfile.channels.map((ch, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <span className={cn("px-1.5 py-0.5 rounded text-[10px]", getChannelConfig(ch.type).bg, getChannelConfig(ch.type).text)}>
                      {getChannelConfig(ch.type).label}
                    </span>
                    <span className="text-muted-foreground">{ch.id}</span>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Location */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                위치
              </h4>
              <p className="text-sm text-muted-foreground">
                {customerProfile.city}, {customerProfile.country}
              </p>
            </div>

            <Separator />

            {/* Booking */}
            {customerProfile.booking && (
              <>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    예약 정보
                  </h4>
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <p className="text-sm font-medium">{customerProfile.booking.type}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {customerProfile.booking.date} {customerProfile.booking.time}
                    </p>
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Interests */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                관심 시술
              </h4>
              <div className="flex flex-wrap gap-1">
                {customerProfile.interests.map((interest) => (
                  <Badge key={interest} variant="outline" className="text-xs">
                    {interest}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            {/* Tags */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Tag className="h-4 w-4" />
                태그
              </h4>
              <div className="flex flex-wrap gap-1">
                {customerProfile.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            {/* Notes */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">메모</h4>
              <p className="text-sm text-muted-foreground">{customerProfile.notes}</p>
            </div>

            <Separator />

            {/* Actions */}
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start" size="sm">
                <Calendar className="h-4 w-4 mr-2" />
                예약 등록
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm">
                <ExternalLink className="h-4 w-4 mr-2" />
                CRM에서 열기
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm">
                <Tag className="h-4 w-4 mr-2" />
                태그 추가
              </Button>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
