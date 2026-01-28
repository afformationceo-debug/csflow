"use client";

import { useState, useRef, useEffect, useCallback, useMemo, type CompositionEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Trash2,
  AlertTriangle,
  Save,
  Edit3,
  Volume2,
  Brain,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

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
    avatarUrl?: string | null;
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

interface RAGSource {
  type: "system_prompt" | "knowledge_base" | "tenant_config" | "conversation_history" | "feedback_db";
  name: string;
  description?: string;
  relevanceScore?: number;
}

interface Message {
  id: string;
  sender: MessageType;
  content: string;
  translatedContent?: string;
  time: string;
  language?: string;
  confidence?: number;
  sources?: RAGSource[];  // Updated type
  author?: string;
  mentions?: string[];
  isEdited?: boolean;
  reactions?: { emoji: string; count: number }[];
  direction?: "inbound" | "outbound";
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

// 거래처(병원) 목록은 DB에서 로드 — hospitals state로 관리

// Mock data removed — all data loaded from DB only

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
  hospitals,
}: {
  selected: string[];
  onSelect: (ids: string[]) => void;
  hospitals: Hospital[];
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
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
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

  // Translation preview state
  const [autoTranslateEnabled, setAutoTranslateEnabled] = useState(true);
  const [targetLanguage, setTargetLanguage] = useState("JA");
  const [translationPreview, setTranslationPreview] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const translationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // DB state
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [dbConversations, setDbConversations] = useState<Conversation[]>([]);
  const [dbMessages, setDbMessages] = useState<Message[]>([]);
  const [dbCustomerProfile, setDbCustomerProfile] = useState<{
    name: string;
    country: string;
    city: string;
    language: string;
    channels: { type: string; id: string }[];
    interests: string[];
    booking: { date: string; time: string; type: string } | undefined;
    consultationTag: ConsultationTag;
    customerTags: string[];
    notes: string;
    crmId: string;
    firstContact: string;
    totalConversations: number;
    lastVisit: string;
    sentimentTrend: string;
    conversionScore: number;
  } | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // IME composition tracking (prevents Korean duplicate send)
  const isComposingRef = useRef(false);

  // Notification sound
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastNotifTimeRef = useRef(0);

  // Delete dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Memo editing
  const [isEditingMemo, setIsEditingMemo] = useState(false);
  const [memoText, setMemoText] = useState("");

  // Auto-detected interests & concerns
  const [detectedInterests, setDetectedInterests] = useState<string[]>([]);
  const [detectedConcerns, setDetectedConcerns] = useState<string[]>([]);

  // Team members for assignment
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string; role: string }[]>([]);

  // AI recommendation state (Issue 1)
  const [aiSuggestion, setAiSuggestion] = useState<{
    original: string;
    korean: string;
    confidence?: number;
    shouldEscalate?: boolean;
    escalationReason?: string;
  } | null>(null);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [ragLogs, setRagLogs] = useState<string[]>([]);
  const [ragSources, setRagSources] = useState<any[]>([]);
  const [showRagLogs, setShowRagLogs] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Translation language config
  const translationLanguages = [
    { code: "JA", label: "日本語", flag: "🇯🇵" },
    { code: "EN", label: "English", flag: "🇺🇸" },
    { code: "ZH", label: "繁體中文(台灣)", flag: "🇹🇼" },
    { code: "ZH-HANS", label: "简体中文", flag: "🇨🇳" },
    { code: "TH", label: "ภาษาไทย", flag: "🇹🇭" },
    { code: "VI", label: "Tiếng Việt", flag: "🇻🇳" },
    { code: "MN", label: "Монгол", flag: "🇲🇳" },
    { code: "KO", label: "한국어", flag: "🇰🇷" },
  ];

  // AI auto-response state (per conversation)
  const [aiAutoResponseEnabled, setAiAutoResponseEnabled] = useState(true);

  // Auto-set target language from customer's language when conversation changes
  useEffect(() => {
    if (selectedConversation?.customer?.language) {
      const lang = selectedConversation.customer.language.toUpperCase();
      // Try exact match first, then prefix match (e.g. "ZH" matches "ZH-HANS")
      const matched = translationLanguages.find(l => l.code === lang)
        || translationLanguages.find(l => l.code.startsWith(lang) || lang.startsWith(l.code));
      if (matched) setTargetLanguage(matched.code);
    }
    // Load AI enabled state from conversation
    if (selectedConversation) {
      const conv = selectedConversation as any;
      setAiAutoResponseEnabled(conv._aiEnabled !== false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation?.id]);

  // Debounced translation preview
  useEffect(() => {
    if (!autoTranslateEnabled || isInternalNote || !messageInput.trim() || targetLanguage === "KO") {
      setTranslationPreview("");
      return;
    }

    if (translationTimerRef.current) {
      clearTimeout(translationTimerRef.current);
    }

    setIsTranslating(true);
    translationTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/messages?action=translate&text=${encodeURIComponent(messageInput)}&targetLang=${targetLanguage}`
        );
        const data = await res.json();
        if (data.translated) {
          setTranslationPreview(data.translated);
        }
      } catch {
        // Silently fail — preview is optional
      } finally {
        setIsTranslating(false);
      }
    }, 500);

    return () => {
      if (translationTimerRef.current) clearTimeout(translationTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageInput, targetLanguage, autoTranslateEnabled, isInternalNote]);

  // ── Fetch tenants (hospitals) from DB ──
  useEffect(() => {
    async function loadHospitals() {
      try {
        const res = await fetch("/api/tenants");
        if (!res.ok) return;
        const data = await res.json();
        const tenants = data.tenants || [];
        const mapped: Hospital[] = tenants.map((t: any) => ({
          id: t.id,
          name: t.display_name || t.name,
          nameEn: t.name,
          specialty: t.specialty || "종합",
          color: "#6366f1",
        }));
        setHospitals(mapped);
      } catch {
        // leave empty
      }
    }
    loadHospitals();
  }, []);

  // ── Fetch team members for assignment ──
  useEffect(() => {
    async function loadTeamMembers() {
      try {
        const res = await fetch("/api/team");
        if (!res.ok) return;
        const data = await res.json();
        const members = data.members || [];
        const mapped = members.map((m: any) => ({
          id: m.id,
          name: m.name,
          role: m.role,
        }));
        setTeamMembers(mapped);
      } catch {
        // leave empty
      }
    }
    loadTeamMembers();
  }, []);

  // ── Fetch conversations from DB ──
  useEffect(() => {
    async function fetchConversations() {
      try {
        setIsLoadingConversations(true);
        const res = await fetch("/api/conversations");
        if (!res.ok) throw new Error("Failed to fetch conversations");
        const data = await res.json();
        const rawConversations = data.conversations || [];

        // Map DB data to our Conversation type
        const mapped: Conversation[] = rawConversations.map((conv: any) => {
          const customer = conv.customer;
          // customer_channels are nested under customer now
          const customerChannel = customer?.customer_channels?.[0];
          const channelAccount = customerChannel?.channel_account;
          const tenant = channelAccount?.tenant;
          const channelType = channelAccount?.channel_type || "line";

          // Map DB status to our StatusTag
          const statusMap: Record<string, StatusTag> = {
            open: "pending",
            active: "pending",
            waiting: "waiting",
            resolved: "resolved",
            escalated: "urgent",
          };

          // Build hospital from tenant data
          const defaultHospital: Hospital = { id: "unknown", name: "미지정", specialty: "종합", color: "#6366f1" };
          let hospital: Hospital = defaultHospital;
          if (tenant) {
            hospital = {
              id: tenant.id,
              name: tenant.display_name || tenant.name,
              nameEn: tenant.name,
              specialty: tenant.specialty || "종합",
              color: "#6366f1",
            };
          }

          const nameStr = customer?.name || "Unknown";
          const avatarInitials = nameStr.slice(0, 2).toUpperCase();

          return {
            id: conv.id,
            customer: {
              name: nameStr,
              country: customer?.country || "",
              language: customer?.language || "ko",
              avatar: avatarInitials,
              avatarUrl: customer?.profile_image_url || null,
            },
            hospital,
            channel: channelType,
            lastMessage: conv.last_message_preview || "",
            lastMessageTranslated: null,
            lastMessageAt: new Date(conv.last_message_at || conv.created_at),
            status: statusMap[conv.status] || "pending",
            unread: conv.unread_count || 0,
            aiConfidence: null,
            consultationTag: (customer?.tags?.includes("confirmed") ? "confirmed" :
              customer?.tags?.includes("first_booking") ? "first_booking" :
              "prospect") as ConsultationTag,
            customerTags: customer?.tags || [],
            assignee: conv.assigned_agent?.name || undefined,
            sentimentScore: undefined,
            _dbId: conv.id,
            _customerId: customer?.id,
            _tenantId: conv.tenant_id,
            _aiEnabled: conv.ai_enabled !== false,
          } as Conversation & { _dbId?: string; _customerId?: string; _tenantId?: string; _aiEnabled?: boolean };
        });

        setDbConversations(mapped);

        // Select first DB conversation if available
        if (mapped.length > 0 && !selectedConversation) {
          setSelectedConversation(mapped[0]);
        }
      } catch (err) {
        console.error("Failed to fetch conversations:", err);
      } finally {
        setIsLoadingConversations(false);
      }
    }

    fetchConversations();

    // Set up real-time subscription
    const supabase = createClient();
    const channel = (supabase as any)
      .channel("inbox-conversations")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        (payload: any) => {
          console.log("[Realtime] Conversations change:", payload.eventType);
          fetchConversations();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload: any) => {
          console.log("[Realtime] New message:", payload.new?.direction);
          fetchConversations();
          // Play notification sound for inbound messages
          const newMsg = payload?.new;
          if (newMsg && newMsg.direction === "inbound") {
            playNotificationSound();
          }
        }
      )
      .subscribe((status: string) => {
        console.log("[Realtime] Subscription status:", status);
      });

    // Polling fallback: refresh conversations every 2 seconds
    // This ensures updates even if Supabase Realtime is not configured
    const pollInterval = setInterval(() => {
      fetchConversations();
    }, 2000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch messages when conversation is selected ──
  useEffect(() => {
    async function fetchMessages() {
      if (!selectedConversation) {
        setDbMessages([]);
        return;
      }

      try {
        setIsLoadingMessages(true);
        const res = await fetch(`/api/conversations/${selectedConversation.id}/messages`);
        if (!res.ok) throw new Error("Failed to fetch messages");
        const data = await res.json();
        const rawMessages = data.messages || [];

        // Map DB messages to our Message type
        const mapped: Message[] = rawMessages.map((msg: any) => {
          const createdAt = new Date(msg.created_at);
          const timeStr = `${String(createdAt.getHours()).padStart(2, "0")}:${String(createdAt.getMinutes()).padStart(2, "0")}`;

          const metadata = msg.metadata || {};
          return {
            id: msg.id,
            sender: msg.sender_type as MessageType,
            content: msg.content || "",
            translatedContent: msg.translated_content || undefined,
            time: timeStr,
            language: msg.original_language || undefined,
            confidence: metadata.ai_confidence ? Math.round(metadata.ai_confidence * 100) : undefined,
            sources: metadata.ai_sources || undefined,
            direction: msg.direction as "inbound" | "outbound" | undefined,  // ADD: direction field for message count
          };
        });

        setDbMessages(mapped);
      } catch (err) {
        console.error("Failed to fetch messages:", err);
        setDbMessages([]);
      } finally {
        setIsLoadingMessages(false);
      }
    }

    fetchMessages();

    // Real-time message subscription for current conversation
    if (selectedConversation) {
      const supabase = createClient();
      const conversationId = selectedConversation.id;
      let lastKnownCount = 0;

      const channel = (supabase as any)
        .channel(`messages:${conversationId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload: any) => {
            const newMsg = payload?.new;
            if (newMsg) {
              const createdAt = new Date(newMsg.created_at);
              const timeStr = `${String(createdAt.getHours()).padStart(2, "0")}:${String(createdAt.getMinutes()).padStart(2, "0")}`;
              const metadata = newMsg.metadata || {};
              const mappedMsg: Message = {
                id: newMsg.id,
                sender: newMsg.sender_type as MessageType,
                content: newMsg.content || "",
                translatedContent: newMsg.translated_content || undefined,
                time: timeStr,
                language: newMsg.original_language || undefined,
                confidence: metadata.ai_confidence ? Math.round(metadata.ai_confidence * 100) : undefined,
                sources: metadata.ai_sources || undefined,
                direction: newMsg.direction as "inbound" | "outbound" | undefined,  // ADD: direction field
              };
              // Add new message, skip if already present (optimistic or duplicate)
              setDbMessages((prev) => {
                const filtered = prev.filter(m => {
                  if (m.id.startsWith("optimistic-") && m.content === mappedMsg.content) return false;
                  return true;
                });
                if (filtered.some(m => m.id === mappedMsg.id)) return filtered;
                return [...filtered, mappedMsg];
              });
              // Play sound for inbound
              if (newMsg.direction === "inbound") {
                playNotificationSound();
              }
            }
          }
        )
        .subscribe((status: string) => {
          console.log("[Realtime] Messages subscription status:", status);
        });

      // Polling fallback for messages: check every 2 seconds (faster than before)
      const pollMessages = setInterval(async () => {
        console.log("[Polling] Checking for new messages...");
        try {
          const res = await fetch(`/api/conversations/${conversationId}/messages`);
          if (!res.ok) return;
          const data = await res.json();
          const rawMessages = data.messages || [];
          // Only update if message count changed
          if (rawMessages.length !== lastKnownCount) {
            lastKnownCount = rawMessages.length;
            const mapped: Message[] = rawMessages.map((msg: any) => {
              const createdAt = new Date(msg.created_at);
              const timeStr = `${String(createdAt.getHours()).padStart(2, "0")}:${String(createdAt.getMinutes()).padStart(2, "0")}`;
              return {
                id: msg.id,
                sender: msg.sender_type as MessageType,
                content: msg.content || "",
                translatedContent: msg.translated_content || undefined,
                time: timeStr,
                language: msg.original_language || undefined,
                confidence: msg.ai_confidence ? Math.round(msg.ai_confidence * 100) : undefined,
              };
            });
            setDbMessages((prev) => {
              // Keep optimistic messages that aren't in DB yet
              const optimistic = prev.filter(m => m.id.startsWith("optimistic-") && !mapped.some(dm => dm.content === m.content));
              return [...mapped, ...optimistic];
            });
            // Play notification sound if newest message is inbound and new
            if (rawMessages.length > 0) {
              const newest = rawMessages[rawMessages.length - 1];
              if (newest.direction === "inbound") {
                const msgAge = Date.now() - new Date(newest.created_at).getTime();
                if (msgAge < 5000) {
                  playNotificationSound();
                }
              }
            }
          }
        } catch {
          // Silently fail — polling is best-effort
        }
      }, 2000);

      return () => {
        supabase.removeChannel(channel);
        clearInterval(pollMessages);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation?.id]);

  // ── Build customer profile from DB data ──
  useEffect(() => {
    if (!selectedConversation) {
      setDbCustomerProfile(null);
      return;
    }
    // Build profile from conversation data
    const conv = selectedConversation;
    setDbCustomerProfile({
      name: conv.customer.name,
      country: conv.customer.country || "미상",
      city: "",
      language: conv.customer.language || "ko",
      channels: [{ type: conv.channel, id: conv.id.slice(0, 12) }],
      interests: [],
      booking: undefined as any,
      consultationTag: conv.consultationTag,
      customerTags: conv.customerTags,
      notes: "",
      crmId: "",
      firstContact: new Date(conv.lastMessageAt).toISOString().slice(0, 10),
      totalConversations: 1,
      lastVisit: new Date(conv.lastMessageAt).toISOString().slice(0, 10),
      sentimentTrend: "neutral" as any,
      conversionScore: 50,
    });
  }, [selectedConversation]);

  // All conversations from DB only (no mock data)
  const allConversations = useMemo(() => {
    return dbConversations;
  }, [dbConversations]);

  // Scroll to bottom
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  }, []);

  // Notification sound function (cute/friendly chime)
  const playNotificationSound = useCallback(() => {
    const now = Date.now();
    if (now - lastNotifTimeRef.current < 2000) return; // Throttle to 2s
    lastNotifTimeRef.current = now;
    try {
      const ctx = audioContextRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = ctx;
      // Play a friendly two-tone chime
      const playTone = (freq: number, start: number, dur: number, vol: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, ctx.currentTime + start);
        gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur);
      };
      playTone(830, 0, 0.15, 0.3);    // E5
      playTone(1050, 0.12, 0.2, 0.25); // C6
      playTone(1320, 0.25, 0.3, 0.2);  // E6
    } catch {
      // Audio not available
    }
  }, []);

  // Generate AI suggestion when new inbound message arrives and AI auto-mode is ON
  // Track last processed inbound message ID per conversation to prevent duplicate RAG calls
  const processedInboundsByConvRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!aiAutoResponseEnabled || !selectedConversation) return;

    // Find the latest inbound message
    const inboundMsgs = dbMessages.filter(m => m.sender === "customer");
    if (inboundMsgs.length === 0) return;
    const latestInbound = inboundMsgs[inboundMsgs.length - 1];

    // Don't generate for optimistic messages
    if (latestInbound.id.startsWith("optimistic-")) return;

    // Check if we already processed this inbound message for this conversation
    const convId = selectedConversation.id;
    const lastProcessedId = processedInboundsByConvRef.current[convId];
    if (latestInbound.id === lastProcessedId) return;

    // Mark this message as processed for this conversation
    processedInboundsByConvRef.current[convId] = latestInbound.id;

    setIsAiGenerating(true);
    setAiSuggestion(null);
    setRagLogs([]);
    setRagSources([]);
    fetch(`/api/conversations/${selectedConversation.id}/ai-suggest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
      .then(res => res.json())
      .then(data => {
        if (data.suggestion) {
          setAiSuggestion(data.suggestion);
        }
        if (data.logs) {
          setRagLogs(data.logs);
        }
        if (data.sources) {
          setRagSources(data.sources);
        }
      })
      .catch(() => {
        // Silently fail
      })
      .finally(() => {
        setIsAiGenerating(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbMessages.length, aiAutoResponseEnabled, selectedConversation?.id]);

  // Clear AI suggestion when switching conversations to prevent confusion
  useEffect(() => {
    setAiSuggestion(null);
    setIsAiGenerating(false);
    setRagLogs([]);
    setRagSources([]);
  }, [selectedConversation?.id]);

  // Auto-detect interests/concerns when messages change
  useEffect(() => {
    if (!selectedConversation || dbMessages.length === 0) return;
    const customerId = (selectedConversation as any)?._customerId;
    if (!customerId) return;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/customers/${customerId}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: selectedConversation.id }),
        });
        if (res.ok) {
          const data = await res.json();
          setDetectedInterests(data.interests || []);
          setDetectedConcerns(data.concerns || []);
        }
      } catch {
        // Silently fail
      }
    }, 500);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation?.id, dbMessages.length]);

  // Load memo from customer metadata when conversation changes
  useEffect(() => {
    if (!selectedConversation) return;
    const customerId = (selectedConversation as any)?._customerId;
    if (!customerId) return;

    async function loadCustomerMeta() {
      try {
        const res = await fetch(`/api/customers/${customerId}/profile`);
        if (res.ok) {
          const data = await res.json();
          const meta = data.metadata || {};
          setMemoText(meta.memo || "");
          if (data.totalConversations) {
            setDbCustomerProfile(prev => prev ? { ...prev, totalConversations: data.totalConversations } : prev);
          }
        }
      } catch {
        // Silently fail
      }
    }
    loadCustomerMeta();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation?.id]);

  // Auto-scroll on conversation select or new message
  useEffect(() => {
    scrollToBottom("instant");
  }, [selectedConversation, dbMessages, scrollToBottom]);

  // Detect scroll position for "scroll to bottom" button
  const handleMessagesScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 100;
    setShowScrollButton(!isNearBottom);
  }, []);

  // Filter conversations
  const filteredConversations = useMemo(() => {
    return allConversations.filter((conv) => {
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
  }, [allConversations, selectedHospitals, filterChannel, selectedConsultationTags, selectedStatusTags, selectedCustomerTags, searchQuery]);

  // Get current messages from DB only
  const currentMessages = useMemo(() => {
    if (!selectedConversation) return [];
    return dbMessages;
  }, [selectedConversation, dbMessages]);

  // Filter messages
  const filteredMessages = useMemo(() => {
    return currentMessages.filter((msg) => {
      if (messageViewMode === "all") return true;
      if (messageViewMode === "customer") return msg.sender !== "internal_note";
      if (messageViewMode === "internal") return msg.sender === "internal_note";
      return true;
    });
  }, [messageViewMode, currentMessages]);

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
                      {filteredConversations.length}/{allConversations.length}건
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
                  hospitals={hospitals}
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
                              {conv.customer.avatarUrl && (
                                <AvatarImage src={conv.customer.avatarUrl} alt={conv.customer.name} />
                              )}
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
                    긴급 {allConversations.filter((c) => c.status === "urgent").length}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                    대기 {allConversations.filter((c) => c.status === "pending" || c.status === "waiting").length}
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
                        {selectedConversation.customer.avatarUrl && (
                          <AvatarImage src={selectedConversation.customer.avatarUrl} alt={selectedConversation.customer.name} />
                        )}
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
                    {/* AI Auto-Response Toggle */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={aiAutoResponseEnabled ? "secondary" : "ghost"}
                            size="sm"
                            className={cn(
                              "h-7 text-[10px] rounded-lg transition-all",
                              aiAutoResponseEnabled
                                ? "bg-violet-500/10 text-violet-600 hover:bg-violet-500/15 dark:text-violet-400"
                                : "text-muted-foreground"
                            )}
                            onClick={async () => {
                              const newVal = !aiAutoResponseEnabled;
                              setAiAutoResponseEnabled(newVal);
                              // Update DB
                              if (selectedConversation?.id) {
                                try {
                                  await fetch(`/api/conversations`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      conversationId: selectedConversation.id,
                                      ai_enabled: newVal,
                                    }),
                                  });
                                } catch (err) {
                                  console.error("AI toggle failed:", err);
                                }
                              }
                            }}
                          >
                            <Bot className="h-3 w-3 mr-1" />
                            AI {aiAutoResponseEnabled ? "ON" : "OFF"}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">AI 자동응대 {aiAutoResponseEnabled ? "활성 — 자동 답변이 전송됩니다" : "비활성 — 수동 응대 모드"}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

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
                  <div className={cn("flex items-center gap-1.5 ml-auto text-[10px]", aiAutoResponseEnabled ? "text-violet-600 dark:text-violet-400" : "text-muted-foreground")}>
                    <div className={cn("h-1.5 w-1.5 rounded-full", aiAutoResponseEnabled ? "bg-violet-500 animate-pulse" : "bg-gray-400")} />
                    <span>AI {aiAutoResponseEnabled ? "자동응대 활성" : "수동 모드"}</span>
                  </div>
                </div>

                {/* Messages Area - Fixed scroll */}
                <div
                  ref={messagesContainerRef}
                  className="flex-1 overflow-y-auto p-4"
                  onScroll={handleMessagesScroll}
                >
                  <div className="space-y-3 min-h-full flex flex-col justify-end">
                    {isLoadingMessages && (
                      <div className="flex items-center justify-center py-8">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          메시지 로딩 중...
                        </div>
                      </div>
                    )}
                    {!isLoadingMessages && filteredMessages.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <MessageCircle className="h-8 w-8 mb-2 opacity-30" />
                        <p className="text-sm">아직 메시지가 없습니다</p>
                      </div>
                    )}
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
                                  {selectedConversation.customer.avatarUrl && (
                                    <AvatarImage src={selectedConversation.customer.avatarUrl} alt={selectedConversation.customer.name} />
                                  )}
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
                                    <div className="flex flex-col gap-1.5 mb-2">
                                      <div className="flex items-center gap-1.5 text-[10px] text-violet-600 dark:text-violet-400">
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
                                      {msg.sources && msg.sources.length > 0 && (
                                        <details className="text-[9px] text-muted-foreground">
                                          <summary className="cursor-pointer hover:text-violet-600 dark:hover:text-violet-400 transition-colors flex items-center gap-1">
                                            <FileText className="h-2.5 w-2.5" />
                                            RAG 소스 ({msg.sources.length}개)
                                          </summary>
                                          <div className="mt-1.5 space-y-1 pl-3 border-l-2 border-violet-500/20">
                                            {msg.sources.map((source, idx) => (
                                              <div key={idx} className="flex items-start gap-1.5">
                                                <div className={cn(
                                                  "mt-0.5 h-1.5 w-1.5 rounded-full shrink-0",
                                                  source.type === "knowledge_base" ? "bg-amber-500" :
                                                  source.type === "tenant_config" ? "bg-blue-500" :
                                                  source.type === "conversation_history" ? "bg-green-500" :
                                                  "bg-gray-500"
                                                )} />
                                                <div className="flex-1 min-w-0">
                                                  <div className="font-medium text-foreground">{source.name}</div>
                                                  {source.description && (
                                                    <div className="text-[8px] text-muted-foreground truncate">{source.description}</div>
                                                  )}
                                                  {source.relevanceScore !== undefined && (
                                                    <div className="text-[8px] text-violet-600 dark:text-violet-400">
                                                      관련도: {Math.round(source.relevanceScore * 100)}%
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </details>
                                      )}
                                    </div>
                                  )}
                                  {/* Main message content: Show customer language version */}
                                  <p className="text-sm leading-relaxed">
                                    {(msg.sender === "agent" || msg.sender === "ai") && msg.translatedContent
                                      ? msg.translatedContent
                                      : msg.content}
                                  </p>
                                  {/* Translation toggle: Show Korean version for reference */}
                                  {showTranslation && msg.translatedContent && (
                                    <div className={cn(
                                      "mt-2 pt-2 border-t",
                                      (msg.sender === "agent" || msg.sender === "ai") ? "border-primary-foreground/20" : "border-border/40"
                                    )}>
                                      <div className={cn(
                                        "flex items-center gap-1 text-[9px] mb-0.5",
                                        (msg.sender === "agent" || msg.sender === "ai") ? "text-white/90" : "text-muted-foreground"
                                      )}>
                                        <Globe className="h-2.5 w-2.5" />
                                        {(msg.sender === "agent" || msg.sender === "ai") ? "원문 (한국어)" : "번역 (한국어)"}
                                      </div>
                                      <p className={cn(
                                        "text-xs leading-relaxed",
                                        (msg.sender === "agent" || msg.sender === "ai") ? "text-white" : "text-muted-foreground"
                                      )}>
                                        {(msg.sender === "agent" || msg.sender === "ai") ? msg.content : msg.translatedContent}
                                      </p>
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

                  {/* AI Recommendation Preview */}
                  <AnimatePresence>
                    {aiAutoResponseEnabled && !isInternalNote && (isAiGenerating || aiSuggestion) && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-2 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/60 dark:bg-violet-950/30 overflow-hidden"
                      >
                        <div className="px-3 py-1.5 flex items-center gap-1.5 text-[10px] text-violet-600 dark:text-violet-400 border-b border-violet-100 dark:border-violet-900">
                          <Sparkles className="h-3 w-3" />
                          <span className="font-medium">AI 추천 응답</span>
                          {isAiGenerating && (
                            <RefreshCw className="h-2.5 w-2.5 animate-spin ml-1" />
                          )}
                          {aiSuggestion && (
                            <div className="ml-auto flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 text-[10px] px-2 rounded-md text-violet-600 hover:text-violet-700 dark:text-violet-400"
                                onClick={() => {
                                  if (aiSuggestion) {
                                    setMessageInput(aiSuggestion.original);
                                    setAiSuggestion(null);
                                  }
                                }}
                              >
                                <Edit3 className="h-2.5 w-2.5 mr-0.5" />
                                입력란에 넣기
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 text-[10px] px-2 rounded-md text-green-600 hover:text-green-700 dark:text-green-400"
                                onClick={() => {
                                  if (aiSuggestion && selectedConversation) {
                                    const content = aiSuggestion.original;
                                    setAiSuggestion(null);
                                    // Optimistic UI
                                    const now = new Date();
                                    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
                                    setDbMessages((prev) => [...prev, {
                                      id: `optimistic-${Date.now()}`,
                                      sender: "ai" as MessageType,
                                      content,
                                      time: timeStr,
                                      confidence: aiSuggestion.confidence ? Math.round(aiSuggestion.confidence * 100) : undefined,
                                      sources: ragSources,
                                      direction: "outbound" as const,  // ADD: direction for message count
                                    }]);
                                    // Send via API
                                    fetch("/api/messages", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        conversationId: selectedConversation.id,
                                        content,
                                        targetLanguage,
                                        senderType: "ai",
                                        aiMetadata: {
                                          confidence: aiSuggestion.confidence,
                                          sources: ragSources,
                                          logs: ragLogs,
                                        },
                                      }),
                                    }).catch(err => console.error("Send AI suggestion failed:", err));
                                  }
                                }}
                              >
                                <Send className="h-2.5 w-2.5 mr-0.5" />
                                바로 전송
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 text-[10px] px-1.5 rounded-md text-muted-foreground"
                                onClick={() => setAiSuggestion(null)}
                              >
                                <X className="h-2.5 w-2.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                        {isAiGenerating ? (
                          <div className="px-3 py-3 text-sm text-violet-600/70 dark:text-violet-400/70 flex items-center gap-2">
                            <div className="flex gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                              <span className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                              <span className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                            </div>
                            AI가 추천 응답을 생성하고 있습니다...
                          </div>
                        ) : aiSuggestion && (
                          <div className="px-3 py-2 space-y-1.5">
                            <div>
                              <div className="flex items-center gap-1 text-[9px] text-violet-500 mb-0.5">
                                <Globe className="h-2.5 w-2.5" />
                                고객 언어 ({selectedConversation?.customer.language?.toUpperCase()})
                              </div>
                              <p className="text-sm text-foreground">{aiSuggestion.original}</p>
                            </div>
                            <div className="pt-1.5 border-t border-violet-100 dark:border-violet-900">
                              <div className="flex items-center gap-1 text-[9px] text-muted-foreground mb-0.5">
                                <Languages className="h-2.5 w-2.5" />
                                한국어 의미
                              </div>
                              <p className="text-xs text-muted-foreground">{aiSuggestion.korean}</p>
                            </div>

                            {/* RAG Execution Logs */}
                            {ragLogs.length > 0 && (
                              <details
                                className="mt-2 pt-2 border-t border-violet-100 dark:border-violet-900"
                                open={showRagLogs}
                                onToggle={(e) => setShowRagLogs((e.target as HTMLDetailsElement).open)}
                              >
                                <summary className="cursor-pointer text-[10px] font-medium text-violet-600 dark:text-violet-400 flex items-center gap-1 hover:text-violet-700 dark:hover:text-violet-300 transition-colors">
                                  🔍 RAG 실행 로그 ({ragLogs.length}개)
                                  {ragSources.length > 0 && (
                                    <span className="ml-1 text-violet-500/70">· {ragSources.length}개 문서 참조</span>
                                  )}
                                </summary>
                                <div className="mt-2 space-y-0.5 max-h-48 overflow-y-auto">
                                  {ragLogs.map((log, i) => (
                                    <div
                                      key={i}
                                      className="text-[9px] leading-relaxed font-mono text-muted-foreground/80 whitespace-pre-wrap break-all"
                                    >
                                      {log}
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Translation Preview */}
                  {!isInternalNote && autoTranslateEnabled && translationPreview && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/30 overflow-hidden"
                    >
                      <div className="px-3 py-1.5 flex items-center gap-1.5 text-[10px] text-blue-600 dark:text-blue-400 border-b border-blue-100 dark:border-blue-900">
                        <Languages className="h-3 w-3" />
                        <span className="font-medium">
                          {translationLanguages.find(l => l.code === targetLanguage)?.flag}{" "}
                          {translationLanguages.find(l => l.code === targetLanguage)?.label}(으)로 번역됨
                        </span>
                        {isTranslating && (
                          <RefreshCw className="h-2.5 w-2.5 animate-spin ml-1" />
                        )}
                      </div>
                      <div className="px-3 py-2 text-sm text-foreground/80">
                        {translationPreview}
                      </div>
                    </motion.div>
                  )}

                  {/* Translation Toggle + Language Selector */}
                  {!isInternalNote && (
                    <div className="flex items-center gap-2 mb-2">
                      <Button
                        variant={autoTranslateEnabled ? "secondary" : "ghost"}
                        size="sm"
                        className={cn(
                          "h-6 text-[10px] rounded-lg transition-all",
                          autoTranslateEnabled && "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-300"
                        )}
                        onClick={() => setAutoTranslateEnabled(!autoTranslateEnabled)}
                      >
                        <Languages className="h-3 w-3 mr-1" />
                        자동번역 {autoTranslateEnabled ? "ON" : "OFF"}
                      </Button>
                      <span className="text-[10px] text-muted-foreground">→</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-6 text-[10px] rounded-lg gap-1 px-2">
                            {translationLanguages.find(l => l.code === targetLanguage)?.flag}{" "}
                            {translationLanguages.find(l => l.code === targetLanguage)?.label}
                            <ChevronDown className="h-2.5 w-2.5 opacity-50" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="min-w-[160px]">
                          <DropdownMenuLabel className="text-[10px]">번역 언어 선택</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {translationLanguages.map((lang) => (
                            <DropdownMenuItem
                              key={lang.code}
                              onClick={() => setTargetLanguage(lang.code)}
                              className={cn(
                                "text-xs gap-2",
                                targetLanguage === lang.code && "bg-accent"
                              )}
                            >
                              <span>{lang.flag}</span>
                              <span>{lang.label}</span>
                              {targetLanguage === lang.code && <Check className="h-3 w-3 ml-auto" />}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <span className="text-[10px] text-muted-foreground/60 ml-1">입력시 자동 번역됩니다</span>
                    </div>
                  )}

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
                        onCompositionStart={() => { isComposingRef.current = true; }}
                        onCompositionEnd={() => { isComposingRef.current = false; }}
                        onKeyDown={async (e) => {
                          // Skip Enter during IME composition (prevents Korean duplicate send)
                          if (isComposingRef.current) return;
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (messageInput.trim() && selectedConversation) {
                              const content = messageInput;
                              const wasInternalNote = isInternalNote;
                              setMessageInput("");
                              setTranslationPreview("");
                              setAiSuggestion(null); // Clear AI suggestion on send

                              // Optimistic UI: immediately show sent message
                              const now = new Date();
                              const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
                              const optimisticMsg: Message = {
                                id: `optimistic-${Date.now()}`,
                                sender: wasInternalNote ? "internal_note" : "agent",
                                content,
                                time: timeStr,
                                direction: "outbound" as const,  // ADD: direction for message count
                              };
                              setDbMessages((prev) => [...prev, optimisticMsg]);

                              // Send via API (fire and forget for speed)
                              if (selectedConversation.id) {
                                fetch("/api/messages", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    conversationId: selectedConversation.id,
                                    content,
                                    isInternalNote: wasInternalNote,
                                    targetLanguage: !wasInternalNote ? targetLanguage : undefined,
                                  }),
                                }).catch(err => console.error("Send message failed:", err));
                              }
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
                        if (messageInput.trim() && selectedConversation) {
                          const content = messageInput;
                          const wasInternalNote = isInternalNote;
                          setMessageInput("");
                          setTranslationPreview("");
                          setAiSuggestion(null); // Clear AI suggestion on send

                          // Optimistic UI: immediately show sent message
                          const now = new Date();
                          const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
                          const optimisticMsg: Message = {
                            id: `optimistic-${Date.now()}`,
                            sender: wasInternalNote ? "internal_note" : "agent",
                            content,
                            time: timeStr,
                            direction: "outbound" as const,  // ADD: direction for message count
                          };
                          setDbMessages((prev) => [...prev, optimisticMsg]);

                          // Fire and forget for speed
                          if (selectedConversation.id) {
                            fetch("/api/messages", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                conversationId: selectedConversation.id,
                                content,
                                isInternalNote: wasInternalNote,
                                targetLanguage: !wasInternalNote ? targetLanguage : undefined,
                              }),
                            }).catch(err => console.error("Send message failed:", err));
                          }
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
              {!dbCustomerProfile ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <User className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-sm">고객을 선택하면 프로필이 표시됩니다</p>
                </div>
              ) : (
              <div className="p-4 space-y-4">
                {/* Profile Header */}
                <div className="text-center">
                  <div className="relative inline-block">
                    <Avatar className="h-14 w-14 mx-auto mb-2 ring-2 ring-primary/10 ring-offset-2 ring-offset-background">
                      {selectedConversation?.customer.avatarUrl && (
                        <AvatarImage src={selectedConversation.customer.avatarUrl} alt={dbCustomerProfile.name} />
                      )}
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-violet-500/20 text-primary text-lg font-medium">
                        {dbCustomerProfile.name.slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
                      <Heart className="h-2.5 w-2.5 text-white" />
                    </div>
                  </div>
                  <h3 className="font-semibold">{dbCustomerProfile.name}</h3>
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    <span className="text-xs text-muted-foreground">{dbCustomerProfile.country}</span>
                  </div>

                  {/* Customer Management Buttons */}
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs rounded-lg"
                      onClick={() => {
                        const customerId = (selectedConversation as any)?._customerId;
                        if (customerId) {
                          window.open(`/customers?highlight=${customerId}`, "_blank");
                        }
                      }}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      고객 관리
                    </Button>
                  </div>

                  {/* Conversion Score */}
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20">
                            <Zap className="h-3 w-3 text-green-500" />
                            <span className="text-[11px] font-semibold text-green-600 dark:text-green-400">전환 {dbCustomerProfile.conversionScore}%</span>
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
                    <Select
                      value={dbCustomerProfile.consultationTag}
                      onValueChange={async (value) => {
                        const customerId = (selectedConversation as any)?._customerId;
                        if (!customerId) return;
                        // Update local state immediately
                        const newConsultationTag = value as ConsultationTag;
                        setDbCustomerProfile(prev => prev ? { ...prev, consultationTag: newConsultationTag } : prev);
                        // Build updated tags: remove old consultation tags, add new one
                        const consultationKeys = Object.keys(consultationTagConfig);
                        const currentTags = dbCustomerProfile.customerTags.filter(t => !consultationKeys.includes(t));
                        const newTags = [value, ...currentTags];
                        setDbCustomerProfile(prev => prev ? { ...prev, customerTags: newTags } : prev);
                        // Also update the conversation in list
                        setDbConversations(prev => prev.map(c => c.id === selectedConversation?.id ? { ...c, consultationTag: newConsultationTag, customerTags: newTags } : c));
                        // Save to DB
                        try {
                          await fetch(`/api/customers/${customerId}/profile`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ tags: newTags }),
                          });
                        } catch (e) { console.error("Failed to save consultation tag:", e); }
                      }}
                    >
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

                  {/* Agent Assignment */}
                  <div className="mt-3">
                    <label className="text-xs font-medium mb-1.5 flex items-center gap-1.5 text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      담당자 배정
                    </label>
                    <Select
                      value={selectedConversation?.assignee || ""}
                      onValueChange={async (value) => {
                        if (!selectedConversation?.id) return;
                        // Update local state immediately (optimistic)
                        setDbConversations(prev => prev.map(c => c.id === selectedConversation.id ? { ...c, assignee: value || undefined } : c));
                        // Save to DB
                        try {
                          await fetch(`/api/conversations`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: selectedConversation.id, assigned_to: value || null }),
                          });
                        } catch (e) { console.error("Failed to assign agent:", e); }
                      }}
                    >
                      <SelectTrigger className="w-full h-8 rounded-lg text-xs">
                        <SelectValue placeholder="담당자 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">
                          <span className="text-muted-foreground">미배정</span>
                        </SelectItem>
                        {teamMembers.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            <div className="flex items-center gap-2">
                              <User className="h-3 w-3" />
                              <span>{member.name}</span>
                              <Badge variant="outline" className="text-[10px] h-4 px-1">
                                {member.role === "admin" ? "관리자" : member.role === "manager" ? "매니저" : member.role === "coordinator" ? "코디" : "상담사"}
                              </Badge>
                            </div>
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
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuLabel className="text-[10px]">태그 추가/제거</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {customerTagPresets.map((tag) => {
                          const isSelected = dbCustomerProfile.customerTags.includes(tag.label);
                          return (
                            <DropdownMenuCheckboxItem
                              key={tag.label}
                              checked={isSelected}
                              className="text-xs"
                              onCheckedChange={async (checked) => {
                                const customerId = (selectedConversation as any)?._customerId;
                                if (!customerId) return;
                                const currentTags = dbCustomerProfile.customerTags;
                                const newTags = checked
                                  ? [...currentTags, tag.label]
                                  : currentTags.filter(t => t !== tag.label);
                                setDbCustomerProfile(prev => prev ? { ...prev, customerTags: newTags } : prev);
                                setDbConversations(prev => prev.map(c => c.id === selectedConversation?.id ? { ...c, customerTags: newTags } : c));
                                try {
                                  await fetch(`/api/customers/${customerId}/profile`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ tags: newTags }),
                                  });
                                } catch (e) { console.error("Failed to save customer tags:", e); }
                              }}
                            >
                              <span className={cn("px-1.5 py-0.5 rounded-full text-[10px]", tag.bg, tag.color)}>
                                {tag.label}
                              </span>
                            </DropdownMenuCheckboxItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {dbCustomerProfile.customerTags.filter(tag => !Object.keys(consultationTagConfig).includes(tag)).map((tag) => {
                      const preset = customerTagPresets.find((p) => p.label === tag);
                      return (
                        <Badge key={tag} variant="secondary" className={cn(
                          "text-[10px] rounded-full gap-1",
                          preset ? cn(preset.bg, preset.color) : ""
                        )}>
                          {tag}
                          <X
                            className="h-2.5 w-2.5 cursor-pointer opacity-60 hover:opacity-100"
                            onClick={async () => {
                              const customerId = (selectedConversation as any)?._customerId;
                              if (!customerId) return;
                              const newTags = dbCustomerProfile.customerTags.filter(t => t !== tag);
                              setDbCustomerProfile(prev => prev ? { ...prev, customerTags: newTags } : prev);
                              setDbConversations(prev => prev.map(c => c.id === selectedConversation?.id ? { ...c, customerTags: newTags } : c));
                              try {
                                await fetch(`/api/customers/${customerId}/profile`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ tags: newTags }),
                                });
                              } catch (e) { console.error("Failed to remove tag:", e); }
                            }}
                          />
                        </Badge>
                      );
                    })}
                    {dbCustomerProfile.customerTags.filter(tag => !Object.keys(consultationTagConfig).includes(tag)).length === 0 && (
                      <span className="text-[10px] text-muted-foreground">태그를 추가하세요</span>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Type Tags (유형 태그) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-medium flex items-center gap-1.5">
                      <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                      유형 태그
                    </h4>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-5 w-5">
                          <Plus className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuLabel className="text-[10px]">유형 태그 추가/제거</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {[
                          { label: "가격문의", color: "text-blue-700 dark:text-blue-300", bg: "bg-blue-100 dark:bg-blue-900/40" },
                          { label: "예약문의", color: "text-green-700 dark:text-green-300", bg: "bg-green-100 dark:bg-green-900/40" },
                          { label: "시술상담", color: "text-purple-700 dark:text-purple-300", bg: "bg-purple-100 dark:bg-purple-900/40" },
                          { label: "불만/클레임", color: "text-red-700 dark:text-red-300", bg: "bg-red-100 dark:bg-red-900/40" },
                          { label: "후기/리뷰", color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-100 dark:bg-amber-900/40" },
                          { label: "일반문의", color: "text-gray-700 dark:text-gray-300", bg: "bg-gray-100 dark:bg-gray-800/40" },
                        ].map((tag) => {
                          const typeTagKey = `type:${tag.label}`;
                          const isSelected = dbCustomerProfile.customerTags.includes(typeTagKey);
                          return (
                            <DropdownMenuCheckboxItem
                              key={tag.label}
                              checked={isSelected}
                              className="text-xs"
                              onCheckedChange={async (checked) => {
                                const customerId = (selectedConversation as any)?._customerId;
                                if (!customerId) return;
                                const currentTags = dbCustomerProfile.customerTags;
                                const newTags = checked
                                  ? [...currentTags, typeTagKey]
                                  : currentTags.filter(t => t !== typeTagKey);
                                setDbCustomerProfile(prev => prev ? { ...prev, customerTags: newTags } : prev);
                                setDbConversations(prev => prev.map(c => c.id === selectedConversation?.id ? { ...c, customerTags: newTags } : c));
                                try {
                                  await fetch(`/api/customers/${customerId}/profile`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ tags: newTags }),
                                  });
                                } catch (e) { console.error("Failed to save type tag:", e); }
                              }}
                            >
                              <span className={cn("px-1.5 py-0.5 rounded-full text-[10px]", tag.bg, tag.color)}>
                                {tag.label}
                              </span>
                            </DropdownMenuCheckboxItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {dbCustomerProfile.customerTags.filter(t => t.startsWith("type:")).map((tag) => {
                      const label = tag.replace("type:", "");
                      const typePresets: Record<string, { color: string; bg: string }> = {
                        "가격문의": { color: "text-blue-700 dark:text-blue-300", bg: "bg-blue-100 dark:bg-blue-900/40" },
                        "예약문의": { color: "text-green-700 dark:text-green-300", bg: "bg-green-100 dark:bg-green-900/40" },
                        "시술상담": { color: "text-purple-700 dark:text-purple-300", bg: "bg-purple-100 dark:bg-purple-900/40" },
                        "불만/클레임": { color: "text-red-700 dark:text-red-300", bg: "bg-red-100 dark:bg-red-900/40" },
                        "후기/리뷰": { color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-100 dark:bg-amber-900/40" },
                        "일반문의": { color: "text-gray-700 dark:text-gray-300", bg: "bg-gray-100 dark:bg-gray-800/40" },
                      };
                      const preset = typePresets[label];
                      return (
                        <Badge key={tag} variant="secondary" className={cn(
                          "text-[10px] rounded-full gap-1",
                          preset ? cn(preset.bg, preset.color) : ""
                        )}>
                          {label}
                          <X
                            className="h-2.5 w-2.5 cursor-pointer opacity-60 hover:opacity-100"
                            onClick={async () => {
                              const customerId = (selectedConversation as any)?._customerId;
                              if (!customerId) return;
                              const newTags = dbCustomerProfile.customerTags.filter(t => t !== tag);
                              setDbCustomerProfile(prev => prev ? { ...prev, customerTags: newTags } : prev);
                              setDbConversations(prev => prev.map(c => c.id === selectedConversation?.id ? { ...c, customerTags: newTags } : c));
                              try {
                                await fetch(`/api/customers/${customerId}/profile`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ tags: newTags }),
                                });
                              } catch (e) { console.error("Failed to remove type tag:", e); }
                            }}
                          />
                        </Badge>
                      );
                    })}
                    {dbCustomerProfile.customerTags.filter(t => t.startsWith("type:")).length === 0 && (
                      <span className="text-[10px] text-muted-foreground">유형 태그를 추가하세요</span>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Quick Info - total conversations from real count */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-lg bg-muted/30 text-center">
                    <p className="text-[10px] text-muted-foreground">총 대화</p>
                    <p className="text-sm font-semibold">
                      {dbConversations.filter(c => {
                        const cid = (c as any)._customerId;
                        const selectedCid = (selectedConversation as any)?._customerId;
                        return cid && selectedCid && cid === selectedCid;
                      }).length || dbCustomerProfile.totalConversations}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30 text-center">
                    <p className="text-[10px] text-muted-foreground">첫 접촉</p>
                    <p className="text-sm font-semibold">{dbCustomerProfile.firstContact.slice(5)}</p>
                  </div>
                </div>

                {/* Message Count - Real-time Inbound/Outbound */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-lg bg-blue-500/5 border border-blue-500/10 text-center">
                    <p className="text-[10px] text-muted-foreground">수신 메시지</p>
                    <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                      {dbMessages.filter(m => m.direction === "inbound").length}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-green-500/5 border border-green-500/10 text-center">
                    <p className="text-[10px] text-muted-foreground">발신 메시지</p>
                    <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                      {dbMessages.filter(m => m.direction === "outbound").length}
                    </p>
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
                    {dbCustomerProfile.channels.map((ch, idx) => (
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

                {/* Location - displayed in customer's language */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-medium flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    위치
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {(() => {
                      const lang = dbCustomerProfile.language?.toLowerCase() || "ko";
                      const country = dbCustomerProfile.country;
                      // Country name in customer's language
                      const countryNames: Record<string, Record<string, string>> = {
                        "일본": { ja: "日本", en: "Japan", zh: "日本", "zh-hans": "日本", th: "ญี่ปุ่น", vi: "Nhật Bản", ko: "일본" },
                        "한국": { ja: "韓国", en: "South Korea", zh: "韓國", "zh-hans": "韩国", th: "เกาหลีใต้", vi: "Hàn Quốc", ko: "한국" },
                        "중국": { ja: "中国", en: "China", zh: "中國", "zh-hans": "中国", th: "จีน", vi: "Trung Quốc", ko: "중국" },
                        "대만": { ja: "台湾", en: "Taiwan", zh: "台灣", "zh-hans": "台湾", th: "ไต้หวัน", vi: "Đài Loan", ko: "대만" },
                        "미국": { ja: "アメリカ", en: "United States", zh: "美國", "zh-hans": "美国", th: "สหรัฐอเมริกา", vi: "Hoa Kỳ", ko: "미국" },
                        "베트남": { ja: "ベトナム", en: "Vietnam", zh: "越南", "zh-hans": "越南", th: "เวียดนาม", vi: "Việt Nam", ko: "베트남" },
                        "태국": { ja: "タイ", en: "Thailand", zh: "泰國", "zh-hans": "泰国", th: "ไทย", vi: "Thái Lan", ko: "태국" },
                        "몽골": { ja: "モンゴル", en: "Mongolia", zh: "蒙古", "zh-hans": "蒙古", th: "มองโกเลีย", vi: "Mông Cổ", ko: "몽골" },
                      };
                      const localName = countryNames[country]?.[lang] || country;
                      const city = dbCustomerProfile.city;
                      return `${city}${city ? ", " : ""}${localName}`;
                    })()}
                  </p>
                </div>

                <Separator />

                {/* Booking Info */}
                {dbCustomerProfile.booking && (
                  <>
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-medium flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        예약 정보
                      </h4>
                      <div className="p-2.5 rounded-xl bg-gradient-to-r from-primary/5 to-violet-500/5 border border-primary/10">
                        <p className="text-xs font-medium">{dbCustomerProfile.booking?.type}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {dbCustomerProfile.booking?.date} {dbCustomerProfile.booking?.time}
                        </p>
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

                {/* Interests - auto-detected from conversation */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-medium flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                    관심 시술
                    {detectedInterests.length > 0 && (
                      <Badge variant="secondary" className="text-[9px] h-4 rounded-md ml-auto">
                        <Brain className="h-2.5 w-2.5 mr-0.5" />
                        자동감지
                      </Badge>
                    )}
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {detectedInterests.length > 0 ? detectedInterests.map((interest) => (
                      <Badge key={interest} variant="outline" className="text-[10px] rounded-full border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300">
                        {interest}
                      </Badge>
                    )) : (
                      <span className="text-[10px] text-muted-foreground">대화에서 시술 관련 내용이 감지되면 자동 표시됩니다</span>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Concerns - auto-detected from conversation */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-medium flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    고민
                    {detectedConcerns.length > 0 && (
                      <Badge variant="secondary" className="text-[9px] h-4 rounded-md ml-auto">
                        <Brain className="h-2.5 w-2.5 mr-0.5" />
                        자동감지
                      </Badge>
                    )}
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {detectedConcerns.length > 0 ? detectedConcerns.map((concern) => (
                      <Badge key={concern} variant="outline" className="text-[10px] rounded-full border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300">
                        {concern}
                      </Badge>
                    )) : (
                      <span className="text-[10px] text-muted-foreground">대화에서 고객 고민이 감지되면 자동 표시됩니다</span>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Notes - editable memo with DB save */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-medium flex items-center gap-1.5">
                      <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
                      메모
                    </h4>
                    {!isEditingMemo ? (
                      <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2" onClick={() => setIsEditingMemo(true)}>
                        <Edit3 className="h-3 w-3 mr-0.5" />
                        편집
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 text-[10px] px-2 text-green-600 hover:text-green-700"
                        onClick={async () => {
                          const customerId = (selectedConversation as any)?._customerId;
                          if (!customerId) return;
                          setIsEditingMemo(false);
                          setDbCustomerProfile(prev => prev ? { ...prev, notes: memoText } : prev);
                          try {
                            await fetch(`/api/customers/${customerId}/profile`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ metadata: { memo: memoText } }),
                            });
                          } catch (e) { console.error("Failed to save memo:", e); }
                        }}
                      >
                        <Save className="h-3 w-3 mr-0.5" />
                        저장
                      </Button>
                    )}
                  </div>
                  {isEditingMemo ? (
                    <Textarea
                      value={memoText}
                      onChange={(e) => setMemoText(e.target.value)}
                      placeholder="메모를 입력하세요... (Enter로 저장)"
                      className="min-h-[60px] text-xs resize-none rounded-lg"
                      autoFocus
                      onKeyDown={async (e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          const customerId = (selectedConversation as any)?._customerId;
                          if (!customerId) return;
                          setIsEditingMemo(false);
                          setDbCustomerProfile(prev => prev ? { ...prev, notes: memoText } : prev);
                          try {
                            await fetch(`/api/customers/${customerId}/profile`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ metadata: { memo: memoText } }),
                            });
                          } catch (e2) { console.error("Failed to save memo:", e2); }
                        }
                      }}
                    />
                  ) : (
                    <p
                      className="text-xs text-muted-foreground leading-relaxed cursor-pointer hover:text-foreground transition-colors min-h-[20px]"
                      onClick={() => setIsEditingMemo(true)}
                    >
                      {memoText || dbCustomerProfile.notes || "클릭하여 메모를 작성하세요"}
                    </p>
                  )}
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

                  <Separator className="my-2" />

                  {/* Delete Conversation */}
                  {!showDeleteDialog ? (
                    <Button
                      variant="outline"
                      className="w-full justify-start rounded-lg text-xs text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                      size="sm"
                      onClick={() => setShowDeleteDialog(true)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      대화 삭제하기
                    </Button>
                  ) : (
                    <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 space-y-2">
                      <p className="text-xs font-medium text-destructive">정말 이 대화를 삭제하시겠습니까?</p>
                      <p className="text-[10px] text-muted-foreground">삭제된 대화와 메시지는 복구할 수 없습니다.</p>
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          className="flex-1 h-7 text-[11px]"
                          disabled={isDeleting}
                          onClick={async () => {
                            if (!selectedConversation) return;
                            setIsDeleting(true);
                            try {
                              const res = await fetch(`/api/conversations/${selectedConversation.id}`, {
                                method: "DELETE",
                              });
                              if (res.ok) {
                                // Remove from local state
                                setDbConversations(prev => prev.filter(c => c.id !== selectedConversation.id));
                                setSelectedConversation(null);
                                setDbMessages([]);
                                setDbCustomerProfile(null);
                                setShowDeleteDialog(false);
                              }
                            } catch (err) {
                              console.error("Delete failed:", err);
                            } finally {
                              setIsDeleting(false);
                            }
                          }}
                        >
                          {isDeleting ? "삭제 중..." : "확인, 삭제합니다"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-7 text-[11px]"
                          onClick={() => setShowDeleteDialog(false)}
                        >
                          취소
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              )}
            </ScrollArea>
          </motion.div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
