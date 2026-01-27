"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Building2,
  Bot,
  MessageSquare,
  Settings,
  BookOpen,
  Brain,
  Trash2,
  Eye,
  Stethoscope,
  Scissors,
  Sparkles,
  Activity,
  Users,
  Target,
  AlertTriangle,
  Phone,
  Instagram,
  Facebook,
  MessageCircle,
  Star,
  Search,
  TrendingUp,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// --- Types ---

type Specialty =
  | "ophthalmology"
  | "dentistry"
  | "plastic_surgery"
  | "dermatology"
  | "general";

type TenantStatus = "active" | "suspended";

interface TenantChannel {
  type: "line" | "kakao" | "whatsapp" | "instagram" | "facebook";
  accountName: string;
}

interface TenantAIConfig {
  preferred_model: string;
  confidence_threshold: number;
  auto_response_enabled: boolean;
  system_prompt: string;
  escalation_keywords: string[];
}

interface TenantStats {
  total_conversations: number;
  ai_accuracy: number;
  escalation_rate: number;
  csat_score: number;
  monthly_inquiries: number;
}

interface Tenant {
  id: string;
  name: string;
  display_name: string;
  specialty: Specialty;
  status: TenantStatus;
  default_language: string;
  ai_config: TenantAIConfig;
  stats: TenantStats;
  channels: TenantChannel[];
  created_at: string;
}

// --- Constants ---

const SPECIALTY_MAP: Record<
  Specialty,
  { label: string; icon: React.ElementType; color: string; bg: string; gradient: string }
> = {
  ophthalmology: {
    label: "안과",
    icon: Eye,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10",
    gradient: "from-blue-500/5 to-blue-600/10",
  },
  dentistry: {
    label: "치과",
    icon: Sparkles,
    color: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-500/10",
    gradient: "from-cyan-500/5 to-cyan-600/10",
  },
  plastic_surgery: {
    label: "성형외과",
    icon: Scissors,
    color: "text-pink-600 dark:text-pink-400",
    bg: "bg-pink-500/10",
    gradient: "from-pink-500/5 to-pink-600/10",
  },
  dermatology: {
    label: "피부과",
    icon: Stethoscope,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-500/10",
    gradient: "from-purple-500/5 to-purple-600/10",
  },
  general: {
    label: "일반의원",
    icon: Activity,
    color: "text-gray-600 dark:text-gray-400",
    bg: "bg-gray-500/10",
    gradient: "from-gray-500/5 to-gray-600/10",
  },
};

const SPECIALTY_BADGE_COLORS: Record<Specialty, string> = {
  ophthalmology: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  dentistry: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  plastic_surgery: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  dermatology: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  general: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
};

const CHANNEL_ICON_MAP: Record<string, { icon: React.ElementType; color: string }> = {
  line: { icon: MessageCircle, color: "text-green-500" },
  kakao: { icon: MessageCircle, color: "text-yellow-500" },
  whatsapp: { icon: Phone, color: "text-emerald-500" },
  instagram: { icon: Instagram, color: "text-pink-500" },
  facebook: { icon: Facebook, color: "text-blue-500" },
};

const MODEL_OPTIONS = [
  { value: "gpt-4", label: "GPT-4" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
  { value: "claude-3-opus", label: "Claude 3 Opus" },
  { value: "claude-3-sonnet", label: "Claude 3 Sonnet" },
];

// --- Mock Data ---

const mockTenants: Tenant[] = [
  {
    id: "tenant-1",
    name: "healing-eye",
    display_name: "힐링안과",
    specialty: "ophthalmology",
    status: "active",
    default_language: "ko",
    ai_config: {
      preferred_model: "gpt-4",
      confidence_threshold: 0.85,
      auto_response_enabled: true,
      system_prompt:
        "당신은 힐링안과의 AI 상담사입니다. 라식, 라섹, 백내장 수술 등 안과 시술에 대해 친절하고 정확하게 안내해주세요. 가격 문의는 상담 예약을 안내해주세요.",
      escalation_keywords: ["불만", "환불", "부작용", "통증", "의료사고"],
    },
    stats: {
      total_conversations: 1247,
      ai_accuracy: 92.1,
      escalation_rate: 7.3,
      csat_score: 4.6,
      monthly_inquiries: 312,
    },
    channels: [
      { type: "line", accountName: "힐링안과 LINE" },
      { type: "kakao", accountName: "힐링안과 카카오톡" },
      { type: "whatsapp", accountName: "Healing Eye Clinic" },
    ],
    created_at: "2025-08-15T00:00:00Z",
  },
  {
    id: "tenant-2",
    name: "smile-dental",
    display_name: "스마일치과",
    specialty: "dentistry",
    status: "active",
    default_language: "ko",
    ai_config: {
      preferred_model: "claude-3-sonnet",
      confidence_threshold: 0.8,
      auto_response_enabled: true,
      system_prompt:
        "당신은 스마일치과의 AI 상담사입니다. 임플란트, 교정, 미백 등 치과 시술에 대해 안내합니다. 정확한 견적은 내원 상담 후 안내해주세요.",
      escalation_keywords: ["불만", "환불", "소송", "통증", "출혈"],
    },
    stats: {
      total_conversations: 893,
      ai_accuracy: 88.7,
      escalation_rate: 9.1,
      csat_score: 4.3,
      monthly_inquiries: 198,
    },
    channels: [
      { type: "kakao", accountName: "스마일치과" },
      { type: "instagram", accountName: "@smile_dental_kr" },
    ],
    created_at: "2025-09-20T00:00:00Z",
  },
  {
    id: "tenant-3",
    name: "seoul-plastic",
    display_name: "서울성형",
    specialty: "plastic_surgery",
    status: "active",
    default_language: "ko",
    ai_config: {
      preferred_model: "gpt-4-turbo",
      confidence_threshold: 0.9,
      auto_response_enabled: true,
      system_prompt:
        "당신은 서울성형외과의 AI 상담사입니다. 쌍꺼풀, 코성형, 지방흡입 등 성형 시술에 대해 안내합니다. Before/After 사진 요청 시 내원 상담을 안내해주세요.",
      escalation_keywords: ["불만", "환불", "부작용", "재수술", "의료사고", "비대칭"],
    },
    stats: {
      total_conversations: 1562,
      ai_accuracy: 85.3,
      escalation_rate: 12.5,
      csat_score: 4.1,
      monthly_inquiries: 427,
    },
    channels: [
      { type: "instagram", accountName: "@seoul_plastic_surgery" },
      { type: "facebook", accountName: "서울성형외과" },
    ],
    created_at: "2025-07-01T00:00:00Z",
  },
  {
    id: "tenant-4",
    name: "gangnam-derma",
    display_name: "강남피부과",
    specialty: "dermatology",
    status: "active",
    default_language: "ko",
    ai_config: {
      preferred_model: "claude-3-sonnet",
      confidence_threshold: 0.82,
      auto_response_enabled: true,
      system_prompt:
        "당신은 강남피부과의 AI 상담사입니다. 레이저, 보톡스, 필러, 여드름 치료 등 피부과 시술에 대해 안내합니다. 피부 상태 진단은 내원 상담을 안내해주세요.",
      escalation_keywords: ["불만", "환불", "알레르기", "부작용", "화상"],
    },
    stats: {
      total_conversations: 678,
      ai_accuracy: 91.5,
      escalation_rate: 6.8,
      csat_score: 4.5,
      monthly_inquiries: 156,
    },
    channels: [{ type: "kakao", accountName: "강남피부과" }],
    created_at: "2025-10-10T00:00:00Z",
  },
];

// --- Mini Ring Chart Component ---

function MiniRingChart({
  value,
  size = 40,
  strokeWidth = 3.5,
  color,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/60"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="ring-progress"
        style={
          {
            "--ring-circumference": circumference,
            "--ring-offset": offset,
          } as React.CSSProperties
        }
      />
    </svg>
  );
}

// --- Container Animations ---

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 24,
    },
  },
};

const cardHover = {
  y: -2,
  transition: { type: "spring" as const, stiffness: 400, damping: 20 },
};

// --- Component ---

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>(mockTenants);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [aiConfigTenantId, setAiConfigTenantId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [newTenant, setNewTenant] = useState({
    name: "",
    display_name: "",
    specialty: "" as Specialty | "",
    default_language: "ko",
  });

  const [editingAIConfig, setEditingAIConfig] = useState<TenantAIConfig | null>(null);

  // --- Filtered tenants ---
  const filteredTenants = tenants.filter(
    (t) =>
      t.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- Summary calculations ---
  const totalTenants = tenants.length;
  const activeTenants = tenants.filter((t) => t.status === "active").length;
  const avgAutoResponseRate =
    tenants.length > 0
      ? (
          tenants.reduce((sum, t) => sum + t.stats.ai_accuracy, 0) / tenants.length
        ).toFixed(1)
      : "0";
  const totalMonthlyInquiries = tenants.reduce(
    (sum, t) => sum + t.stats.monthly_inquiries,
    0
  );

  const summaryStats = [
    {
      title: "총 거래처",
      value: totalTenants.toString(),
      icon: Building2,
      description: "등록된 병원/클리닉",
      iconBg: "bg-indigo-500/10",
      iconColor: "text-indigo-500",
      gradient: "from-indigo-500/5 to-indigo-600/10",
    },
    {
      title: "활성 거래처",
      value: activeTenants.toString(),
      icon: Users,
      description: "현재 운영 중",
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-500",
      gradient: "from-emerald-500/5 to-emerald-600/10",
    },
    {
      title: "AI 자동응대율",
      value: `${avgAutoResponseRate}%`,
      icon: Bot,
      description: "전체 거래처 평균",
      iconBg: "bg-violet-500/10",
      iconColor: "text-violet-500",
      gradient: "from-violet-500/5 to-violet-600/10",
    },
    {
      title: "이번 달 문의",
      value: totalMonthlyInquiries.toLocaleString(),
      icon: MessageSquare,
      description: "전 거래처 합산",
      iconBg: "bg-sky-500/10",
      iconColor: "text-sky-500",
      gradient: "from-sky-500/5 to-sky-600/10",
    },
  ];

  // --- Handlers ---

  const handleAddTenant = () => {
    if (!newTenant.name || !newTenant.display_name || !newTenant.specialty) return;

    const tenant: Tenant = {
      id: `tenant-${Date.now()}`,
      name: newTenant.name,
      display_name: newTenant.display_name,
      specialty: newTenant.specialty as Specialty,
      status: "active",
      default_language: newTenant.default_language,
      ai_config: {
        preferred_model: "gpt-4",
        confidence_threshold: 0.85,
        auto_response_enabled: true,
        system_prompt: "",
        escalation_keywords: [],
      },
      stats: {
        total_conversations: 0,
        ai_accuracy: 0,
        escalation_rate: 0,
        csat_score: 0,
        monthly_inquiries: 0,
      },
      channels: [],
      created_at: new Date().toISOString(),
    };

    setTenants((prev) => [...prev, tenant]);
    setNewTenant({ name: "", display_name: "", specialty: "", default_language: "ko" });
    setIsAddDialogOpen(false);
  };

  const handleDeleteTenant = (tenantId: string) => {
    setTenants((prev) => prev.filter((t) => t.id !== tenantId));
  };

  const openAIConfig = (tenant: Tenant) => {
    setAiConfigTenantId(tenant.id);
    setEditingAIConfig({ ...tenant.ai_config });
  };

  const handleSaveAIConfig = () => {
    if (!aiConfigTenantId || !editingAIConfig) return;
    setTenants((prev) =>
      prev.map((t) =>
        t.id === aiConfigTenantId ? { ...t, ai_config: { ...editingAIConfig } } : t
      )
    );
    setAiConfigTenantId(null);
    setEditingAIConfig(null);
  };

  // --- Helpers ---

  function getAccuracyColor(accuracy: number): string {
    if (accuracy >= 90) return "#22c55e";
    if (accuracy >= 85) return "#eab308";
    return "#ef4444";
  }

  function getAccuracyTextClass(accuracy: number): string {
    if (accuracy >= 90) return "text-green-600 dark:text-green-400";
    if (accuracy >= 85) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  }

  // --- Render ---

  return (
    <div className="space-y-6 animate-in-up">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-4.5 w-4.5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">거래처 관리</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-[42px]">
            병원/클리닉 거래처 정보를 관리합니다
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 shadow-sm">
              <Plus className="h-3.5 w-3.5" />
              거래처 추가
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>새 거래처 추가</DialogTitle>
              <DialogDescription>
                새로운 병원/클리닉 거래처를 등록합니다.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                  거래처 ID (영문) *
                </Label>
                <Input
                  placeholder="예: healing-eye"
                  value={newTenant.name}
                  onChange={(e) =>
                    setNewTenant({ ...newTenant, name: e.target.value })
                  }
                  className="border-0 bg-muted/50 shadow-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                  표시 이름 *
                </Label>
                <Input
                  placeholder="예: 힐링안과"
                  value={newTenant.display_name}
                  onChange={(e) =>
                    setNewTenant({ ...newTenant, display_name: e.target.value })
                  }
                  className="border-0 bg-muted/50 shadow-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                  진료과목 *
                </Label>
                <Select
                  value={newTenant.specialty}
                  onValueChange={(value) =>
                    setNewTenant({ ...newTenant, specialty: value as Specialty })
                  }
                >
                  <SelectTrigger className="border-0 bg-muted/50 shadow-sm">
                    <SelectValue placeholder="진료과목 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ophthalmology">안과</SelectItem>
                    <SelectItem value="dentistry">치과</SelectItem>
                    <SelectItem value="plastic_surgery">성형외과</SelectItem>
                    <SelectItem value="dermatology">피부과</SelectItem>
                    <SelectItem value="general">일반의원</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                  기본 언어
                </Label>
                <Select
                  value={newTenant.default_language}
                  onValueChange={(value) =>
                    setNewTenant({ ...newTenant, default_language: value })
                  }
                >
                  <SelectTrigger className="border-0 bg-muted/50 shadow-sm">
                    <SelectValue placeholder="기본 언어 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ko">한국어</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ja">日本語</SelectItem>
                    <SelectItem value="zh">中文</SelectItem>
                    <SelectItem value="vi">Tiếng Việt</SelectItem>
                    <SelectItem value="th">ไทย</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAddDialogOpen(false)}
              >
                취소
              </Button>
              <Button
                size="sm"
                onClick={handleAddTenant}
                disabled={
                  !newTenant.name ||
                  !newTenant.display_name ||
                  !newTenant.specialty
                }
              >
                등록
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Stats */}
      <motion.div
        className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 stagger-children"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {summaryStats.map((stat) => (
          <motion.div key={stat.title} variants={itemVariants} whileHover={cardHover}>
            <Card className={`border-0 shadow-sm bg-gradient-to-br ${stat.gradient} hover-lift overflow-hidden`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                      {stat.title}
                    </p>
                    <p className="text-2xl font-bold tabular-nums tracking-tight">
                      {stat.value}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {stat.description}
                    </p>
                  </div>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.iconBg}`}>
                    <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="거래처 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 border-0 bg-muted/40 shadow-sm h-9 text-sm"
        />
      </div>

      {/* Tenant List */}
      <AnimatePresence mode="popLayout">
        <motion.div
          className="grid gap-3 md:grid-cols-2"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {filteredTenants.map((tenant) => {
            const specialtyInfo = SPECIALTY_MAP[tenant.specialty];
            const SpecialtyIcon = specialtyInfo.icon;

            return (
              <motion.div
                key={tenant.id}
                variants={itemVariants}
                exit={{ opacity: 0, scale: 0.95 }}
                layout
                whileHover={cardHover}
              >
                <Card
                  className={`border-0 shadow-sm bg-gradient-to-br ${specialtyInfo.gradient} hover-lift overflow-hidden group`}
                >
                  <CardContent className="p-5">
                    {/* Top Row: Avatar, Name, Badges, Actions */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar */}
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${specialtyInfo.bg} font-bold text-base ${specialtyInfo.color}`}
                        >
                          {tenant.display_name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-[15px] truncate">
                              {tenant.display_name}
                            </h3>
                            {tenant.status === "active" && (
                              <span className="flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 live-dot" />
                                <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                                  활성
                                </span>
                              </span>
                            )}
                            {tenant.status === "suspended" && (
                              <Badge
                                className="bg-red-500/10 text-red-500 border-0 text-[10px] px-1.5 py-0"
                              >
                                중지
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge
                              className={`${SPECIALTY_BADGE_COLORS[tenant.specialty]} border-0 text-[10px] px-1.5 py-0 font-medium`}
                            >
                              <SpecialtyIcon className="mr-0.5 h-2.5 w-2.5" />
                              {specialtyInfo.label}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {tenant.name}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions (visible on hover) */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-lg"
                          title="설정"
                        >
                          <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-lg"
                          title="지식베이스"
                        >
                          <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-lg"
                          onClick={() => openAIConfig(tenant)}
                          title="AI 설정"
                        >
                          <Brain className="h-3.5 w-3.5 text-violet-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-lg text-destructive hover:text-destructive"
                          onClick={() => handleDeleteTenant(tenant.id)}
                          title="삭제"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {/* AI Accuracy with ring chart */}
                      <div className="flex items-center gap-1.5">
                        <MiniRingChart
                          value={tenant.stats.ai_accuracy}
                          size={32}
                          strokeWidth={3}
                          color={getAccuracyColor(tenant.stats.ai_accuracy)}
                        />
                        <div>
                          <p className="text-[10px] text-muted-foreground leading-none mb-0.5">
                            AI정확도
                          </p>
                          <p
                            className={`text-xs font-bold tabular-nums leading-none ${getAccuracyTextClass(tenant.stats.ai_accuracy)}`}
                          >
                            {tenant.stats.ai_accuracy}%
                          </p>
                        </div>
                      </div>

                      {/* Total Conversations */}
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground mb-0.5">총 대화</p>
                        <p className="text-xs font-bold tabular-nums">
                          {tenant.stats.total_conversations.toLocaleString()}
                        </p>
                      </div>

                      {/* Monthly Inquiries */}
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground mb-0.5">월 문의</p>
                        <p className="text-xs font-bold tabular-nums">
                          {tenant.stats.monthly_inquiries.toLocaleString()}
                        </p>
                      </div>

                      {/* CSAT */}
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground mb-0.5">만족도</p>
                        <p className="text-xs font-bold tabular-nums flex items-center justify-center gap-0.5">
                          <Star className="h-2.5 w-2.5 text-amber-500 fill-amber-500" />
                          {tenant.stats.csat_score}
                        </p>
                      </div>
                    </div>

                    {/* AI Config Tags */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-3">
                      <div className="flex items-center gap-1 text-[10px] bg-background/60 px-2 py-0.5 rounded-md">
                        <Brain className="h-2.5 w-2.5 text-violet-500" />
                        <span className="font-medium">{tenant.ai_config.preferred_model}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] bg-background/60 px-2 py-0.5 rounded-md">
                        <Target className="h-2.5 w-2.5 text-orange-500" />
                        <span className="font-medium">
                          {(tenant.ai_config.confidence_threshold * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] bg-background/60 px-2 py-0.5 rounded-md">
                        <Zap
                          className={`h-2.5 w-2.5 ${
                            tenant.ai_config.auto_response_enabled
                              ? "text-emerald-500"
                              : "text-muted-foreground"
                          }`}
                        />
                        <span
                          className={`font-medium ${
                            tenant.ai_config.auto_response_enabled
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-muted-foreground"
                          }`}
                        >
                          {tenant.ai_config.auto_response_enabled ? "자동응대 ON" : "자동응대 OFF"}
                        </span>
                      </div>
                      {tenant.stats.escalation_rate > 10 && (
                        <div className="flex items-center gap-1 text-[10px] bg-red-500/10 px-2 py-0.5 rounded-md">
                          <TrendingUp className="h-2.5 w-2.5 text-red-500" />
                          <span className="font-medium text-red-600 dark:text-red-400">
                            에스컬레이션 {tenant.stats.escalation_rate}%
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Bottom: Channels */}
                    <div className="flex items-center justify-between pt-2.5 border-t border-border/40">
                      <div className="flex items-center gap-1.5">
                        {tenant.channels.map((ch, i) => {
                          const channelInfo = CHANNEL_ICON_MAP[ch.type];
                          const ChannelIcon = channelInfo.icon;
                          return (
                            <div
                              key={`${ch.type}-${i}`}
                              className="flex items-center gap-0.5 text-[10px] bg-background/60 px-1.5 py-0.5 rounded"
                              title={ch.accountName}
                            >
                              <ChannelIcon className={`h-2.5 w-2.5 ${channelInfo.color}`} />
                              <span className="font-medium capitalize">
                                {ch.type === "kakao" ? "카카오" : ch.type}
                              </span>
                            </div>
                          );
                        })}
                        {tenant.channels.length === 0 && (
                          <span className="text-[10px] text-muted-foreground italic">
                            채널 없음
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {new Date(tenant.created_at).toLocaleDateString("ko-KR")}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      </AnimatePresence>

      {/* Empty State */}
      {filteredTenants.length === 0 && tenants.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Card className="border-0 shadow-sm">
            <CardContent className="py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50 mx-auto mb-4">
                <Search className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <h3 className="font-medium text-sm mb-1">검색 결과 없음</h3>
              <p className="text-[11px] text-muted-foreground">
                &ldquo;{searchQuery}&rdquo;에 해당하는 거래처가 없습니다.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {tenants.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-0 shadow-sm bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="py-14 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mx-auto mb-4">
                <Building2 className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-semibold text-base mb-1.5">거래처가 없습니다</h3>
              <p className="text-sm text-muted-foreground mb-5">
                새로운 병원/클리닉 거래처를 등록해주세요.
              </p>
              <Button size="sm" onClick={() => setIsAddDialogOpen(true)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                첫 거래처 추가하기
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* AI Config Dialog */}
      <Dialog
        open={aiConfigTenantId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAiConfigTenantId(null);
            setEditingAIConfig(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/10">
                <Brain className="h-4.5 w-4.5 text-violet-500" />
              </div>
              <div>
                <span className="text-base">AI 설정</span>
                <span className="block text-[11px] text-muted-foreground font-normal">
                  {tenants.find((t) => t.id === aiConfigTenantId)?.display_name}
                </span>
              </div>
            </DialogTitle>
            <DialogDescription className="sr-only">
              AI 자동응대 모델 및 동작을 설정합니다.
            </DialogDescription>
          </DialogHeader>

          {editingAIConfig && (
            <Tabs defaultValue="model" className="mt-2">
              <TabsList className="w-full bg-muted/50 p-0.5">
                <TabsTrigger value="model" className="flex-1 text-xs">
                  모델 설정
                </TabsTrigger>
                <TabsTrigger value="prompt" className="flex-1 text-xs">
                  시스템 프롬프트
                </TabsTrigger>
                <TabsTrigger value="escalation" className="flex-1 text-xs">
                  에스컬레이션
                </TabsTrigger>
              </TabsList>

              {/* Model Tab */}
              <TabsContent value="model" className="space-y-5 mt-4">
                <div className="space-y-2">
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    선호 모델
                  </Label>
                  <Select
                    value={editingAIConfig.preferred_model}
                    onValueChange={(value) =>
                      setEditingAIConfig({
                        ...editingAIConfig,
                        preferred_model: value,
                      })
                    }
                  >
                    <SelectTrigger className="border-0 bg-muted/50 shadow-sm">
                      <SelectValue placeholder="모델 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {MODEL_OPTIONS.map((model) => (
                        <SelectItem key={model.value} value={model.value}>
                          {model.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                      신뢰도 임계값
                    </Label>
                    <span className="text-sm font-mono font-bold text-primary tabular-nums">
                      {(editingAIConfig.confidence_threshold * 100).toFixed(0)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="99"
                    value={editingAIConfig.confidence_threshold * 100}
                    onChange={(e) =>
                      setEditingAIConfig({
                        ...editingAIConfig,
                        confidence_threshold:
                          parseInt(e.target.value, 10) / 100,
                      })
                    }
                    className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>50% (느슨함)</span>
                    <span>99% (엄격함)</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    이 임계값 이상의 신뢰도를 가진 응답만 자동으로 발송됩니다. 낮을수록
                    더 많은 응답이 자동 발송되며, 높을수록 더 신중하게 응답합니다.
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-br from-emerald-500/5 to-emerald-500/10">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">자동 응대 활성화</Label>
                    <p className="text-[11px] text-muted-foreground">
                      AI가 자동으로 고객 문의에 응답합니다
                    </p>
                  </div>
                  <Switch
                    checked={editingAIConfig.auto_response_enabled}
                    onCheckedChange={(checked) =>
                      setEditingAIConfig({
                        ...editingAIConfig,
                        auto_response_enabled: checked,
                      })
                    }
                  />
                </div>
              </TabsContent>

              {/* Prompt Tab */}
              <TabsContent value="prompt" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    시스템 프롬프트
                  </Label>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    AI가 응답을 생성할 때 참조하는 기본 지침입니다. 병원의 특성, 시술
                    종류, 안내 방침 등을 포함해주세요.
                  </p>
                  <Textarea
                    rows={10}
                    placeholder="예: 당신은 OO병원의 AI 상담사입니다..."
                    value={editingAIConfig.system_prompt}
                    onChange={(e) =>
                      setEditingAIConfig({
                        ...editingAIConfig,
                        system_prompt: e.target.value,
                      })
                    }
                    className="border-0 bg-muted/50 shadow-sm text-sm resize-none"
                  />
                  <div className="flex justify-end">
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {editingAIConfig.system_prompt.length}자
                    </span>
                  </div>
                </div>
              </TabsContent>

              {/* Escalation Tab */}
              <TabsContent value="escalation" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                    에스컬레이션 키워드
                  </Label>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    아래 키워드가 고객 메시지에 포함되면 자동으로 담당자에게
                    에스컬레이션됩니다. 쉼표로 구분하여 입력하세요.
                  </p>
                  <Textarea
                    rows={4}
                    placeholder="예: 불만, 환불, 부작용, 통증"
                    value={editingAIConfig.escalation_keywords.join(", ")}
                    onChange={(e) =>
                      setEditingAIConfig({
                        ...editingAIConfig,
                        escalation_keywords: e.target.value
                          .split(",")
                          .map((k) => k.trim())
                          .filter(Boolean),
                      })
                    }
                    className="border-0 bg-muted/50 shadow-sm text-sm resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    현재 등록된 키워드
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {editingAIConfig.escalation_keywords.map((keyword, i) => (
                      <Badge
                        key={i}
                        className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-0 text-[11px] px-2 py-0.5"
                      >
                        {keyword}
                      </Badge>
                    ))}
                    {editingAIConfig.escalation_keywords.length === 0 && (
                      <span className="text-[11px] text-muted-foreground italic">
                        등록된 키워드가 없습니다
                      </span>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter className="mt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAiConfigTenantId(null);
                setEditingAIConfig(null);
              }}
            >
              취소
            </Button>
            <Button size="sm" onClick={handleSaveAIConfig}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
