"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  MessageCircle,
  Instagram,
  Facebook,
  Phone,
  Plus,
  Trash2,
  Settings2,
  Link2,
  Radio,
  CircleOff,
  MessageSquare,
  Hash,
  Activity,
  TrendingUp,
  Zap,
  Globe,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ──

type ChannelType = "line" | "whatsapp" | "facebook" | "instagram" | "kakao" | "wechat";

interface ConnectedChannel {
  id: string;
  channelType: ChannelType;
  accountName: string;
  accountId: string;
  isActive: boolean;
  messageCount: number;
  lastActiveAt: string;
  createdAt: string;
}

// ── Constants ──

const CHANNEL_LABELS: Record<ChannelType, string> = {
  line: "LINE",
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  instagram: "Instagram",
  kakao: "카카오톡",
  wechat: "WeChat",
};

const CHANNEL_BADGE_STYLES: Record<
  ChannelType,
  { bg: string; text: string; color: string; gradientFrom: string; gradientTo: string }
> = {
  line: {
    bg: "bg-[#06C755]",
    text: "text-white",
    color: "#06C755",
    gradientFrom: "from-[#06C755]/10",
    gradientTo: "to-[#06C755]/5",
  },
  whatsapp: {
    bg: "bg-[#25D366]",
    text: "text-white",
    color: "#25D366",
    gradientFrom: "from-[#25D366]/10",
    gradientTo: "to-[#25D366]/5",
  },
  facebook: {
    bg: "bg-[#1877F2]",
    text: "text-white",
    color: "#1877F2",
    gradientFrom: "from-[#1877F2]/10",
    gradientTo: "to-[#1877F2]/5",
  },
  instagram: {
    bg: "bg-gradient-to-r from-[#833AB4] to-[#E1306C]",
    text: "text-white",
    color: "#E1306C",
    gradientFrom: "from-[#833AB4]/10",
    gradientTo: "to-[#E1306C]/5",
  },
  kakao: {
    bg: "bg-[#FEE500]",
    text: "text-[#3C1E1E]",
    color: "#FEE500",
    gradientFrom: "from-[#FEE500]/10",
    gradientTo: "to-[#FEE500]/5",
  },
  wechat: {
    bg: "bg-[#07C160]",
    text: "text-white",
    color: "#07C160",
    gradientFrom: "from-[#07C160]/10",
    gradientTo: "to-[#07C160]/5",
  },
};

const CHANNEL_ICONS: Record<ChannelType, React.ElementType> = {
  line: MessageCircle,
  whatsapp: Phone,
  facebook: Facebook,
  instagram: Instagram,
  kakao: MessageCircle,
  wechat: MessageSquare,
};

// Mock data removed — channels are now loaded exclusively from DB

// ── Animated bar ──

function AnimatedBar({ value, max, color, delay = 0 }: { value: number; max: number; color: string; delay?: number }) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
      <motion.div
        className="h-full rounded-full progress-shine"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.8, delay, ease: smoothEase }}
      />
    </div>
  );
}

// ── 애니메이션 프리셋 ──

const smoothEase = [0.22, 1, 0.36, 1] as [number, number, number, number];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: smoothEase } },
};

// ── 메인 컴포넌트 ──

interface Tenant {
  id: string;
  name: string;
  display_name: string;
  specialty: string | null;
}

export default function ChannelsPage() {
  const [channels, setChannels] = useState<ConnectedChannel[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newChannelType, setNewChannelType] = useState<ChannelType | "">("");
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountId, setNewAccountId] = useState("");
  const [newCredentials, setNewCredentials] = useState("");
  const [newChannelSecret, setNewChannelSecret] = useState("");
  const [newBotBasicId, setNewBotBasicId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");

  // Fetch tenants
  useEffect(() => {
    async function loadTenants() {
      try {
        const res = await fetch("/api/tenants");
        if (res.ok) {
          const data = await res.json();
          const list: Tenant[] = data.tenants || [];
          setTenants(list);
          if (list.length > 0) {
            setSelectedTenantId(list[0].id);
          }
        }
      } catch {
        // Fallback: use demo tenant
        setSelectedTenantId("demo-tenant-id");
      }
    }
    loadTenants();
  }, []);

  // Fetch channels when tenant changes
  useEffect(() => {
    if (!selectedTenantId) return;
    async function loadChannels() {
      try {
        const response = await fetch(`/api/channels?tenantId=${selectedTenantId}`);
        if (!response.ok) throw new Error("API error");
        const data = await response.json();
        if (data.channels && data.channels.length > 0) {
          setChannels(data.channels.map((ch: Record<string, unknown>) => ({
            id: ch.id as string,
            channelType: ch.channelType as ChannelType,
            accountName: ch.accountName as string,
            accountId: ch.accountId as string,
            isActive: ch.isActive as boolean,
            messageCount: (ch.messageCount as number) ?? 0,
            lastActiveAt: (ch.lastActiveAt as string) ?? "-",
            createdAt: ch.createdAt as string,
          })));
        } else {
          setChannels([]);
        }
      } catch {
        setChannels([]);
      }
    }
    loadChannels();
  }, [selectedTenantId]);

  // 통계
  const totalChannels = channels.length;
  const activeChannels = channels.filter((c) => c.isActive).length;
  const inactiveChannels = channels.filter((c) => !c.isActive).length;
  const todayMessages = channels.reduce((sum, c) => sum + c.messageCount, 0);
  const maxMessages = Math.max(...channels.map((c) => c.messageCount), 1);

  const handleToggle = (id: string, checked: boolean) => {
    setChannels((prev) => prev.map((ch) => (ch.id === id ? { ...ch, isActive: checked } : ch)));
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/channels?channelId=${id}`, { method: "DELETE" });
    } catch {
      // Best-effort API call; remove from UI regardless
    }
    setChannels((prev) => prev.filter((ch) => ch.id !== id));
  };

  const handleAddChannel = async () => {
    if (!newChannelType || !newAccountName || !newAccountId) return;
    setIsSubmitting(true);
    setSubmitError("");

    try {
      // Build credentials based on channel type
      const credentials: Record<string, string> = {};
      if (newChannelType === "line") {
        credentials.access_token = newCredentials;
        credentials.channel_secret = newChannelSecret;
        credentials.channel_id = newAccountId;
        if (newBotBasicId) credentials.bot_basic_id = newBotBasicId;
      } else if (newChannelType === "kakao") {
        credentials.api_key = newCredentials;
        if (newChannelSecret) credentials.admin_key = newChannelSecret;
      } else if (newChannelType === "wechat") {
        credentials.app_secret = newChannelSecret;
        credentials.access_token = newCredentials;
      } else {
        // Meta channels – pass token directly
        credentials.access_token = newCredentials;
      }

      const response = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: selectedTenantId || "demo-tenant-id",
          channelType: newChannelType,
          accountName: newAccountName,
          accountId: newAccountId,
          credentials,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "채널 등록 실패");
      }

      // Add to local state from API response
      const ch = data.channel;
      const newChannel: ConnectedChannel = {
        id: ch.id,
        channelType: ch.channelType as ChannelType,
        accountName: ch.accountName,
        accountId: ch.accountId,
        isActive: ch.isActive ?? true,
        messageCount: ch.messageCount ?? 0,
        lastActiveAt: ch.lastActiveAt ?? "방금 전",
        createdAt: ch.createdAt ?? new Date().toISOString().split("T")[0],
      };
      setChannels((prev) => [...prev, newChannel]);
      setDialogOpen(false);
      setNewChannelType("");
      setNewAccountName("");
      setNewAccountId("");
      setNewCredentials("");
      setNewChannelSecret("");
      setNewBotBasicId("");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "채널 등록에 실패했습니다");
    } finally {
      setIsSubmitting(false);
    }
  };

  const summaryStats = [
    { title: "총 연결 채널", value: totalChannels, icon: Link2, color: "text-blue-500", iconBg: "bg-blue-500/10", gradientFrom: "from-blue-500/10", gradientTo: "to-blue-600/5", barColor: "#3B82F6", subtitle: "전체 채널" },
    { title: "활성 채널", value: activeChannels, icon: Radio, color: "text-emerald-500", iconBg: "bg-emerald-500/10", gradientFrom: "from-emerald-500/10", gradientTo: "to-emerald-600/5", barColor: "#10B981", subtitle: "실시간 수신 중" },
    { title: "비활성 채널", value: inactiveChannels, icon: CircleOff, color: "text-slate-400", iconBg: "bg-slate-500/10", gradientFrom: "from-slate-500/10", gradientTo: "to-slate-600/5", barColor: "#94A3B8", subtitle: "일시 중지" },
    { title: "오늘 메시지", value: todayMessages.toLocaleString(), icon: MessageSquare, color: "text-violet-500", iconBg: "bg-violet-500/10", gradientFrom: "from-violet-500/10", gradientTo: "to-violet-600/5", barColor: "#8B5CF6", subtitle: "처리된 메시지" },
  ];

  const channelDistribution = channels.reduce((acc, ch) => {
    acc[ch.channelType] = (acc[ch.channelType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6 animate-in-up">
      {/* ── 페이지 헤더 ── */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500">
              <Globe className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">채널 관리</h1>
              <p className="text-[13px] text-muted-foreground">
                연결된 메신저 채널을 한눈에 관리하세요
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* 거래처 선택 */}
          {tenants.length > 0 && (
            <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
              <SelectTrigger className="w-[200px] rounded-xl">
                <SelectValue placeholder="거래처 선택" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                    {t.specialty ? ` (${t.specialty})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-sm rounded-xl">
              <Plus className="w-4 h-4" />
              채널 추가
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>새 채널 추가</DialogTitle>
              <DialogDescription>
                연결할 메신저 채널 정보를 입력하세요.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>채널 유형</Label>
                <Select value={newChannelType} onValueChange={(v) => { setNewChannelType(v as ChannelType); setSubmitError(""); }}>
                  <SelectTrigger className="w-full rounded-lg">
                    <SelectValue placeholder="채널을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="line">LINE</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="facebook">Facebook Messenger</SelectItem>
                    <SelectItem value="instagram">Instagram DM</SelectItem>
                    <SelectItem value="kakao">카카오톡</SelectItem>
                    <SelectItem value="wechat">WeChat</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>계정 이름</Label>
                <Input placeholder="예: 힐링안과 LINE" value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} className="rounded-lg" />
              </div>
              <div className="grid gap-2">
                <Label>{newChannelType === "line" ? "채널 ID (Channel ID)" : "계정 ID"}</Label>
                <Input
                  placeholder={newChannelType === "line" ? "예: 2008754781" : "예: healing_eye_jp"}
                  value={newAccountId}
                  onChange={(e) => setNewAccountId(e.target.value)}
                  className="rounded-lg"
                />
              </div>

              {/* Channel Access Token */}
              <div className="grid gap-2">
                <Label>
                  {newChannelType === "line" ? "채널 액세스 토큰 (Channel Access Token)" :
                   newChannelType === "kakao" ? "REST API 키" :
                   newChannelType === "wechat" ? "앱 ID (App ID)" :
                   "인증 정보 (Credentials)"}
                </Label>
                <Input
                  type="password"
                  placeholder={newChannelType === "line" ? "Channel Access Token" :
                               newChannelType === "kakao" ? "REST API Key" :
                               newChannelType === "wechat" ? "App ID" :
                               "Access Token / API Key"}
                  value={newCredentials}
                  onChange={(e) => setNewCredentials(e.target.value)}
                  className="rounded-lg"
                />
              </div>

              {/* Channel Secret (LINE, KakaoTalk, WeChat) */}
              {(newChannelType === "line" || newChannelType === "kakao" || newChannelType === "wechat") && (
                <div className="grid gap-2">
                  <Label>
                    {newChannelType === "line" ? "채널 시크릿 (Channel Secret)" :
                     newChannelType === "kakao" ? "Admin 키 (선택)" :
                     "앱 시크릿 (App Secret)"}
                  </Label>
                  <Input
                    type="password"
                    placeholder={newChannelType === "line" ? "Channel Secret" :
                                 newChannelType === "kakao" ? "Admin Key (선택사항)" :
                                 "App Secret"}
                    value={newChannelSecret}
                    onChange={(e) => setNewChannelSecret(e.target.value)}
                    className="rounded-lg"
                  />
                </div>
              )}

              {/* Bot Basic ID (LINE only) */}
              {newChannelType === "line" && (
                <div className="grid gap-2">
                  <Label>봇 Basic ID (선택)</Label>
                  <Input
                    placeholder="예: @246kdolz"
                    value={newBotBasicId}
                    onChange={(e) => setNewBotBasicId(e.target.value)}
                    className="rounded-lg"
                  />
                </div>
              )}

              {submitError && (
                <p className="text-sm text-destructive">{submitError}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDialogOpen(false); setSubmitError(""); }} className="rounded-lg">취소</Button>
              <Button onClick={handleAddChannel} disabled={!newChannelType || !newAccountName || !newAccountId || isSubmitting} className="rounded-lg">
                {isSubmitting ? "등록 중..." : "채널 연결"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* ── 요약 통계 ── */}
      <motion.div
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {summaryStats.map((stat, index) => (
          <motion.div key={stat.title} variants={itemVariants}>
            <Card className={`relative overflow-hidden border-0 shadow-sm bg-gradient-to-br ${stat.gradientFrom} ${stat.gradientTo} card-3d`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${stat.iconBg}`}>
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                  {stat.title === "활성 채널" && activeChannels > 0 && (
                    <span className="flex items-center gap-1.5">
                      <span className="live-dot h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-[11px] font-medium text-emerald-600">Live</span>
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold tabular-nums tracking-tight">{stat.value}</p>
                  <p className="text-[11px] text-muted-foreground">{stat.subtitle}</p>
                </div>
                <div className="mt-3">
                  <AnimatedBar
                    value={typeof stat.value === "number" ? stat.value : todayMessages}
                    max={typeof stat.value === "number" ? totalChannels || 1 : 5000}
                    color={stat.barColor}
                    delay={index * 0.1}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* ── 새 채널 연결 섹션 ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4, ease: smoothEase }}
      >
        <Card className="border-0 shadow-sm overflow-hidden rounded-2xl">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/20">
                <Sparkles className="h-4 w-4 text-violet-500" />
              </div>
              <div>
                <CardTitle className="text-[15px]">빠른 채널 연결</CardTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  고객 문의를 받을 메신저 채널을 연결하세요
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Meta Platform */}
              <div
                className="group relative rounded-xl bg-gradient-to-br from-blue-500/5 to-purple-500/5 p-4 cursor-pointer transition-all duration-200 hover:from-blue-500/10 hover:to-purple-500/10 card-3d"
                onClick={() => { setNewChannelType("facebook"); setDialogOpen(true); }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    <div className="w-9 h-9 rounded-xl bg-[#1877F2]/10 flex items-center justify-center ring-2 ring-background">
                      <Facebook className="w-4 h-4 text-[#1877F2]" />
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#833AB4]/10 to-[#E1306C]/10 flex items-center justify-center ring-2 ring-background">
                      <Instagram className="w-4 h-4 text-[#E1306C]" />
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-[#25D366]/10 flex items-center justify-center ring-2 ring-background">
                      <Phone className="w-4 h-4 text-[#25D366]" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[13px] font-semibold">Meta Platform</h3>
                    <p className="text-[11px] text-muted-foreground">Facebook, Instagram, WhatsApp</p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Plus className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </div>

              {/* LINE */}
              <div
                className="group relative rounded-xl bg-gradient-to-br from-[#06C755]/5 to-[#06C755]/[0.02] p-4 cursor-pointer transition-all duration-200 hover:from-[#06C755]/10 hover:to-[#06C755]/5 card-3d"
                onClick={() => { setNewChannelType("line"); setDialogOpen(true); }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#06C755]/10 flex items-center justify-center">
                    <MessageCircle className="w-4 h-4 text-[#06C755]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[13px] font-semibold">LINE</h3>
                    <p className="text-[11px] text-muted-foreground">LINE Official Account</p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Plus className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </div>

              {/* KakaoTalk */}
              <div
                className="group relative rounded-xl bg-gradient-to-br from-[#FEE500]/10 to-[#FEE500]/[0.02] p-4 cursor-pointer transition-all duration-200 hover:from-[#FEE500]/15 hover:to-[#FEE500]/5 card-3d"
                onClick={() => { setNewChannelType("kakao"); setDialogOpen(true); }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#FEE500]/15 flex items-center justify-center">
                    <MessageCircle className="w-4 h-4 text-[#B8A000]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[13px] font-semibold">카카오톡</h3>
                    <p className="text-[11px] text-muted-foreground">카카오 i 오픈빌더</p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Plus className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── 연결된 채널 목록 ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4, ease: smoothEase }}
      >
        <Card className="border-0 shadow-sm overflow-hidden rounded-2xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10">
                  <Activity className="h-4 w-4 text-emerald-500" />
                </div>
                <div>
                  <CardTitle className="text-[15px] flex items-center gap-2">
                    연결된 채널
                    <Badge variant="secondary" className="text-[11px] font-semibold tabular-nums h-5 px-1.5 rounded-full">
                      {channels.length}
                    </Badge>
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    현재 연결된 메신저 채널 목록입니다
                  </p>
                </div>
              </div>

              {/* 채널 타입 미니 뱃지 */}
              <div className="hidden md:flex items-center gap-1.5">
                {Object.entries(channelDistribution).map(([type, count]) => {
                  const style = CHANNEL_BADGE_STYLES[type as ChannelType];
                  return (
                    <span
                      key={type}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{
                        backgroundColor: `${style.color}15`,
                        color: style.color === "#FEE500" ? "#B8A000" : style.color,
                      }}
                    >
                      {CHANNEL_LABELS[type as ChannelType]}
                      <span className="tabular-nums">{count}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {channels.length === 0 ? (
              <div className="text-center py-12">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/50 mx-auto mb-3">
                  <Link2 className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">연결된 채널이 없습니다</p>
                <p className="text-[11px] text-muted-foreground mt-1">위에서 새 채널을 연결하세요.</p>
              </div>
            ) : (
              <motion.div className="space-y-2" variants={containerVariants} initial="hidden" animate="visible">
                <AnimatePresence mode="popLayout">
                  {channels.map((channel) => {
                    const Icon = CHANNEL_ICONS[channel.channelType];
                    const style = CHANNEL_BADGE_STYLES[channel.channelType];

                    return (
                      <motion.div
                        key={channel.id}
                        variants={itemVariants}
                        exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0, transition: { duration: 0.2 } }}
                        layout
                        whileHover={{ scale: 1.005 }}
                        className={`group relative flex items-center gap-4 rounded-xl p-3.5 transition-colors ${
                          channel.isActive
                            ? `bg-gradient-to-br ${style.gradientFrom} ${style.gradientTo}`
                            : "bg-muted/30"
                        }`}
                      >
                        {/* 채널 아이콘 */}
                        <div
                          className="relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                          style={{ backgroundColor: `${style.color}15` }}
                        >
                          <Icon className="w-5 h-5" style={{ color: style.color === "#FEE500" ? "#B8A000" : style.color }} />
                          {channel.isActive && (
                            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background" style={{ backgroundColor: style.color }} />
                          )}
                        </div>

                        {/* 채널 정보 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span
                              className="inline-flex items-center px-1.5 py-px rounded-md text-[10px] font-bold tracking-wide"
                              style={{
                                backgroundColor: `${style.color}20`,
                                color: style.color === "#FEE500" ? "#B8A000" : style.color,
                              }}
                            >
                              {CHANNEL_LABELS[channel.channelType]}
                            </span>
                            <span className="font-medium text-[13px] truncate">{channel.accountName}</span>
                            {channel.isActive ? (
                              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 text-[10px] h-[18px] px-1.5 font-semibold border-0 rounded-full">
                                <span className="live-dot mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                활성
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-muted text-muted-foreground text-[10px] h-[18px] px-1.5 font-medium border-0 rounded-full">
                                비활성
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Hash className="w-3 h-3" />
                              <span className="font-mono">{channel.accountId}</span>
                            </span>
                            <span className="hidden sm:inline text-muted-foreground/40">|</span>
                            <span className="hidden sm:flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />
                              <span className="tabular-nums font-medium">{channel.messageCount.toLocaleString()}</span>
                              건
                            </span>
                            <span className="hidden sm:inline text-muted-foreground/40">|</span>
                            <span className="hidden sm:flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              {channel.lastActiveAt}
                            </span>
                          </div>
                          <div className="mt-2 hidden sm:block">
                            <AnimatedBar
                              value={channel.messageCount}
                              max={maxMessages}
                              color={style.color === "#FEE500" ? "#B8A000" : style.color}
                              delay={0.2}
                            />
                          </div>
                        </div>

                        {/* 액션 */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Switch checked={channel.isActive} onCheckedChange={(checked) => handleToggle(channel.id, checked)} />
                          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                            <Settings2 className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(channel.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
