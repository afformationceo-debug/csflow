"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Users,
  UserCheck,
  ClipboardCheck,
  Clock,
  Plus,
  Shield,
  ShieldCheck,
  Headphones,
  Clipboard,
  Search,
  MoreHorizontal,
  Star,
  Mail,
  TrendingUp,
  Activity,
  CheckCircle2,
  XCircle,
  Zap,
} from "lucide-react";
import { motion } from "framer-motion";

// --- Types ---
type Role = "admin" | "manager" | "agent" | "coordinator";
type Status = "online" | "offline" | "away";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: Status;
  avatar: string | null;
  tenants: string[];
  performance: {
    todayResolved: number;
    avgResponseTime: string;
    satisfaction: string;
  };
}

// --- Mock Data ---
const mockTeamMembers: TeamMember[] = [
  {
    id: "1",
    name: "김관리자",
    email: "kimadmin@csflow.kr",
    role: "admin",
    status: "online",
    avatar: null,
    tenants: ["전체 거래처"],
    performance: {
      todayResolved: 45,
      avgResponseTime: "32분",
      satisfaction: "4.9",
    },
  },
  {
    id: "2",
    name: "박매니저",
    email: "parkmanager@csflow.kr",
    role: "manager",
    status: "online",
    avatar: null,
    tenants: ["힐링안과", "스마일치과"],
    performance: {
      todayResolved: 38,
      avgResponseTime: "41분",
      satisfaction: "4.7",
    },
  },
  {
    id: "3",
    name: "이상담사",
    email: "lee@csflow.kr",
    role: "agent",
    status: "online",
    avatar: null,
    tenants: ["힐링안과"],
    performance: {
      todayResolved: 29,
      avgResponseTime: "38분",
      satisfaction: "4.6",
    },
  },
  {
    id: "4",
    name: "최상담사",
    email: "choi@csflow.kr",
    role: "agent",
    status: "away",
    avatar: null,
    tenants: ["서울성형", "강남피부과"],
    performance: {
      todayResolved: 24,
      avgResponseTime: "45분",
      satisfaction: "4.5",
    },
  },
  {
    id: "5",
    name: "김코디",
    email: "kimcoord@csflow.kr",
    role: "coordinator",
    status: "online",
    avatar: null,
    tenants: ["힐링안과"],
    performance: {
      todayResolved: 18,
      avgResponseTime: "25분",
      satisfaction: "4.8",
    },
  },
  {
    id: "6",
    name: "정상담사",
    email: "jung@csflow.kr",
    role: "agent",
    status: "offline",
    avatar: null,
    tenants: ["스마일치과"],
    performance: {
      todayResolved: 0,
      avgResponseTime: "-",
      satisfaction: "-",
    },
  },
];

const allTenants = ["힐링안과", "스마일치과", "서울성형", "강남피부과"];

const roleConfig: Record<
  Role,
  {
    label: string;
    color: string;
    bgColor: string;
    badgeBg: string;
    badgeText: string;
    gradientFrom: string;
    gradientTo: string;
    icon: typeof Shield;
  }
> = {
  admin: {
    label: "관리자",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    badgeBg: "bg-red-500/10",
    badgeText: "text-red-600 dark:text-red-400",
    gradientFrom: "from-red-500/5",
    gradientTo: "to-orange-500/5",
    icon: ShieldCheck,
  },
  manager: {
    label: "매니저",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    badgeBg: "bg-blue-500/10",
    badgeText: "text-blue-600 dark:text-blue-400",
    gradientFrom: "from-blue-500/5",
    gradientTo: "to-cyan-500/5",
    icon: Shield,
  },
  agent: {
    label: "상담사",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    badgeBg: "bg-green-500/10",
    badgeText: "text-green-600 dark:text-green-400",
    gradientFrom: "from-green-500/5",
    gradientTo: "to-emerald-500/5",
    icon: Headphones,
  },
  coordinator: {
    label: "코디",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    badgeBg: "bg-amber-500/10",
    badgeText: "text-amber-600 dark:text-amber-400",
    gradientFrom: "from-amber-500/5",
    gradientTo: "to-yellow-500/5",
    icon: Clipboard,
  },
};

const statusConfig: Record<Status, { label: string; dotColor: string; ringColor: string }> = {
  online: { label: "온라인", dotColor: "bg-emerald-500", ringColor: "ring-emerald-500/30" },
  offline: { label: "오프라인", dotColor: "bg-gray-400", ringColor: "ring-gray-400/30" },
  away: { label: "자리비움", dotColor: "bg-amber-500", ringColor: "ring-amber-500/30" },
};

const rolePermissions = [
  {
    category: "대화 관리",
    permissions: [
      { name: "대화 조회", admin: true, manager: true, agent: true, coordinator: true },
      { name: "대화 응답", admin: true, manager: true, agent: true, coordinator: false },
      { name: "대화 할당 변경", admin: true, manager: true, agent: false, coordinator: false },
      { name: "대화 삭제", admin: true, manager: false, agent: false, coordinator: false },
    ],
  },
  {
    category: "지식베이스",
    permissions: [
      { name: "문서 조회", admin: true, manager: true, agent: true, coordinator: true },
      { name: "문서 생성/편집", admin: true, manager: true, agent: false, coordinator: false },
      { name: "문서 삭제", admin: true, manager: false, agent: false, coordinator: false },
    ],
  },
  {
    category: "팀 관리",
    permissions: [
      { name: "팀원 조회", admin: true, manager: true, agent: false, coordinator: false },
      { name: "팀원 초대/편집", admin: true, manager: false, agent: false, coordinator: false },
      { name: "역할 변경", admin: true, manager: false, agent: false, coordinator: false },
    ],
  },
  {
    category: "설정",
    permissions: [
      { name: "채널 설정", admin: true, manager: true, agent: false, coordinator: false },
      { name: "자동화 규칙", admin: true, manager: true, agent: false, coordinator: false },
      { name: "시스템 설정", admin: true, manager: false, agent: false, coordinator: false },
    ],
  },
];

// --- Summary Stats ---
const summaryStats = {
  totalMembers: mockTeamMembers.length,
  activeMembers: mockTeamMembers.filter((m) => m.status === "online").length,
  todayResolved: mockTeamMembers.reduce((sum, m) => sum + m.performance.todayResolved, 0),
  avgResponseTime: "36분",
};

// --- Framer Motion Variants ---
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
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
  transition: { type: "spring" as const, stiffness: 400, damping: 17 },
};

// --- Helper Components ---
function getRoleBadge(role: Role) {
  const config = roleConfig[role];
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${config.badgeBg} ${config.badgeText}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

function getStatusIndicator(status: Status) {
  const config = statusConfig[status];
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`h-2 w-2 rounded-full ${config.dotColor} ${status === "online" ? "live-dot" : ""}`}
      />
      <span className="text-[11px] text-muted-foreground font-medium">{config.label}</span>
    </div>
  );
}

function PermissionIcon({ allowed }: { allowed: boolean }) {
  if (allowed) {
    return (
      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-500/10">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-muted/50">
      <XCircle className="h-3.5 w-3.5 text-muted-foreground/30" />
    </span>
  );
}

// --- Main Component ---
export default function TeamPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("");
  const [inviteTenants, setInviteTenants] = useState<string[]>([]);

  const filteredMembers = mockTeamMembers.filter((member) => {
    const matchesSearch =
      searchQuery === "" ||
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || member.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleTenantToggle = (tenant: string) => {
    setInviteTenants((prev) =>
      prev.includes(tenant) ? prev.filter((t) => t !== tenant) : [...prev, tenant]
    );
  };

  const handleInvite = () => {
    setInviteOpen(false);
    setInviteName("");
    setInviteEmail("");
    setInviteRole("");
    setInviteTenants([]);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between animate-in-up">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-primary/10">
              <Users className="h-[18px] w-[18px] text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">담당자 관리</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-[46px]">
            팀원 권한 및 할당을 관리합니다
          </p>
        </div>

        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl shadow-sm gap-2">
              <Plus className="h-4 w-4" />
              팀원 초대
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-primary/10">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                팀원 초대
              </DialogTitle>
              <DialogDescription>
                새로운 팀원을 초대하고 역할 및 거래처를 할당합니다.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="invite-name" className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                  이름
                </Label>
                <Input
                  id="invite-name"
                  placeholder="팀원 이름을 입력하세요"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="rounded-xl border-0 bg-muted/50 focus-visible:bg-background"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invite-email" className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                  이메일
                </Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="example@csflow.kr"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="rounded-xl border-0 bg-muted/50 focus-visible:bg-background"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                  역할
                </Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger className="rounded-xl border-0 bg-muted/50">
                    <SelectValue placeholder="역할을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center h-5 w-5 rounded-md bg-red-500/10">
                          <ShieldCheck className="h-3 w-3 text-red-500" />
                        </div>
                        관리자
                      </div>
                    </SelectItem>
                    <SelectItem value="manager">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center h-5 w-5 rounded-md bg-blue-500/10">
                          <Shield className="h-3 w-3 text-blue-500" />
                        </div>
                        매니저
                      </div>
                    </SelectItem>
                    <SelectItem value="agent">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center h-5 w-5 rounded-md bg-green-500/10">
                          <Headphones className="h-3 w-3 text-green-500" />
                        </div>
                        상담사
                      </div>
                    </SelectItem>
                    <SelectItem value="coordinator">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center h-5 w-5 rounded-md bg-amber-500/10">
                          <Clipboard className="h-3 w-3 text-amber-500" />
                        </div>
                        코디
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                  거래처 할당
                </Label>
                <div className="rounded-xl bg-muted/50 p-3 space-y-3">
                  {allTenants.map((tenant) => (
                    <div key={tenant} className="flex items-center gap-2">
                      <Checkbox
                        id={`tenant-${tenant}`}
                        checked={inviteTenants.includes(tenant)}
                        onCheckedChange={() => handleTenantToggle(tenant)}
                      />
                      <Label
                        htmlFor={`tenant-${tenant}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {tenant}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setInviteOpen(false)} className="rounded-xl">
                취소
              </Button>
              <Button
                onClick={handleInvite}
                disabled={!inviteName || !inviteEmail || !inviteRole}
                className="rounded-xl gap-2"
              >
                <Mail className="h-4 w-4" />
                초대 보내기
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Stats Cards */}
      <motion.div
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={itemVariants} whileHover={cardHover}>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-500/5 to-indigo-500/5 hover-lift">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-violet-500/10">
                  <Users className="h-5 w-5 text-violet-500" />
                </div>
                <Badge variant="secondary" className="border-0 bg-violet-500/10 text-violet-600 dark:text-violet-400 text-[11px] font-medium rounded-full px-2">
                  전체
                </Badge>
              </div>
              <div className="space-y-0.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  총 팀원
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold tabular-nums">
                    {summaryStats.totalMembers}
                  </span>
                  <span className="text-sm text-muted-foreground font-medium">명</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants} whileHover={cardHover}>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-500/5 to-green-500/5 hover-lift">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-500/10">
                  <UserCheck className="h-5 w-5 text-emerald-500" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 live-dot" />
                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">활성</span>
                </div>
              </div>
              <div className="space-y-0.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  활성 상태
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {summaryStats.activeMembers}
                  </span>
                  <span className="text-sm text-muted-foreground font-medium">명</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants} whileHover={cardHover}>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-500/5 to-cyan-500/5 hover-lift">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-blue-500/10">
                  <ClipboardCheck className="h-5 w-5 text-blue-500" />
                </div>
                <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span className="text-[11px] font-semibold tabular-nums">+12%</span>
                </div>
              </div>
              <div className="space-y-0.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  오늘 처리 건
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold tabular-nums">
                    {summaryStats.todayResolved}
                  </span>
                  <span className="text-sm text-muted-foreground font-medium">건</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants} whileHover={cardHover}>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-orange-500/5 to-amber-500/5 hover-lift">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-orange-500/10">
                  <Clock className="h-5 w-5 text-orange-500" />
                </div>
                <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <Zap className="h-3.5 w-3.5" />
                  <span className="text-[11px] font-semibold">빠름</span>
                </div>
              </div>
              <div className="space-y-0.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  평균 응답시간
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold tabular-nums">
                    {summaryStats.avgResponseTime}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="이름 또는 이메일로 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 rounded-xl border-0 bg-muted/50 focus-visible:bg-background"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full sm:w-[180px] rounded-xl border-0 bg-muted/50">
                  <SelectValue placeholder="역할 필터" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모든 역할</SelectItem>
                  <SelectItem value="admin">관리자</SelectItem>
                  <SelectItem value="manager">매니저</SelectItem>
                  <SelectItem value="agent">상담사</SelectItem>
                  <SelectItem value="coordinator">코디</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Team Member Grid */}
      <motion.div
        className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {filteredMembers.map((member) => {
          const rCfg = roleConfig[member.role];
          const sCfg = statusConfig[member.status];
          return (
            <motion.div key={member.id} variants={itemVariants} whileHover={cardHover}>
              <Card
                className={`border-0 shadow-sm bg-gradient-to-br ${rCfg.gradientFrom} ${rCfg.gradientTo} hover-lift group relative overflow-hidden`}
              >
                <CardContent className="p-5">
                  {/* Top Row: Avatar + Name + Status */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar className="h-11 w-11 shadow-sm">
                          <AvatarFallback
                            className={`${rCfg.bgColor} ${rCfg.color} font-bold text-sm`}
                          >
                            {member.name.slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card ${sCfg.dotColor} ${member.status === "online" ? "live-dot" : ""}`}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{member.name}</span>
                          {getRoleBadge(member.role)}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {member.email}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Status + Tenants */}
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    {getStatusIndicator(member.status)}
                    <span className="text-muted-foreground/30">|</span>
                    {member.tenants.map((tenant) => (
                      <span
                        key={tenant}
                        className="inline-flex items-center rounded-full bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                      >
                        {tenant}
                      </span>
                    ))}
                  </div>

                  {/* Performance Stats Row */}
                  <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border/50">
                    <div className="text-center">
                      <p className="text-[11px] text-muted-foreground font-medium mb-0.5">
                        오늘 처리
                      </p>
                      <p className="text-base font-bold tabular-nums">
                        {member.performance.todayResolved}
                        <span className="text-[11px] font-medium text-muted-foreground ml-0.5">건</span>
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[11px] text-muted-foreground font-medium mb-0.5">
                        응답시간
                      </p>
                      <p className="text-base font-bold tabular-nums">
                        {member.performance.avgResponseTime}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[11px] text-muted-foreground font-medium mb-0.5">
                        만족도
                      </p>
                      <p className="text-base font-bold tabular-nums flex items-center justify-center gap-0.5">
                        {member.performance.satisfaction !== "-" && (
                          <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                        )}
                        {member.performance.satisfaction}
                      </p>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/50">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 rounded-lg text-xs h-8 bg-muted/50 hover:bg-muted"
                    >
                      권한 편집
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 rounded-lg text-xs h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                    >
                      비활성화
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Empty State */}
      {filteredMembers.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring" as const, stiffness: 300, damping: 25 }}
        >
          <Card className="border-0 shadow-sm">
            <CardContent className="py-16 text-center">
              <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-muted/50 mx-auto mb-4">
                <Users className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="font-semibold text-lg mb-1">검색 결과가 없습니다</h3>
              <p className="text-sm text-muted-foreground">검색 조건을 변경해 보세요.</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Role Permissions Section */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, type: "spring" as const, stiffness: 300, damping: 25 }}
      >
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-primary/10">
                <Shield className="h-[18px] w-[18px] text-primary" />
              </div>
              <div>
                <span className="text-base font-semibold">역할별 권한</span>
                <p className="text-[11px] text-muted-foreground font-normal mt-0.5">
                  각 역할에 부여된 시스템 접근 권한을 확인합니다
                </p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left py-3 px-5 font-medium text-muted-foreground min-w-[200px]">
                      <span className="text-[11px] uppercase tracking-wider">권한 항목</span>
                    </th>
                    <th className="text-center py-3 px-4 font-medium min-w-[90px]">
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-red-500/10">
                          <ShieldCheck className="h-4 w-4 text-red-500" />
                        </div>
                        <span className="text-[11px] font-semibold text-red-600 dark:text-red-400">관리자</span>
                      </div>
                    </th>
                    <th className="text-center py-3 px-4 font-medium min-w-[90px]">
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-blue-500/10">
                          <Shield className="h-4 w-4 text-blue-500" />
                        </div>
                        <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">매니저</span>
                      </div>
                    </th>
                    <th className="text-center py-3 px-4 font-medium min-w-[90px]">
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-green-500/10">
                          <Headphones className="h-4 w-4 text-green-500" />
                        </div>
                        <span className="text-[11px] font-semibold text-green-600 dark:text-green-400">상담사</span>
                      </div>
                    </th>
                    <th className="text-center py-3 px-4 font-medium min-w-[90px]">
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-amber-500/10">
                          <Clipboard className="h-4 w-4 text-amber-500" />
                        </div>
                        <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">코디</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rolePermissions.map((category) => (
                    <>
                      <tr key={`cat-${category.category}`}>
                        <td
                          colSpan={5}
                          className="py-2.5 px-5 bg-muted/20"
                        >
                          <div className="flex items-center gap-2">
                            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">
                              {category.category}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {category.permissions.map((perm) => (
                        <tr
                          key={perm.name}
                          className="border-b border-border/30 hover:bg-muted/20 transition-colors"
                        >
                          <td className="py-2.5 px-5 text-sm font-medium">
                            {perm.name}
                          </td>
                          <td className="text-center py-2.5 px-4">
                            <PermissionIcon allowed={perm.admin} />
                          </td>
                          <td className="text-center py-2.5 px-4">
                            <PermissionIcon allowed={perm.manager} />
                          </td>
                          <td className="text-center py-2.5 px-4">
                            <PermissionIcon allowed={perm.agent} />
                          </td>
                          <td className="text-center py-2.5 px-4">
                            <PermissionIcon allowed={perm.coordinator} />
                          </td>
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
