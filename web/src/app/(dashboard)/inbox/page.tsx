"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
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
  Building2,
  Filter,
  X,
  ChevronDown,
  Copy,
  ArrowDown,
  Bookmark,
  Star,
  MoreHorizontal,
  Reply,
  Forward,
  UserPlus,
  History,
  Eye,
  EyeOff,
  Hash,
  Palette,
  Plus,
  Check,
  ChevronsUpDown,
  RefreshCw,
  Keyboard,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──

type ConsultationTag = "prospect" | "potential" | "first_booking" | "confirmed" | "completed" | "cancelled";
type StatusTag = "urgent" | "pending" | "ai_processing" | "resolved" | "waiting" | "on_hold";
type CustomerTag = string;

interface Hospital {
  id: string;
  name: string;
  nameEn?: string;
  specialty: string;
  color: string;
}

interface Conversation {
  id: string;
  customer: {
    name: string;
    country: string;
    language: string;
    avatar: string;
  };
  hospital: Hospital;
  channel: string;
  lastMessage: string;
  lastMessageTranslated: string | null;
  lastMessageAt: Date;
  status: StatusTag;
  unread: number;
  aiConfidence: number | null;
  consultationTag: ConsultationTag;
  customerTags: CustomerTag[];
  assignee?: string;
  isBookmarked?: boolean;
  isPinned?: boolean;
  sentimentScore?: number;
}

type MessageType = "customer" | "ai" | "agent" | "internal_note" | "system";

interface Message {
  id: string;
  sender: MessageType;
  content: string;
  translatedContent?: string;
  time: string;
  language?: string;
  confidence?: number;
  sources?: string[];
  author?: string;
  mentions?: string[];
  isEdited?: boolean;
  reactions?: { emoji: string; count: number }[];
}

// ── Config Data ──

const consultationTagConfig: Record<ConsultationTag, { label: string; color: string; bg: string; emoji: string }> = {
  prospect: { label: "가망", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/40", emoji: "🔵" },
  potential: { label: "잠재", color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-100 dark:bg-cyan-900/40", emoji: "🟢" },
  first_booking: { label: "1차예약", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/40", emoji: "📅" },
  confirmed: { label: "확정예약", color: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900/40", emoji: "✅" },
  completed: { label: "시술완료", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-900/40", emoji: "💜" },
  cancelled: { label: "취소", color: "text-gray-600 dark:text-gray-400", bg: "bg-gray-100 dark:bg-gray-800/40", emoji: "⛔" },
};

const statusTagConfig: Record<StatusTag, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  urgent: { label: "긴급", color: "text-red-500", bg: "bg-red-500/10", icon: AlertCircle },
  pending: { label: "대기", color: "text-yellow-500", bg: "bg-yellow-500/10", icon: Clock },
  ai_processing: { label: "AI 처리", color: "text-violet-500", bg: "bg-violet-500/10", icon: Bot },
  resolved: { label: "해결", color: "text-green-500", bg: "bg-green-500/10", icon: CheckCircle2 },
  waiting: { label: "응답대기", color: "text-orange-500", bg: "bg-orange-500/10", icon: Timer },
  on_hold: { label: "보류", color: "text-gray-500", bg: "bg-gray-500/10", icon: Clock },
};

const customerTagPresets: { label: string; color: string; bg: string }[] = [
  { label: "VIP", color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-100 dark:bg-amber-900/40" },
  { label: "리피터", color: "text-green-700 dark:text-green-300", bg: "bg-green-100 dark:bg-green-900/40" },
  { label: "가격문의", color: "text-blue-700 dark:text-blue-300", bg: "bg-blue-100 dark:bg-blue-900/40" },
  { label: "불만고객", color: "text-red-700 dark:text-red-300", bg: "bg-red-100 dark:bg-red-900/40" },
  { label: "인플루언서", color: "text-pink-700 dark:text-pink-300", bg: "bg-pink-100 dark:bg-pink-900/40" },
  { label: "현지에이전트", color: "text-indigo-700 dark:text-indigo-300", bg: "bg-indigo-100 dark:bg-indigo-900/40" },
  { label: "통역필요", color: "text-violet-700 dark:text-violet-300", bg: "bg-violet-100 dark:bg-violet-900/40" },
  { label: "보험문의", color: "text-teal-700 dark:text-teal-300", bg: "bg-teal-100 dark:bg-teal-900/40" },
];

// ── 거래처(병원) 목록 ──

const hospitals: Hospital[] = [
  { id: "healing", name: "힐링안과", nameEn: "Healing Eye", specialty: "안과", color: "#2563eb" },
  { id: "smile", name: "스마일치과", nameEn: "Smile Dental", specialty: "치과", color: "#10b981" },
  { id: "seoul", name: "서울성형", nameEn: "Seoul Plastic", specialty: "성형외과", color: "#8b5cf6" },
  { id: "gangnam", name: "강남피부과", nameEn: "Gangnam Derma", specialty: "피부과", color: "#f59e0b" },
  { id: "cheongdam", name: "청담봄온의원", nameEn: "Cheongdam Bomon", specialty: "성형외과", color: "#ec4899" },
  { id: "yonsei", name: "연세안과", nameEn: "Yonsei Eye", specialty: "안과", color: "#0ea5e9" },
  { id: "samsung", name: "삼성미래의원", nameEn: "Samsung Future", specialty: "종합", color: "#6366f1" },
  { id: "apgujeong", name: "압구정성형", nameEn: "Apgujeong PS", specialty: "성형외과", color: "#d946ef" },
  { id: "sinsa", name: "신사치과", nameEn: "Sinsa Dental", specialty: "치과", color: "#14b8a6" },
  { id: "jamsil", name: "잠실피부과", nameEn: "Jamsil Derma", specialty: "피부과", color: "#f97316" },
];

// ── Mock Data ──

const mockConversations: Conversation[] = [
  {
    id: "1",
    customer: { name: "김환자", country: "일본", language: "ja", avatar: "KH" },
    hospital: hospitals[0],
    channel: "line",
    lastMessage: "ラシック手術の費用はいくらですか？",
    lastMessageTranslated: "라식 수술 비용이 얼마인가요?",
    lastMessageAt: new Date(Date.now() - 5 * 60 * 1000),
    status: "urgent",
    unread: 2,
    aiConfidence: null,
    consultationTag: "first_booking",
    customerTags: ["VIP", "가격문의"],
    assignee: "김코디",
    isPinned: true,
    sentimentScore: 0.6,
  },
  {
    id: "2",
    customer: { name: "이환자", country: "한국", language: "ko", avatar: "LH" },
    hospital: hospitals[1],
    channel: "kakao",
    lastMessage: "예약 변경하고 싶어요",
    lastMessageTranslated: null,
    lastMessageAt: new Date(Date.now() - 60 * 60 * 1000),
    status: "pending",
    unread: 0,
    aiConfidence: null,
    consultationTag: "confirmed",
    customerTags: ["리피터"],
    assignee: "박상담",
    sentimentScore: 0.3,
  },
  {
    id: "3",
    customer: { name: "박환자", country: "대만", language: "zh-TW", avatar: "PH" },
    hospital: hospitals[2],
    channel: "instagram",
    lastMessage: "수술 전후 사진 보고 싶어요",
    lastMessageTranslated: null,
    lastMessageAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    status: "resolved",
    unread: 0,
    aiConfidence: 92,
    consultationTag: "completed",
    customerTags: ["인플루언서"],
    sentimentScore: 0.9,
  },
  {
    id: "4",
    customer: { name: "John Smith", country: "미국", language: "en", avatar: "JS" },
    hospital: hospitals[0],
    channel: "whatsapp",
    lastMessage: "What's the price for LASIK surgery?",
    lastMessageTranslated: "라식 수술 가격이 어떻게 되나요?",
    lastMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    status: "ai_processing",
    unread: 1,
    aiConfidence: 87,
    consultationTag: "prospect",
    customerTags: ["가격문의"],
    sentimentScore: 0.5,
  },
  {
    id: "5",
    customer: { name: "田中太郎", country: "일본", language: "ja", avatar: "TT" },
    hospital: hospitals[3],
    channel: "line",
    lastMessage: "治療の予約をしたいです",
    lastMessageTranslated: "치료 예약을 하고 싶습니다",
    lastMessageAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    status: "pending",
    unread: 0,
    aiConfidence: null,
    consultationTag: "potential",
    customerTags: [],
    assignee: "이상담",
    sentimentScore: 0.7,
  },
  {
    id: "6",
    customer: { name: "Sarah Johnson", country: "영국", language: "en", avatar: "SJ" },
    hospital: hospitals[4],
    channel: "whatsapp",
    lastMessage: "Can I get a quote for rhinoplasty?",
    lastMessageTranslated: "코 성형 견적을 받을 수 있을까요?",
    lastMessageAt: new Date(Date.now() - 45 * 60 * 1000),
    status: "waiting",
    unread: 1,
    aiConfidence: 78,
    consultationTag: "prospect",
    customerTags: ["가격문의", "현지에이전트"],
    sentimentScore: 0.4,
  },
  {
    id: "7",
    customer: { name: "Nguyen Thi", country: "베트남", language: "vi", avatar: "NT" },
    hospital: hospitals[5],
    channel: "facebook",
    lastMessage: "Tôi muốn đặt lịch khám mắt",
    lastMessageTranslated: "눈 검사 예약을 하고 싶습니다",
    lastMessageAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
    status: "on_hold",
    unread: 0,
    aiConfidence: null,
    consultationTag: "potential",
    customerTags: ["통역필요"],
    sentimentScore: 0.5,
  },
];

const mockMessages: Message[] = [
  {
    id: "m0",
    sender: "system",
    content: "대화가 시작되었습니다 — LINE 채널, 힐링안과",
    time: "14:25",
  },
  {
    id: "m1",
    sender: "customer",
    content: "ラシック手術の費用はいくらですか？",
    translatedContent: "라식 수술 비용이 얼마인가요?",
    time: "14:30",
    language: "ja",
  },
  {
    id: "m2",
    sender: "ai",
    content: "라식 수술 비용은 양안 기준 150만원~200만원입니다. 정확한 비용은 사전 검사 후 확정됩니다. 상담 예약을 도와드릴까요?",
    translatedContent: "ラシック手術の費用は両眼で150万ウォン〜200万ウォンです。正確な費用は事前検査後に確定します。相談予約をお手伝いしましょうか？",
    time: "14:31",
    confidence: 92,
    sources: ["가격표.pdf", "라식FAQ.md"],
  },
  {
    id: "m-internal-1",
    sender: "internal_note",
    content: "VIP 고객입니다. 특별 할인 적용 가능 — 담당: 김코디",
    time: "14:32",
    author: "김코디",
  },
  {
    id: "m3",
    sender: "customer",
    content: "はい、予約したいです。来月の15日は空いていますか？",
    translatedContent: "네, 예약하고 싶어요. 다음달 15일 가능한가요?",
    time: "14:35",
    language: "ja",
  },
  {
    id: "m-internal-2",
    sender: "internal_note",
    content: "@박상담 2월 15일 예약 가능 여부 확인 부탁드립니다.",
    time: "14:36",
    author: "김코디",
    mentions: ["박상담"],
  },
  {
    id: "m4",
    sender: "agent",
    content: "2월 15일 오전 10시에 상담 예약 가능합니다. 예약 진행할까요?",
    translatedContent: "2月15日午前10時に相談予約可能です。予約を進めましょうか？",
    time: "14:40",
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
  customerTags: ["VIP", "가격문의"],
  notes: "일본 도쿄 거주, 한국어 가능, 2월 방문 예정",
  crmId: "CRM-12345",
  firstContact: "2024-01-20",
  totalConversations: 5,
  lastVisit: "2024-01-25",
  sentimentTrend: "positive",
  conversionScore: 85,
};

// ── Utility Functions ──

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

function getChannelConfig(channel: string) {
  const configs: Record<string, { bg: string; text: string; label: string }> = {
    line: { bg: "bg-[#06C755]", text: "text-white", label: "LINE" },
    whatsapp: { bg: "bg-[#25D366]", text: "text-white", label: "WhatsApp" },
    kakao: { bg: "bg-[#FEE500]", text: "text-[#3C1E1E]", label: "카카오" },
    instagram: { bg: "bg-gradient-to-r from-[#f09433] to-[#bc1888]", text: "text-white", label: "Instagram" },
    facebook: { bg: "bg-[#1877F2]", text: "text-white", label: "Facebook" },
    wechat: { bg: "bg-[#07C160]", text: "text-white", label: "WeChat" },
  };
  return configs[channel] || { bg: "bg-gray-500", text: "text-white", label: channel };
}

function getSentimentColor(score?: number): string {
  if (!score) return "text-gray-400";
  if (score >= 0.7) return "text-green-500";
  if (score >= 0.4) return "text-yellow-500";
  return "text-red-500";
}

function getSentimentLabel(score?: number): string {
  if (!score) return "분석 중";
  if (score >= 0.7) return "긍정";
  if (score >= 0.4) return "중립";
  return "부정";
}

// ── Animation Presets ──
const smoothEase = [0.22, 1, 0.36, 1] as [number, number, number, number];

// ── Hospital Multi-Select Component ──

function HospitalMultiSelect({
  selected,
  onSelect,
}: {
  selected: string[];
  onSelect: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const allSelected = selected.length === 0; // empty means "all"

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs rounded-lg gap-1.5 max-w-[220px]"
        >
          <Building2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {allSelected
              ? "전체 거래처"
              : selected.length === 1
              ? hospitals.find((h) => h.id === selected[0])?.name || "1개 선택"
              : `${selected.length}개 거래처`}
          </span>
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="거래처 검색..." className="h-9" />
          <CommandList>
            <CommandEmpty>검색 결과가 없습니다</CommandEmpty>
            <CommandGroup>
              <CommandItem
                onSelect={() => onSelect([])}
                className="gap-2"
              >
                <div className={cn(
                  "h-4 w-4 rounded border flex items-center justify-center",
                  allSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                )}>
                  {allSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                <span className="font-medium">전체 거래처</span>
                <Badge variant="secondary" className="ml-auto text-[10px] h-5">
                  {hospitals.length}
                </Badge>
              </CommandItem>
              <Separator className="my-1" />
              {hospitals.map((hospital) => {
                const isSelected = selected.includes(hospital.id);
                return (
                  <CommandItem
                    key={hospital.id}
                    onSelect={() => {
                      if (isSelected) {
                        onSelect(selected.filter((id) => id !== hospital.id));
                      } else {
                        onSelect([...selected, hospital.id]);
                      }
                    }}
                    className="gap-2"
                  >
                    <div className={cn(
                      "h-4 w-4 rounded border flex items-center justify-center",
                      isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                    )}>
                      {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <div
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: hospital.color }}
                    />
                    <span className="truncate">{hospital.name}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{hospital.specialty}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        {selected.length > 0 && (
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-xs"
              onClick={() => {
                onSelect([]);
                setOpen(false);
              }}
            >
              <X className="h-3 w-3 mr-1" />
              필터 초기화
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ── Tag Filter Component ──

function TagFilterPanel({
  selectedConsultationTags,
  selectedStatusTags,
  selectedCustomerTags,
  onConsultationTagChange,
  onStatusTagChange,
  onCustomerTagChange,
}: {
  selectedConsultationTags: ConsultationTag[];
  selectedStatusTags: StatusTag[];
  selectedCustomerTags: CustomerTag[];
  onConsultationTagChange: (tags: ConsultationTag[]) => void;
  onStatusTagChange: (tags: StatusTag[]) => void;
  onCustomerTagChange: (tags: CustomerTag[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const totalActive = selectedConsultationTags.length + selectedStatusTags.length + selectedCustomerTags.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={totalActive > 0 ? "secondary" : "outline"}
          size="sm"
          className={cn(
            "h-8 text-xs rounded-lg gap-1.5",
            totalActive > 0 && "bg-primary/10 text-primary border-primary/20"
          )}
        >
          <Filter className="h-3.5 w-3.5" />
          태그 필터
          {totalActive > 0 && (
            <Badge className="h-4 w-4 p-0 flex items-center justify-center text-[9px] rounded-full ml-0.5">
              {totalActive}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-3 space-y-3 max-h-[400px] overflow-y-auto">
          {/* 상담 태그 */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Hash className="h-3 w-3" /> 상담 단계
            </p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(consultationTagConfig).map(([key, config]) => {
                const isActive = selectedConsultationTags.includes(key as ConsultationTag);
                return (
                  <Button
                    key={key}
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    className={cn(
                      "h-6 text-[10px] px-2 rounded-full",
                      isActive && cn(config.bg, config.color, "font-semibold")
                    )}
                    onClick={() => {
                      if (isActive) {
                        onConsultationTagChange(selectedConsultationTags.filter((t) => t !== key));
                      } else {
                        onConsultationTagChange([...selectedConsultationTags, key as ConsultationTag]);
                      }
                    }}
                  >
                    {config.emoji} {config.label}
                  </Button>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* 상태 태그 */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Palette className="h-3 w-3" /> 상태
            </p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(statusTagConfig).map(([key, config]) => {
                const isActive = selectedStatusTags.includes(key as StatusTag);
                const Icon = config.icon;
                return (
                  <Button
                    key={key}
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    className={cn(
                      "h-6 text-[10px] px-2 rounded-full",
                      isActive && cn(config.bg, config.color, "font-semibold")
                    )}
                    onClick={() => {
                      if (isActive) {
                        onStatusTagChange(selectedStatusTags.filter((t) => t !== key));
                      } else {
                        onStatusTagChange([...selectedStatusTags, key as StatusTag]);
                      }
                    }}
                  >
                    <Icon className="h-2.5 w-2.5 mr-0.5" />
                    {config.label}
                  </Button>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* 고객 태그 */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Tag className="h-3 w-3" /> 고객 태그
            </p>
            <div className="flex flex-wrap gap-1">
              {customerTagPresets.map((tag) => {
                const isActive = selectedCustomerTags.includes(tag.label);
                return (
                  <Button
                    key={tag.label}
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    className={cn(
                      "h-6 text-[10px] px-2 rounded-full",
                      isActive && cn(tag.bg, tag.color, "font-semibold")
                    )}
                    onClick={() => {
                      if (isActive) {
                        onCustomerTagChange(selectedCustomerTags.filter((t) => t !== tag.label));
                      } else {
                        onCustomerTagChange([...selectedCustomerTags, tag.label]);
                      }
                    }}
                  >
                    {tag.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        {totalActive > 0 && (
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-xs"
              onClick={() => {
                onConsultationTagChange([]);
                onStatusTagChange([]);
                onCustomerTagChange([]);
              }}
            >
              <X className="h-3 w-3 mr-1" />
              전체 필터 초기화 ({totalActive}개 활성)
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ── Main Component ──

export default function InboxPage() {
  // State
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(mockConversations[0]);
  const [showTranslation, setShowTranslation] = useState(true);
  const [messageInput, setMessageInput] = useState("");
  const [filterChannel, setFilterChannel] = useState("all");
  const [selectedHospitals, setSelectedHospitals] = useState<string[]>([]);
  const [selectedConsultationTags, setSelectedConsultationTags] = useState<ConsultationTag[]>([]);
  const [selectedStatusTags, setSelectedStatusTags] = useState<StatusTag[]>([]);
  const [selectedCustomerTags, setSelectedCustomerTags] = useState<CustomerTag[]>([]);
  const [messageViewMode, setMessageViewMode] = useState<"all" | "customer" | "internal">("all");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [quickReplyMode, setQuickReplyMode] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  }, []);

  // Auto-scroll on conversation select or new message
  useEffect(() => {
    scrollToBottom("instant");
  }, [selectedConversation, scrollToBottom]);

  // Detect scroll position for "scroll to bottom" button
  const handleMessagesScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 100;
    setShowScrollButton(!isNearBottom);
  }, []);

  // Filter conversations
  const filteredConversations = useMemo(() => {
    return mockConversations.filter((conv) => {
      // Hospital filter
      if (selectedHospitals.length > 0 && !selectedHospitals.includes(conv.hospital.id)) return false;
      // Channel filter
      if (filterChannel !== "all" && conv.channel !== filterChannel) return false;
      // Consultation tag filter
      if (selectedConsultationTags.length > 0 && !selectedConsultationTags.includes(conv.consultationTag)) return false;
      // Status tag filter
      if (selectedStatusTags.length > 0 && !selectedStatusTags.includes(conv.status)) return false;
      // Customer tag filter
      if (selectedCustomerTags.length > 0 && !selectedCustomerTags.some((t) => conv.customerTags.includes(t))) return false;
      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          conv.customer.name.toLowerCase().includes(q) ||
          conv.lastMessage.toLowerCase().includes(q) ||
          (conv.lastMessageTranslated?.toLowerCase().includes(q) || false) ||
          conv.hospital.name.toLowerCase().includes(q)
        );
      }
      return true;
    }).sort((a, b) => {
      // Pin first
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      // Then by urgency
      const urgencyOrder: Record<StatusTag, number> = { urgent: 0, waiting: 1, pending: 2, ai_processing: 3, on_hold: 4, resolved: 5 };
      const urgencyDiff = (urgencyOrder[a.status] || 99) - (urgencyOrder[b.status] || 99);
      if (urgencyDiff !== 0) return urgencyDiff;
      // Then by time (newest first)
      return b.lastMessageAt.getTime() - a.lastMessageAt.getTime();
    });
  }, [selectedHospitals, filterChannel, selectedConsultationTags, selectedStatusTags, selectedCustomerTags, searchQuery]);

  // Filter messages
  const filteredMessages = useMemo(() => {
    return mockMessages.filter((msg) => {
      if (messageViewMode === "all") return true;
      if (messageViewMode === "customer") return msg.sender !== "internal_note";
      if (messageViewMode === "internal") return msg.sender === "internal_note";
      return true;
    });
  }, [messageViewMode]);

  // Active filters count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedHospitals.length > 0) count++;
    if (filterChannel !== "all") count++;
    if (selectedConsultationTags.length > 0) count++;
    if (selectedStatusTags.length > 0) count++;
    if (selectedCustomerTags.length > 0) count++;
    return count;
  }, [selectedHospitals, filterChannel, selectedConsultationTags, selectedStatusTags, selectedCustomerTags]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K: Focus search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>("[data-search-input]");
        searchInput?.focus();
      }
      // Escape: Clear search or deselect
      if (e.key === "Escape") {
        if (searchQuery) setSearchQuery("");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchQuery]);

  return (
    <div className="h-full">
      <ResizablePanelGroup orientation="horizontal" className="h-full">
        {/* ─── Left Panel: Conversation List ─── */}
        <ResizablePanel id="left" defaultSize="28%" minSize="20%" maxSize="45%">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: smoothEase }}
            className="h-full flex flex-col border rounded-2xl bg-card/80 backdrop-blur-sm overflow-hidden"
          >
            {/* Header */}
            <div className="p-3 border-b space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
                    <MessageCircle className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-sm">통합 인박스</h2>
                    <p className="text-[10px] text-muted-foreground">
                      {filteredConversations.length}/{mockConversations.length}건
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {activeFilterCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] px-2 rounded-full text-red-500 hover:text-red-600"
                      onClick={() => {
                        setSelectedHospitals([]);
                        setFilterChannel("all");
                        setSelectedConsultationTags([]);
                        setSelectedStatusTags([]);
                        setSelectedCustomerTags([]);
                        setSearchQuery("");
                      }}
                    >
                      <X className="h-2.5 w-2.5 mr-0.5" />
                      초기화
                    </Button>
                  )}
                  <Badge variant="outline" className="text-[10px] border-violet-500/30 text-violet-500 bg-violet-500/5">
                    <Zap className="h-2.5 w-2.5 mr-0.5" />
                    실시간
                  </Badge>
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  data-search-input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="고객, 병원, 메시지 검색... (⌘K)"
                  className="pl-9 pr-8 bg-muted/50 border-0 rounded-xl h-8 text-xs"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                    onClick={() => setSearchQuery("")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {/* Filter Row */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <HospitalMultiSelect
                  selected={selectedHospitals}
                  onSelect={setSelectedHospitals}
                />

                <Select value={filterChannel} onValueChange={setFilterChannel}>
                  <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[90px]">
                    <SelectValue placeholder="채널" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 채널</SelectItem>
                    <SelectItem value="line">LINE</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="kakao">카카오톡</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="wechat">WeChat</SelectItem>
                  </SelectContent>
                </Select>

                <TagFilterPanel
                  selectedConsultationTags={selectedConsultationTags}
                  selectedStatusTags={selectedStatusTags}
                  selectedCustomerTags={selectedCustomerTags}
                  onConsultationTagChange={setSelectedConsultationTags}
                  onStatusTagChange={setSelectedStatusTags}
                  onCustomerTagChange={setSelectedCustomerTags}
                />
              </div>

              {/* Active Filter Chips */}
              {activeFilterCount > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedHospitals.map((id) => {
                    const h = hospitals.find((h) => h.id === id);
                    return h ? (
                      <Badge key={id} variant="secondary" className="h-5 text-[10px] rounded-full gap-1 pl-1.5">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: h.color }} />
                        {h.name}
                        <X className="h-2.5 w-2.5 cursor-pointer opacity-60 hover:opacity-100"
                          onClick={() => setSelectedHospitals(selectedHospitals.filter((s) => s !== id))}
                        />
                      </Badge>
                    ) : null;
                  })}
                  {selectedConsultationTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className={cn("h-5 text-[10px] rounded-full gap-1", consultationTagConfig[tag].bg, consultationTagConfig[tag].color)}>
                      {consultationTagConfig[tag].label}
                      <X className="h-2.5 w-2.5 cursor-pointer opacity-60 hover:opacity-100"
                        onClick={() => setSelectedConsultationTags(selectedConsultationTags.filter((t) => t !== tag))}
                      />
                    </Badge>
                  ))}
                  {selectedStatusTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className={cn("h-5 text-[10px] rounded-full gap-1", statusTagConfig[tag].bg, statusTagConfig[tag].color)}>
                      {statusTagConfig[tag].label}
                      <X className="h-2.5 w-2.5 cursor-pointer opacity-60 hover:opacity-100"
                        onClick={() => setSelectedStatusTags(selectedStatusTags.filter((t) => t !== tag))}
                      />
                    </Badge>
                  ))}
                  {selectedCustomerTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="h-5 text-[10px] rounded-full gap-1">
                      {tag}
                      <X className="h-2.5 w-2.5 cursor-pointer opacity-60 hover:opacity-100"
                        onClick={() => setSelectedCustomerTags(selectedCustomerTags.filter((t) => t !== tag))}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Conversation List */}
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                <AnimatePresence mode="popLayout">
                  {filteredConversations.map((conv, index) => {
                    const status = statusTagConfig[conv.status];
                    const channel = getChannelConfig(conv.channel);
                    const isSelected = selectedConversation?.id === conv.id;

                    return (
                      <motion.div
                        key={conv.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.3, delay: index * 0.02, ease: smoothEase }}
                        onClick={() => setSelectedConversation(conv)}
                        className={cn(
                          "p-3 rounded-xl cursor-pointer transition-all duration-200 group",
                          isSelected
                            ? "bg-primary/8 border border-primary/20 shadow-sm"
                            : "hover:bg-muted/50",
                          conv.isPinned && !isSelected && "border-l-2 border-l-amber-400"
                        )}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="relative">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback className={cn(
                                "text-xs font-medium",
                                isSelected ? "bg-primary/15 text-primary" : "bg-muted"
                              )}>
                                {conv.customer.avatar}
                              </AvatarFallback>
                            </Avatar>
                            {conv.status === "urgent" && (
                              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-background status-urgent-pulse" />
                            )}
                            {conv.status === "ai_processing" && (
                              <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-violet-500/20 flex items-center justify-center">
                                <Bot className="h-2.5 w-2.5 text-violet-500" />
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                              <span className={cn("px-1.5 py-0.5 rounded-md text-[9px] font-medium shrink-0", channel.bg, channel.text)}>
                                {channel.label}
                              </span>
                              <span className="text-[10px] font-medium truncate" style={{ color: conv.hospital.color }}>
                                {conv.hospital.name}
                              </span>
                              {conv.isPinned && (
                                <Bookmark className="h-2.5 w-2.5 text-amber-500 fill-amber-500 shrink-0" />
                              )}
                            </div>
                            <div className="flex items-center gap-1 mb-0.5">
                              <span className="font-medium text-sm truncate">{conv.customer.name}</span>
                              <span className="text-[10px] text-muted-foreground shrink-0">({conv.customer.country})</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {conv.lastMessageTranslated || conv.lastMessage}
                            </p>
                            {/* Tags row */}
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              <span className={cn(
                                "px-1.5 py-0.5 rounded-full text-[9px] font-medium",
                                consultationTagConfig[conv.consultationTag].bg,
                                consultationTagConfig[conv.consultationTag].color
                              )}>
                                {consultationTagConfig[conv.consultationTag].label}
                              </span>
                              {conv.customerTags.slice(0, 2).map((tag) => {
                                const preset = customerTagPresets.find((p) => p.label === tag);
                                return (
                                  <span key={tag} className={cn(
                                    "px-1.5 py-0.5 rounded-full text-[9px]",
                                    preset ? cn(preset.bg, preset.color) : "bg-muted text-muted-foreground"
                                  )}>
                                    {tag}
                                  </span>
                                );
                              })}
                              {conv.customerTags.length > 2 && (
                                <span className="text-[9px] text-muted-foreground">+{conv.customerTags.length - 2}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {conv.lastMessageAt && conv.status !== "resolved" && (
                              <div className={cn(
                                "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium",
                                getWaitTimeColor(conv.lastMessageAt).bg,
                                getWaitTimeColor(conv.lastMessageAt).color
                              )}>
                                <Timer className="h-2.5 w-2.5" />
                                {calculateWaitTime(conv.lastMessageAt)}
                              </div>
                            )}
                            {conv.status === "resolved" && (
                              <span className="text-[9px] text-muted-foreground">
                                {calculateWaitTime(conv.lastMessageAt)}
                              </span>
                            )}
                            <div className="flex items-center gap-1">
                              {conv.aiConfidence && (
                                <Badge variant="outline" className="h-4 px-1 text-[9px] bg-violet-500/10 text-violet-500 border-violet-500/20">
                                  <Bot className="h-2 w-2 mr-0.5" />
                                  {conv.aiConfidence}%
                                </Badge>
                              )}
                              {conv.unread > 0 && (
                                <Badge className="h-4 w-4 p-0 flex items-center justify-center text-[9px] rounded-full">
                                  {conv.unread}
                                </Badge>
                              )}
                            </div>
                            {conv.assignee && (
                              <span className="text-[9px] text-muted-foreground/70">{conv.assignee}</span>
                            )}
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

            {/* Quick Stats Footer */}
            <div className="p-2.5 border-t bg-muted/20">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                    긴급 {mockConversations.filter((c) => c.status === "urgent").length}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                    대기 {mockConversations.filter((c) => c.status === "pending" || c.status === "waiting").length}
                  </span>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-5 w-5">
                        <Keyboard className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="text-[10px]">⌘K 검색 | Esc 닫기</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </motion.div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* ─── Center Panel: Chat Area ─── */}
        <ResizablePanel id="center" defaultSize="44%" minSize="30%">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: smoothEase }}
            className="h-full flex flex-col border rounded-2xl bg-card/80 backdrop-blur-sm overflow-hidden"
          >
            {selectedConversation ? (
              <>
                {/* Chat Header */}
                <div className="p-3 border-b flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">
                          {selectedConversation.customer.avatar}
                        </AvatarFallback>
                      </Avatar>
                      {selectedConversation.status === "urgent" && (
                        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-background status-urgent-pulse" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{selectedConversation.customer.name}</span>
                        <span className="text-xs text-muted-foreground">({selectedConversation.customer.country})</span>
                        <Badge variant="outline" className={cn(
                          "h-5 text-[10px] rounded-full",
                          statusTagConfig[selectedConversation.status].bg,
                          statusTagConfig[selectedConversation.status].color
                        )}>
                          {statusTagConfig[selectedConversation.status].label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span className={cn("px-1.5 py-0.5 rounded-md text-[9px]", getChannelConfig(selectedConversation.channel).bg, getChannelConfig(selectedConversation.channel).text)}>
                          {getChannelConfig(selectedConversation.channel).label}
                        </span>
                        <span className="text-muted-foreground/40">•</span>
                        <span style={{ color: selectedConversation.hospital.color }}>{selectedConversation.hospital.name}</span>
                        {selectedConversation.assignee && (
                          <>
                            <span className="text-muted-foreground/40">•</span>
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {selectedConversation.assignee}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {/* Sentiment indicator */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className={cn("flex items-center gap-1 px-2 py-1 rounded-lg text-xs", getSentimentColor(selectedConversation.sentimentScore))}>
                            <Heart className="h-3 w-3" />
                            <span className="text-[10px]">{getSentimentLabel(selectedConversation.sentimentScore)}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">고객 감정 분석: {((selectedConversation.sentimentScore || 0) * 100).toFixed(0)}%</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <Button
                      variant={showTranslation ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setShowTranslation(!showTranslation)}
                      className={cn(
                        "h-7 text-[10px] rounded-lg",
                        showTranslation && "bg-blue-500/10 text-blue-600 hover:bg-blue-500/15 dark:text-blue-400"
                      )}
                    >
                      <Languages className="h-3 w-3 mr-1" />
                      번역 {showTranslation ? "ON" : "OFF"}
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel className="text-xs">대화 관리</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-xs">
                          <UserPlus className="h-3.5 w-3.5 mr-2" /> 담당자 변경
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-xs">
                          <Star className="h-3.5 w-3.5 mr-2" /> 북마크 토글
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-xs">
                          <Forward className="h-3.5 w-3.5 mr-2" /> 대화 전달
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-xs">
                          <History className="h-3.5 w-3.5 mr-2" /> 이전 대화 보기
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-xs text-green-600">
                          <CheckCircle2 className="h-3.5 w-3.5 mr-2" /> 해결 완료
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Message View Tabs */}
                <div className="px-3 py-1.5 border-b flex items-center gap-3">
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
                          "h-6 text-[10px] px-2.5 rounded-md transition-all",
                          messageViewMode === tab.key && "shadow-sm"
                        )}
                        onClick={() => setMessageViewMode(tab.key as typeof messageViewMode)}
                      >
                        <tab.icon className="h-3 w-3 mr-1" />
                        {tab.label}
                      </Button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 ml-auto text-[10px] text-muted-foreground">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span>AI 어시스턴트 활성</span>
                  </div>
                </div>

                {/* Messages Area - Fixed scroll */}
                <div
                  ref={messagesContainerRef}
                  className="flex-1 overflow-y-auto p-4"
                  onScroll={handleMessagesScroll}
                >
                  <div className="space-y-3 min-h-full flex flex-col justify-end">
                    <AnimatePresence>
                      {filteredMessages.map((msg, idx) => (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.35, delay: idx * 0.03, ease: smoothEase }}
                          className={cn(
                            "flex gap-2.5 group",
                            msg.sender === "customer" ? "justify-start" :
                            msg.sender === "internal_note" ? "justify-center" :
                            msg.sender === "system" ? "justify-center" : "justify-end"
                          )}
                        >
                          {/* System message */}
                          {msg.sender === "system" && (
                            <div className="text-[10px] text-muted-foreground/60 bg-muted/30 px-3 py-1 rounded-full">
                              {msg.content}
                            </div>
                          )}

                          {/* Internal note */}
                          {msg.sender === "internal_note" && (
                            <div className="max-w-[85%] w-full">
                              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/50 rounded-xl px-4 py-2.5">
                                <div className="flex items-center gap-2 mb-1 text-[10px] text-amber-700 dark:text-amber-400">
                                  <StickyNote className="h-3 w-3" />
                                  <span className="font-semibold">내부 노트</span>
                                  <span className="text-amber-600/60 dark:text-amber-500/60">• {msg.author}</span>
                                  <span className="ml-auto text-amber-600/40">{msg.time}</span>
                                </div>
                                <p className="text-sm text-amber-900 dark:text-amber-100">{msg.content}</p>
                                {msg.mentions && msg.mentions.length > 0 && (
                                  <div className="flex items-center gap-1 mt-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                                    <AtSign className="h-3 w-3" />
                                    {msg.mentions.join(", ")}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Customer / AI / Agent messages */}
                          {msg.sender !== "internal_note" && msg.sender !== "system" && (
                            <>
                              {msg.sender === "customer" && (
                                <Avatar className="h-7 w-7 flex-shrink-0 mt-1">
                                  <AvatarFallback className="bg-muted text-[10px]">
                                    {selectedConversation.customer.avatar}
                                  </AvatarFallback>
                                </Avatar>
                              )}
                              <div className={cn(
                                "max-w-[70%] space-y-0.5",
                                msg.sender === "customer" ? "items-start" : "items-end"
                              )}>
                                <div className={cn(
                                  "rounded-2xl px-4 py-2.5 relative",
                                  msg.sender === "customer"
                                    ? "bg-muted/80 rounded-tl-sm"
                                    : msg.sender === "ai"
                                    ? "bg-violet-500/8 border border-violet-500/15 rounded-tr-sm"
                                    : "bg-primary text-primary-foreground rounded-tr-sm"
                                )}>
                                  {msg.sender === "ai" && (
                                    <div className="flex items-center gap-1.5 mb-1.5 text-[10px] text-violet-600 dark:text-violet-400">
                                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-violet-500/10">
                                        <Sparkles className="h-2.5 w-2.5" />
                                        <span className="font-semibold">AI 어시스턴트</span>
                                      </div>
                                      {msg.confidence && (
                                        <Badge variant="outline" className="h-4 px-1.5 text-[9px] border-violet-500/20 bg-violet-500/5 text-violet-600 dark:text-violet-400">
                                          신뢰도 {msg.confidence}%
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                  <p className="text-sm leading-relaxed">{msg.content}</p>
                                  {showTranslation && msg.translatedContent && (
                                    <div className="mt-2 pt-2 border-t border-border/40">
                                      <div className="flex items-center gap-1 text-[9px] text-muted-foreground mb-0.5">
                                        <Globe className="h-2.5 w-2.5" />
                                        번역
                                      </div>
                                      <p className="text-xs text-muted-foreground leading-relaxed">{msg.translatedContent}</p>
                                    </div>
                                  )}
                                  {/* Message actions on hover */}
                                  <div className="absolute -top-3 right-2 hidden group-hover:flex items-center gap-0.5 bg-card border rounded-lg shadow-sm p-0.5">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-5 w-5">
                                            <Copy className="h-2.5 w-2.5" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent><p className="text-[10px]">복사</p></TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-5 w-5">
                                            <Reply className="h-2.5 w-2.5" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent><p className="text-[10px]">답장</p></TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 px-1">
                                  <span className="text-[9px] text-muted-foreground">{msg.time}</span>
                                  {msg.sources && (
                                    <span className="text-[9px] text-muted-foreground">
                                      • 참조: {msg.sources.join(", ")}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {(msg.sender === "ai") && (
                                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-violet-500/20 to-blue-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                                  <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                                </div>
                              )}
                              {msg.sender === "agent" && (
                                <Avatar className="h-7 w-7 flex-shrink-0 mt-1">
                                  <AvatarFallback className="bg-primary/10 text-primary text-[10px]">CS</AvatarFallback>
                                </Avatar>
                              )}
                            </>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    <div ref={messagesEndRef} />
                  </div>
                </div>

                {/* Scroll to bottom button */}
                <AnimatePresence>
                  {showScrollButton && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="absolute bottom-32 left-1/2 -translate-x-1/2 z-10"
                    >
                      <Button
                        variant="secondary"
                        size="sm"
                        className="rounded-full shadow-lg h-8 text-xs gap-1"
                        onClick={() => scrollToBottom()}
                      >
                        <ArrowDown className="h-3 w-3" />
                        최신 메시지
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Message Input */}
                <div className="p-3 border-t bg-card/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Button
                      variant={isInternalNote ? "secondary" : "ghost"}
                      size="sm"
                      className={cn(
                        "h-6 text-[10px] rounded-lg transition-all",
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
                        className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1"
                      >
                        <Shield className="h-3 w-3" />
                        고객에게 보이지 않습니다
                      </motion.span>
                    )}
                    <div className="ml-auto flex items-center gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant={quickReplyMode ? "secondary" : "ghost"}
                              size="sm"
                              className="h-6 text-[10px] rounded-lg"
                              onClick={() => setQuickReplyMode(!quickReplyMode)}
                            >
                              <Zap className="h-3 w-3 mr-0.5" />
                              빠른답변
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-[10px]">자주 쓰는 답변 템플릿</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>

                  {/* Quick Reply Templates */}
                  <AnimatePresence>
                    {quickReplyMode && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-2 overflow-hidden"
                      >
                        <div className="flex gap-1.5 flex-wrap p-2 rounded-lg bg-muted/30">
                          {["안녕하세요, 문의 감사합니다.", "예약 도와드리겠습니다.", "가격은 상담 후 안내드립니다.", "담당 코디네이터 연결해드리겠습니다."].map((reply) => (
                            <Button
                              key={reply}
                              variant="outline"
                              size="sm"
                              className="h-6 text-[10px] rounded-full"
                              onClick={() => setMessageInput(reply)}
                            >
                              {reply}
                            </Button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex items-end gap-2">
                    <div className="flex-1 relative">
                      <Textarea
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        placeholder={isInternalNote ? "팀원에게 메모를 남기세요... (@멘션 가능)" : "메시지를 입력하세요... (자동 번역됩니다)"}
                        className={cn(
                          "min-h-[72px] max-h-[150px] pr-20 resize-none rounded-xl transition-all text-sm",
                          isInternalNote && "border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30 focus-visible:ring-amber-400"
                        )}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            // Send message logic
                            if (messageInput.trim()) {
                              setMessageInput("");
                            }
                          }
                        }}
                      />
                      <div className="absolute bottom-2 right-2 flex items-center gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 rounded-lg">
                                <Paperclip className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p className="text-[10px]">파일 첨부</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {!isInternalNote && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-lg">
                                  <Bot className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p className="text-[10px]">AI 답변 추천</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {isInternalNote && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-lg">
                                  <AtSign className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p className="text-[10px]">팀원 멘션</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      className={cn(
                        "h-9 w-9 rounded-xl transition-all",
                        isInternalNote ? "bg-amber-500 hover:bg-amber-600" : "bg-primary hover:bg-primary/90"
                      )}
                      onClick={() => {
                        if (messageInput.trim()) {
                          setMessageInput("");
                        }
                      }}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                    {!isInternalNote ? (
                      <>
                        <div className="flex items-center gap-1">
                          <Globe className="h-2.5 w-2.5 text-blue-500" />
                          <span>DeepL 자동번역</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Sparkles className="h-2.5 w-2.5 text-violet-500" />
                          <span>AI 제안</span>
                        </div>
                        <span className="ml-auto text-muted-foreground/60">Enter 전송 | Shift+Enter 줄바꿈</span>
                      </>
                    ) : (
                      <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <Lock className="h-2.5 w-2.5" />
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
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* ─── Right Panel: Customer Profile ─── */}
        <ResizablePanel id="right" defaultSize="28%" minSize="18%" maxSize="40%">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: smoothEase }}
            className="h-full border rounded-2xl bg-card/80 backdrop-blur-sm overflow-hidden"
          >
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                {/* Profile Header */}
                <div className="text-center">
                  <div className="relative inline-block">
                    <Avatar className="h-14 w-14 mx-auto mb-2 ring-2 ring-primary/10 ring-offset-2 ring-offset-background">
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-violet-500/20 text-primary text-lg font-medium">
                        {customerProfile.name.slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
                      <Heart className="h-2.5 w-2.5 text-white" />
                    </div>
                  </div>
                  <h3 className="font-semibold">{customerProfile.name}</h3>
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    <span className="text-xs text-muted-foreground">{customerProfile.country}</span>
                  </div>

                  {/* Conversion Score */}
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20">
                            <Zap className="h-3 w-3 text-green-500" />
                            <span className="text-[11px] font-semibold text-green-600 dark:text-green-400">전환 {customerProfile.conversionScore}%</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">AI 예측 전환 확률</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  {/* Consultation Tag Select */}
                  <div className="mt-3">
                    <Select defaultValue={customerProfile.consultationTag}>
                      <SelectTrigger className="w-full h-8 rounded-lg text-xs">
                        <SelectValue placeholder="상담 단계 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(consultationTagConfig).map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", config.bg, config.color)}>
                              {config.emoji} {config.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                {/* Customer Tags */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-medium flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                      고객 태그
                    </h4>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-5 w-5">
                          <Plus className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuLabel className="text-[10px]">태그 추가</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {customerTagPresets.map((tag) => (
                          <DropdownMenuItem key={tag.label} className="text-xs">
                            <span className={cn("px-1.5 py-0.5 rounded-full text-[10px]", tag.bg, tag.color)}>
                              {tag.label}
                            </span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {customerProfile.customerTags.map((tag) => {
                      const preset = customerTagPresets.find((p) => p.label === tag);
                      return (
                        <Badge key={tag} variant="secondary" className={cn(
                          "text-[10px] rounded-full gap-1",
                          preset ? cn(preset.bg, preset.color) : ""
                        )}>
                          {tag}
                          <X className="h-2.5 w-2.5 cursor-pointer opacity-60 hover:opacity-100" />
                        </Badge>
                      );
                    })}
                  </div>
                </div>

                <Separator />

                {/* Quick Info */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-lg bg-muted/30 text-center">
                    <p className="text-[10px] text-muted-foreground">총 대화</p>
                    <p className="text-sm font-semibold">{customerProfile.totalConversations}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30 text-center">
                    <p className="text-[10px] text-muted-foreground">첫 접촉</p>
                    <p className="text-sm font-semibold">{customerProfile.firstContact.slice(5)}</p>
                  </div>
                </div>

                <Separator />

                {/* Connected Channels */}
                <div className="space-y-2">
                  <h4 className="text-xs font-medium flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    연결된 채널
                  </h4>
                  <div className="space-y-1.5">
                    {customerProfile.channels.map((ch, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-muted/30">
                        <span className={cn("px-1.5 py-0.5 rounded-md text-[9px]", getChannelConfig(ch.type).bg, getChannelConfig(ch.type).text)}>
                          {getChannelConfig(ch.type).label}
                        </span>
                        <span className="text-muted-foreground text-[10px] truncate">{ch.id}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Location */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-medium flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    위치
                  </h4>
                  <p className="text-xs text-muted-foreground">{customerProfile.city}, {customerProfile.country}</p>
                </div>

                <Separator />

                {/* Booking Info */}
                {customerProfile.booking && (
                  <>
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-medium flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        예약 정보
                      </h4>
                      <div className="p-2.5 rounded-xl bg-gradient-to-r from-primary/5 to-violet-500/5 border border-primary/10">
                        <p className="text-xs font-medium">{customerProfile.booking.type}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {customerProfile.booking.date} {customerProfile.booking.time}
                        </p>
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

                {/* Interests */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-medium flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                    관심 시술
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {customerProfile.interests.map((interest) => (
                      <Badge key={interest} variant="outline" className="text-[10px] rounded-full">
                        {interest}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Notes */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-medium">메모</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{customerProfile.notes}</p>
                </div>

                <Separator />

                {/* Action Buttons */}
                <div className="space-y-1.5">
                  <Button variant="outline" className="w-full justify-start rounded-lg text-xs" size="sm">
                    <Calendar className="h-3.5 w-3.5 mr-2" />
                    예약 등록
                  </Button>
                  <Button variant="outline" className="w-full justify-start rounded-lg text-xs" size="sm">
                    <ExternalLink className="h-3.5 w-3.5 mr-2" />
                    CRM에서 열기
                  </Button>
                  <Button variant="outline" className="w-full justify-start rounded-lg text-xs" size="sm">
                    <History className="h-3.5 w-3.5 mr-2" />
                    이전 대화 내역
                  </Button>
                </div>
              </div>
            </ScrollArea>
          </motion.div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
