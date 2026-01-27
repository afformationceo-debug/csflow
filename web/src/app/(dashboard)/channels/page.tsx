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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHANNEL_LABELS: Record<ChannelType, string> = {
  line: "LINE",
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  instagram: "Instagram",
  kakao: "\uCE74\uCE74\uC624\uD1A1",
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

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_CHANNELS: ConnectedChannel[] = [
  {
    id: "ch-001",
    channelType: "line",
    accountName: "\uD798\uB9C1\uC548\uACFC LINE",
    accountId: "healing_eye_jp",
    isActive: true,
    messageCount: 1245,
    lastActiveAt: "2\uBD84 \uC804",
    createdAt: "2025-08-15",
  },
  {
    id: "ch-002",
    channelType: "line",
    accountName: "\uAC15\uB0A8\uD53C\uBD80\uACFC LINE",
    accountId: "gangnam_skin_jp",
    isActive: true,
    messageCount: 823,
    lastActiveAt: "5\uBD84 \uC804",
    createdAt: "2025-09-10",
  },
  {
    id: "ch-003",
    channelType: "whatsapp",
    accountName: "\uD798\uB9C1\uC548\uACFC WhatsApp",
    accountId: "+82-2-xxxx-xxxx",
    isActive: true,
    messageCount: 567,
    lastActiveAt: "12\uBD84 \uC804",
    createdAt: "2025-10-01",
  },
  {
    id: "ch-004",
    channelType: "facebook",
    accountName: "\uC11C\uC6B8\uC131\uD615 Facebook",
    accountId: "seoul_plastic",
    isActive: true,
    messageCount: 412,
    lastActiveAt: "18\uBD84 \uC804",
    createdAt: "2025-10-20",
  },
  {
    id: "ch-005",
    channelType: "instagram",
    accountName: "\uC11C\uC6B8\uC131\uD615 Instagram",
    accountId: "seoul_plastic_ig",
    isActive: true,
    messageCount: 298,
    lastActiveAt: "25\uBD84 \uC804",
    createdAt: "2025-11-05",
  },
  {
    id: "ch-006",
    channelType: "kakao",
    accountName: "\uC2A4\uB9C8\uC77C\uCE58\uACFC \uCE74\uCE74\uC624\uD1A1",
    accountId: "smile_dental",
    isActive: false,
    messageCount: 156,
    lastActiveAt: "3\uC2DC\uAC04 \uC804",
    createdAt: "2025-12-01",
  },
];

// ---------------------------------------------------------------------------
// Helper: Fetch channels from Supabase with mock fallback
// ---------------------------------------------------------------------------

async function fetchChannels(): Promise<ConnectedChannel[]> {
  try {
    const response = await fetch("/api/channels?tenantId=demo-tenant-id");
    if (!response.ok) throw new Error("API error");
    const data = await response.json();
    if (data.channels && data.channels.length > 0) {
      return data.channels.map((ch: Record<string, unknown>) => ({
        id: ch.id as string,
        channelType: ch.channelType as ChannelType,
        accountName: ch.accountName as string,
        accountId: ch.accountId as string,
        isActive: ch.isActive as boolean,
        messageCount: (ch.messageCount as number) ?? 0,
        lastActiveAt: (ch.lastActiveAt as string) ?? "-",
        createdAt: ch.createdAt as string,
      }));
    }
    throw new Error("empty");
  } catch {
    return MOCK_CHANNELS;
  }
}

// ---------------------------------------------------------------------------
// Animated progress bar component
// ---------------------------------------------------------------------------

function AnimatedBar({
  value,
  max,
  color,
  delay = 0,
}: {
  value: number;
  max: number;
  color: string;
  delay?: number;
}) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  return (
    <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Container animation variants
// ---------------------------------------------------------------------------

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
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

const cardHover = {
  y: -2,
  transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChannelsPage() {
  const [channels, setChannels] = useState<ConnectedChannel[]>(MOCK_CHANNELS);
  const [dialogOpen, setDialogOpen] = useState(false);

  // New channel form state
  const [newChannelType, setNewChannelType] = useState<ChannelType | "">("");
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountId, setNewAccountId] = useState("");
  const [newCredentials, setNewCredentials] = useState("");

  // Attempt DB fetch on mount
  useEffect(() => {
    fetchChannels().then(setChannels);
  }, []);

  // Derived stats
  const totalChannels = channels.length;
  const activeChannels = channels.filter((c) => c.isActive).length;
  const inactiveChannels = channels.filter((c) => !c.isActive).length;
  const todayMessages = channels.reduce((sum, c) => sum + c.messageCount, 0);
  const maxMessages = Math.max(...channels.map((c) => c.messageCount), 1);

  // Toggle active
  const handleToggle = (id: string, checked: boolean) => {
    setChannels((prev) =>
      prev.map((ch) => (ch.id === id ? { ...ch, isActive: checked } : ch))
    );
  };

  // Delete channel
  const handleDelete = (id: string) => {
    setChannels((prev) => prev.filter((ch) => ch.id !== id));
  };

  // Add channel
  const handleAddChannel = () => {
    if (!newChannelType || !newAccountName || !newAccountId) return;

    const newChannel: ConnectedChannel = {
      id: `ch-${Date.now()}`,
      channelType: newChannelType as ChannelType,
      accountName: newAccountName,
      accountId: newAccountId,
      isActive: true,
      messageCount: 0,
      lastActiveAt: "\uBC29\uAE08 \uC804",
      createdAt: new Date().toISOString().split("T")[0],
    };

    setChannels((prev) => [...prev, newChannel]);
    setDialogOpen(false);
    setNewChannelType("");
    setNewAccountName("");
    setNewAccountId("");
    setNewCredentials("");
  };

  // Stats cards data
  const summaryStats = [
    {
      title: "\uCD1D \uC5F0\uACB0 \uCC44\uB110",
      value: totalChannels,
      icon: Link2,
      color: "text-blue-500",
      iconBg: "bg-blue-500/10",
      gradientFrom: "from-blue-500/10",
      gradientTo: "to-blue-600/5",
      barColor: "#3B82F6",
      subtitle: "\uC804\uCCB4 \uCC44\uB110",
    },
    {
      title: "\uD65C\uC131 \uCC44\uB110",
      value: activeChannels,
      icon: Radio,
      color: "text-emerald-500",
      iconBg: "bg-emerald-500/10",
      gradientFrom: "from-emerald-500/10",
      gradientTo: "to-emerald-600/5",
      barColor: "#10B981",
      subtitle: "\uC2E4\uC2DC\uAC04 \uC218\uC2E0 \uC911",
    },
    {
      title: "\uBE44\uD65C\uC131 \uCC44\uB110",
      value: inactiveChannels,
      icon: CircleOff,
      color: "text-slate-400",
      iconBg: "bg-slate-500/10",
      gradientFrom: "from-slate-500/10",
      gradientTo: "to-slate-600/5",
      barColor: "#94A3B8",
      subtitle: "\uC77C\uC2DC \uC911\uC9C0",
    },
    {
      title: "\uC624\uB298 \uBA54\uC2DC\uC9C0",
      value: todayMessages.toLocaleString(),
      icon: MessageSquare,
      color: "text-violet-500",
      iconBg: "bg-violet-500/10",
      gradientFrom: "from-violet-500/10",
      gradientTo: "to-violet-600/5",
      barColor: "#8B5CF6",
      subtitle: "\uCC98\uB9AC\uB41C \uBA54\uC2DC\uC9C0",
    },
  ];

  // Channel type distribution for quick stats
  const channelDistribution = channels.reduce(
    (acc, ch) => {
      acc[ch.channelType] = (acc[ch.channelType] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-6 animate-in-up">
      {/* ----------------------------------------------------------------- */}
      {/* Page Header                                                       */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {"\uCC44\uB110 \uAD00\uB9AC"}
              </h1>
              <p className="text-[13px] text-muted-foreground">
                {"\uBA54\uC2E0\uC800 \uCC44\uB110\uC744 \uC5F0\uACB0\uD558\uACE0 \uAD00\uB9AC\uD569\uB2C8\uB2E4"}
              </p>
            </div>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-sm">
              <Plus className="w-4 h-4" />
              {"\uCC44\uB110 \uCD94\uAC00"}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>{"\uC0C8 \uCC44\uB110 \uCD94\uAC00"}</DialogTitle>
              <DialogDescription>
                {"\uC5F0\uACB0\uD560 \uBA54\uC2E0\uC800 \uCC44\uB110 \uC815\uBCF4\uB97C \uC785\uB825\uD558\uC138\uC694."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>{"\uCC44\uB110 \uC720\uD615"}</Label>
                <Select
                  value={newChannelType}
                  onValueChange={(v) => setNewChannelType(v as ChannelType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={"\uCC44\uB110\uC744 \uC120\uD0DD\uD558\uC138\uC694"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="line">LINE</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="facebook">Facebook Messenger</SelectItem>
                    <SelectItem value="instagram">Instagram DM</SelectItem>
                    <SelectItem value="kakao">{"\uCE74\uCE74\uC624\uD1A1"}</SelectItem>
                    <SelectItem value="wechat">WeChat</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{"\uACC4\uC815 \uC774\uB984"}</Label>
                <Input
                  placeholder={"\uC608: \uD798\uB9C1\uC548\uACFC LINE"}
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>{"\uACC4\uC815 ID"}</Label>
                <Input
                  placeholder={"\uC608: healing_eye_jp"}
                  value={newAccountId}
                  onChange={(e) => setNewAccountId(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>{"\uC778\uC99D \uC815\uBCF4 (Credentials)"}</Label>
                <Input
                  type="password"
                  placeholder="Access Token / API Key"
                  value={newCredentials}
                  onChange={(e) => setNewCredentials(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {"\uCDE8\uC18C"}
              </Button>
              <Button onClick={handleAddChannel} disabled={!newChannelType || !newAccountName || !newAccountId}>
                {"\uCC44\uB110 \uC5F0\uACB0"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Summary Stats                                                     */}
      {/* ----------------------------------------------------------------- */}
      <motion.div
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {summaryStats.map((stat, index) => (
          <motion.div key={stat.title} variants={itemVariants} whileHover={cardHover}>
            <Card className={`relative overflow-hidden border-0 shadow-sm bg-gradient-to-br ${stat.gradientFrom} ${stat.gradientTo} hover-lift`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${stat.iconBg}`}>
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                  {stat.title === "\uD65C\uC131 \uCC44\uB110" && activeChannels > 0 && (
                    <span className="flex items-center gap-1.5">
                      <span className="live-dot h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-[11px] font-medium text-emerald-600">Live</span>
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {stat.title}
                  </p>
                  <p className="text-2xl font-bold tabular-nums tracking-tight">
                    {stat.value}
                  </p>
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

      {/* ----------------------------------------------------------------- */}
      {/* Channel Connection Section                                        */}
      {/* ----------------------------------------------------------------- */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
      >
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-[15px]">{"\uC0C8 \uCC44\uB110 \uC5F0\uACB0"}</CardTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {"\uACE0\uAC1D \uBB38\uC758\uB97C \uBC1B\uC744 \uBA54\uC2E0\uC800 \uCC44\uB110\uC744 \uC5F0\uACB0\uD558\uC138\uC694"}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 stagger-children">
              {/* Meta Platform */}
              <div
                className="group relative rounded-xl bg-gradient-to-br from-blue-500/5 to-purple-500/5 p-4 cursor-pointer transition-all duration-200 hover:from-blue-500/10 hover:to-purple-500/10 hover-lift"
                onClick={() => {
                  setNewChannelType("facebook");
                  setDialogOpen(true);
                }}
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
                    <p className="text-[11px] text-muted-foreground">
                      Facebook, Instagram, WhatsApp
                    </p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Plus className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </div>

              {/* LINE */}
              <div
                className="group relative rounded-xl bg-gradient-to-br from-[#06C755]/5 to-[#06C755]/[0.02] p-4 cursor-pointer transition-all duration-200 hover:from-[#06C755]/10 hover:to-[#06C755]/5 hover-lift"
                onClick={() => {
                  setNewChannelType("line");
                  setDialogOpen(true);
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#06C755]/10 flex items-center justify-center">
                    <MessageCircle className="w-4 h-4 text-[#06C755]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[13px] font-semibold">LINE</h3>
                    <p className="text-[11px] text-muted-foreground">
                      LINE Official Account
                    </p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Plus className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </div>

              {/* KakaoTalk */}
              <div
                className="group relative rounded-xl bg-gradient-to-br from-[#FEE500]/10 to-[#FEE500]/[0.02] p-4 cursor-pointer transition-all duration-200 hover:from-[#FEE500]/15 hover:to-[#FEE500]/5 hover-lift"
                onClick={() => {
                  setNewChannelType("kakao");
                  setDialogOpen(true);
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#FEE500]/15 flex items-center justify-center">
                    <MessageCircle className="w-4 h-4 text-[#B8A000]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[13px] font-semibold">{"\uCE74\uCE74\uC624\uD1A1"}</h3>
                    <p className="text-[11px] text-muted-foreground">
                      {"\uCE74\uCE74\uC624 i \uC624\uD508\uBE4C\uB354"}
                    </p>
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

      {/* ----------------------------------------------------------------- */}
      {/* Connected Channels List                                           */}
      {/* ----------------------------------------------------------------- */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
      >
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10">
                  <Activity className="h-4 w-4 text-emerald-500" />
                </div>
                <div>
                  <CardTitle className="text-[15px] flex items-center gap-2">
                    {"\uC5F0\uACB0\uB41C \uCC44\uB110"}
                    <Badge
                      variant="secondary"
                      className="text-[11px] font-semibold tabular-nums h-5 px-1.5 rounded-md"
                    >
                      {channels.length}
                    </Badge>
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {"\uD604\uC7AC \uC5F0\uACB0\uB41C \uBA54\uC2E0\uC800 \uCC44\uB110 \uBAA9\uB85D\uC785\uB2C8\uB2E4"}
                  </p>
                </div>
              </div>

              {/* Channel type mini-pills */}
              <div className="hidden md:flex items-center gap-1.5">
                {Object.entries(channelDistribution).map(([type, count]) => {
                  const style = CHANNEL_BADGE_STYLES[type as ChannelType];
                  return (
                    <span
                      key={type}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold"
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
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50 mx-auto mb-3">
                  <Link2 className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {"\uC5F0\uACB0\uB41C \uCC44\uB110\uC774 \uC5C6\uC2B5\uB2C8\uB2E4"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {"\uC704\uC5D0\uC11C \uC0C8 \uCC44\uB110\uC744 \uC5F0\uACB0\uD558\uC138\uC694."}
                </p>
              </div>
            ) : (
              <motion.div
                className="space-y-2"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                <AnimatePresence mode="popLayout">
                  {channels.map((channel) => {
                    const Icon = CHANNEL_ICONS[channel.channelType];
                    const style = CHANNEL_BADGE_STYLES[channel.channelType];

                    return (
                      <motion.div
                        key={channel.id}
                        variants={itemVariants}
                        exit={{
                          opacity: 0,
                          x: -20,
                          height: 0,
                          marginBottom: 0,
                          transition: { duration: 0.2 },
                        }}
                        layout
                        whileHover={{ scale: 1.005 }}
                        className={`group relative flex items-center gap-4 rounded-xl p-3.5 transition-colors ${
                          channel.isActive
                            ? `bg-gradient-to-br ${style.gradientFrom} ${style.gradientTo}`
                            : "bg-muted/30"
                        }`}
                      >
                        {/* Channel icon */}
                        <div
                          className="relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                          style={{
                            backgroundColor: `${style.color}15`,
                          }}
                        >
                          <Icon
                            className="w-5 h-5"
                            style={{
                              color: style.color === "#FEE500" ? "#B8A000" : style.color,
                            }}
                          />
                          {channel.isActive && (
                            <span
                              className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background"
                              style={{ backgroundColor: style.color }}
                            />
                          )}
                        </div>

                        {/* Channel info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span
                              className="inline-flex items-center px-1.5 py-px rounded text-[10px] font-bold tracking-wide"
                              style={{
                                backgroundColor: `${style.color}20`,
                                color: style.color === "#FEE500" ? "#B8A000" : style.color,
                              }}
                            >
                              {CHANNEL_LABELS[channel.channelType]}
                            </span>
                            <span className="font-medium text-[13px] truncate">
                              {channel.accountName}
                            </span>
                            {channel.isActive ? (
                              <Badge
                                variant="secondary"
                                className="bg-emerald-500/10 text-emerald-600 text-[10px] h-[18px] px-1.5 font-semibold border-0"
                              >
                                <span className="live-dot mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                {"\uD65C\uC131"}
                              </Badge>
                            ) : (
                              <Badge
                                variant="secondary"
                                className="bg-muted text-muted-foreground text-[10px] h-[18px] px-1.5 font-medium border-0"
                              >
                                {"\uBE44\uD65C\uC131"}
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
                              <span className="tabular-nums font-medium">
                                {channel.messageCount.toLocaleString()}
                              </span>
                              {"\uAC74"}
                            </span>
                            <span className="hidden sm:inline text-muted-foreground/40">|</span>
                            <span className="hidden sm:flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              {channel.lastActiveAt}
                            </span>
                          </div>
                          {/* Mini progress bar for message volume */}
                          <div className="mt-2 hidden sm:block">
                            <AnimatedBar
                              value={channel.messageCount}
                              max={maxMessages}
                              color={style.color === "#FEE500" ? "#B8A000" : style.color}
                              delay={0.2}
                            />
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Switch
                            checked={channel.isActive}
                            onCheckedChange={(checked) =>
                              handleToggle(channel.id, checked)
                            }
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          >
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
