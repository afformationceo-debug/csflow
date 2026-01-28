"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings,
  Bot,
  Languages,
  Bell,
  Cable,
  Save,
  X,
  Plus,
  CheckCircle2,
  Slack,
  Globe,
  Moon,
  Volume2,
  Mail,
  MonitorSmartphone,
  AlertTriangle,
  CalendarCheck,
  Clock,
  ArrowRight,
  MessageSquare,
  Instagram,
  Facebook,
  Phone,
  Shield,
  Sparkles,
  Zap,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import Link from "next/link";

// ─── Animation Variants ────────────────────────────────────────────
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

// ─── Toast Notification ────────────────────────────────────────────
function Toast({
  message,
  visible,
}: {
  message: string;
  visible: boolean;
}) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.95 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 px-5 py-3.5 text-white shadow-lg shadow-green-500/25"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold">{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Tag Input Component ───────────────────────────────────────────
function TagInput({
  tags,
  onTagsChange,
  placeholder,
  color = "blue",
}: {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder: string;
  color?: "blue" | "orange" | "red" | "purple";
}) {
  const [inputValue, setInputValue] = useState("");

  const colorMap = {
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20",
    orange: "bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20",
    red: "bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20",
    purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20",
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      if (!tags.includes(inputValue.trim())) {
        onTagsChange([...tags, inputValue.trim()]);
      }
      setInputValue("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    onTagsChange(tags.filter((tag) => tag !== tagToRemove));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <AnimatePresence mode="popLayout">
          {tags.map((tag) => (
            <motion.div
              key={tag}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
            >
              <Badge
                variant="secondary"
                className={`flex items-center gap-1.5 rounded-full border-0 px-3 py-1.5 text-xs font-medium transition-colors ${colorMap[color]}`}
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="ml-0.5 rounded-full p-0.5 opacity-60 hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="rounded-xl border-0 bg-muted/50 focus-visible:ring-1 focus-visible:ring-primary/30"
      />
    </div>
  );
}

// ─── Setting Row Component ─────────────────────────────────────────
function SettingRow({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      variants={itemVariants}
      className="group flex items-center justify-between rounded-2xl bg-muted/30 p-4 transition-colors hover:bg-muted/50"
    >
      <div className="flex items-center gap-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}
        >
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-[13px] text-muted-foreground leading-snug">
            {description}
          </p>
        </div>
      </div>
      <div className="shrink-0 ml-4">{children}</div>
    </motion.div>
  );
}

// ─── Section Header ────────────────────────────────────────────────
function SectionHeader({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  description,
}: {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-4 mb-1">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}
      >
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
      <div>
        <h3 className="text-base font-bold">{title}</h3>
        <p className="text-[13px] text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

// ─── Tab Button ────────────────────────────────────────────────────
function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-all duration-200 ${
        active
          ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      }`}
    >
      <Icon className="h-4.5 w-4.5 shrink-0" />
      <span className="flex-1">{label}</span>
      {badge && (
        <Badge
          variant="secondary"
          className={`text-[10px] tabular-nums px-1.5 py-0 rounded-full ${
            active
              ? "bg-white/20 text-white border-0"
              : "bg-muted text-muted-foreground border-0"
          }`}
        >
          {badge}
        </Badge>
      )}
      {active && (
        <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" />
      )}
    </button>
  );
}

// ─── Channel Icon Map ──────────────────────────────────────────────
const channelIconMap: Record<string, React.ElementType> = {
  line: MessageSquare,
  kakao: MessageSquare,
  facebook: Facebook,
  instagram: Instagram,
  whatsapp: Phone,
  wechat: MessageSquare,
};

// ─── Main Component ────────────────────────────────────────────────
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");
  const [showToast, setShowToast] = useState(false);

  // Tenant ID (loaded from API)
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Connected channels (loaded from API)
  const [connectedChannelsSummary, setConnectedChannelsSummary] = useState<
    { type: string; channelType?: string; count: number; color: string; active: boolean }[]
  >([]);

  // General settings
  const [platformName, setPlatformName] = useState("CS Command Center");
  const [defaultLanguage, setDefaultLanguage] = useState("ko");
  const [timezone, setTimezone] = useState("Asia/Seoul");
  const [darkMode, setDarkMode] = useState(true);
  const [emailNotification, setEmailNotification] = useState(true);
  const [browserNotification, setBrowserNotification] = useState(true);
  const [soundNotification, setSoundNotification] = useState(false);

  // AI settings
  const [aiModel, setAiModel] = useState("gpt-4");
  const [confidenceThreshold, setConfidenceThreshold] = useState(75);
  const [maxResponseLength, setMaxResponseLength] = useState("500");
  const [autoResponseEnabled, setAutoResponseEnabled] = useState(true);
  const [systemPrompt, setSystemPrompt] = useState(
    "당신은 해외환자유치 CS 전문 상담사입니다. 고객의 문의에 친절하고 정확하게 답변해 주세요. 의료 관련 질문은 전문 상담사에게 연결하고, 가격/예약 관련 문의는 지식베이스를 참고하여 답변합니다."
  );
  const [escalationKeywords, setEscalationKeywords] = useState([
    "불만",
    "환불",
    "소송",
    "위험",
    "부작용",
    "사고",
  ]);
  const [forbiddenTopics, setForbiddenTopics] = useState([
    "정치",
    "종교",
    "경쟁사 비방",
    "보험 사기",
  ]);

  // Translation settings
  const [deeplConnected, setDeeplConnected] = useState(false);
  const [autoTranslation, setAutoTranslation] = useState(true);
  const [defaultTranslationDirection, setDefaultTranslationDirection] = useState("ko-en");
  const [supportedLanguages, setSupportedLanguages] = useState([
    { code: "ko", name: "한국어", enabled: true },
    { code: "en", name: "English", enabled: true },
    { code: "ja", name: "日本語", enabled: true },
    { code: "zh", name: "中文", enabled: true },
    { code: "vi", name: "Tiếng Việt", enabled: true },
    { code: "th", name: "ภาษาไทย", enabled: false },
    { code: "ru", name: "Русский", enabled: false },
  ]);

  // Notification channel settings
  const [slackConnected, setSlackConnected] = useState(false);
  const [slackToken, setSlackToken] = useState("");
  const [slackDefaultChannel, setSlackDefaultChannel] = useState("#cs-alerts");
  const [escalationAlert, setEscalationAlert] = useState(true);
  const [bookingConfirmAlert, setBookingConfirmAlert] = useState(true);
  const [noResponseAlert, setNoResponseAlert] = useState(true);
  const [noResponseThreshold, setNoResponseThreshold] = useState("24");

  // ─── Load Settings from API ──────────────────────────────────────
  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();

      if (data.settings) {
        const s = data.settings;
        if (s.tenantId) setTenantId(s.tenantId);
        if (s.platformName) setPlatformName(s.platformName);
        if (s.defaultLanguage) setDefaultLanguage(s.defaultLanguage);
        if (s.timezone) setTimezone(s.timezone);
        if (s.darkMode !== undefined) setDarkMode(s.darkMode);
        if (s.emailNotification !== undefined) setEmailNotification(s.emailNotification);
        if (s.browserNotification !== undefined) setBrowserNotification(s.browserNotification);
        if (s.soundNotification !== undefined) setSoundNotification(s.soundNotification);

        // AI settings
        if (s.ai) {
          if (s.ai.model) setAiModel(s.ai.model);
          if (s.ai.confidenceThreshold !== undefined) setConfidenceThreshold(s.ai.confidenceThreshold);
          if (s.ai.maxResponseLength !== undefined) setMaxResponseLength(String(s.ai.maxResponseLength));
          if (s.ai.autoResponseEnabled !== undefined) setAutoResponseEnabled(s.ai.autoResponseEnabled);
          if (s.ai.systemPrompt) setSystemPrompt(s.ai.systemPrompt);
          if (s.ai.escalationKeywords) setEscalationKeywords(s.ai.escalationKeywords);
          if (s.ai.forbiddenTopics) setForbiddenTopics(s.ai.forbiddenTopics);
        }

        // Translation settings
        if (s.translation) {
          if (s.translation.deeplConnected !== undefined) setDeeplConnected(s.translation.deeplConnected);
          if (s.translation.autoTranslation !== undefined) setAutoTranslation(s.translation.autoTranslation);
          if (s.translation.defaultDirection) setDefaultTranslationDirection(s.translation.defaultDirection);
          if (s.translation.supportedLanguages) setSupportedLanguages(s.translation.supportedLanguages);
        }

        // Notification settings
        if (s.notifications) {
          if (s.notifications.slackConnected !== undefined) setSlackConnected(s.notifications.slackConnected);
          if (s.notifications.slackToken) setSlackToken(s.notifications.slackToken);
          if (s.notifications.slackDefaultChannel) setSlackDefaultChannel(s.notifications.slackDefaultChannel);
          if (s.notifications.escalationAlert !== undefined) setEscalationAlert(s.notifications.escalationAlert);
          if (s.notifications.bookingConfirmAlert !== undefined) setBookingConfirmAlert(s.notifications.bookingConfirmAlert);
          if (s.notifications.noResponseAlert !== undefined) setNoResponseAlert(s.notifications.noResponseAlert);
          if (s.notifications.noResponseThreshold !== undefined) setNoResponseThreshold(String(s.notifications.noResponseThreshold));
        }
      }

      if (data.channels) {
        setConnectedChannelsSummary(data.channels);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // ─── Save Handler ─────────────────────────────────────────────────
  const handleSave = async () => {
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          platformName,
          defaultLanguage,
          timezone,
          darkMode,
          emailNotification,
          browserNotification,
          soundNotification,
          ai: {
            model: aiModel,
            confidenceThreshold,
            maxResponseLength: parseInt(maxResponseLength),
            autoResponseEnabled,
            systemPrompt,
            escalationKeywords,
            forbiddenTopics,
          },
          translation: {
            autoTranslation,
            defaultDirection: defaultTranslationDirection,
            supportedLanguages,
          },
          notifications: {
            slackDefaultChannel,
            escalationAlert,
            bookingConfirmAlert,
            noResponseAlert,
            noResponseThreshold: parseInt(noResponseThreshold),
          },
        }),
      });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  };

  // Language toggle handler
  const toggleLanguage = (code: string) => {
    setSupportedLanguages((prev) =>
      prev.map((lang) =>
        lang.code === code ? { ...lang, enabled: !lang.enabled } : lang
      )
    );
  };

  const tabs = [
    { id: "general", label: "일반 설정", icon: Globe },
    { id: "ai", label: "AI 설정", icon: Bot, badge: "GPT-4" },
    { id: "translation", label: "번역 설정", icon: Languages, badge: `${supportedLanguages.filter(l => l.enabled).length}` },
    { id: "notifications", label: "알림 채널", icon: Bell },
    { id: "channels", label: "채널 관리", icon: Cable, badge: `${connectedChannelsSummary.reduce((a, c) => a + c.count, 0)}` },
  ];

  // ─── Render Tab Content ────────────────────────────────────────
  const renderContent = () => {
    switch (activeTab) {
      // ─── General Tab ───────────────────────────────────────────
      case "general":
        return (
          <motion.div
            key="general"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8"
          >
            {/* Platform Info */}
            <motion.div variants={itemVariants}>
              <Card className="border-0 shadow-sm overflow-hidden rounded-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.03] to-purple-500/[0.03] pointer-events-none" />
                <CardHeader className="pb-2 relative">
                  <SectionHeader
                    icon={Globe}
                    iconColor="text-blue-500"
                    iconBg="bg-blue-500/10"
                    title="플랫폼 정보"
                    description="플랫폼의 기본 정보를 설정합니다"
                  />
                </CardHeader>
                <CardContent className="relative space-y-5 pt-4">
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2.5">
                      <Label htmlFor="platformName" className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                        플랫폼 이름
                      </Label>
                      <Input
                        id="platformName"
                        value={platformName}
                        onChange={(e) => setPlatformName(e.target.value)}
                        className="rounded-xl border-0 bg-muted/50 h-11 focus-visible:ring-1 focus-visible:ring-primary/30"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <Label htmlFor="defaultLanguage" className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                        기본 언어
                      </Label>
                      <Select
                        value={defaultLanguage}
                        onValueChange={setDefaultLanguage}
                      >
                        <SelectTrigger className="w-full rounded-xl border-0 bg-muted/50 h-11">
                          <SelectValue placeholder="언어 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ko">한국어</SelectItem>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="ja">日本語</SelectItem>
                          <SelectItem value="zh">中文</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2.5">
                      <Label htmlFor="timezone" className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                        타임존
                      </Label>
                      <Select value={timezone} onValueChange={setTimezone}>
                        <SelectTrigger className="w-full rounded-xl border-0 bg-muted/50 h-11">
                          <SelectValue placeholder="타임존 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Asia/Seoul">Asia/Seoul (KST, UTC+9)</SelectItem>
                          <SelectItem value="Asia/Tokyo">Asia/Tokyo (JST, UTC+9)</SelectItem>
                          <SelectItem value="Asia/Shanghai">Asia/Shanghai (CST, UTC+8)</SelectItem>
                          <SelectItem value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh (ICT, UTC+7)</SelectItem>
                          <SelectItem value="Asia/Bangkok">Asia/Bangkok (ICT, UTC+7)</SelectItem>
                          <SelectItem value="America/New_York">America/New_York (EST, UTC-5)</SelectItem>
                          <SelectItem value="America/Los_Angeles">America/Los_Angeles (PST, UTC-8)</SelectItem>
                          <SelectItem value="Europe/London">Europe/London (GMT, UTC+0)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2.5">
                      <Label className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1.5">
                        <Moon className="h-3.5 w-3.5" />
                        다크 모드
                      </Label>
                      <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 h-11">
                        <Switch
                          checked={darkMode}
                          onCheckedChange={setDarkMode}
                        />
                        <span className="text-sm text-muted-foreground">
                          {darkMode ? "활성화됨" : "비활성화됨"}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Notification Settings */}
            <motion.div variants={itemVariants}>
              <Card className="border-0 shadow-sm overflow-hidden rounded-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/[0.03] to-pink-500/[0.03] pointer-events-none" />
                <CardHeader className="pb-2 relative">
                  <SectionHeader
                    icon={Bell}
                    iconColor="text-orange-500"
                    iconBg="bg-orange-500/10"
                    title="알림 설정"
                    description="알림 수신 방법을 설정합니다"
                  />
                </CardHeader>
                <CardContent className="relative space-y-3 pt-4">
                  <SettingRow
                    icon={Mail}
                    iconColor="text-blue-500"
                    iconBg="bg-blue-500/10"
                    title="이메일 알림"
                    description="중요 알림을 이메일로 수신합니다"
                  >
                    <Switch
                      checked={emailNotification}
                      onCheckedChange={setEmailNotification}
                    />
                  </SettingRow>
                  <SettingRow
                    icon={MonitorSmartphone}
                    iconColor="text-purple-500"
                    iconBg="bg-purple-500/10"
                    title="브라우저 알림"
                    description="브라우저 푸시 알림을 수신합니다"
                  >
                    <Switch
                      checked={browserNotification}
                      onCheckedChange={setBrowserNotification}
                    />
                  </SettingRow>
                  <SettingRow
                    icon={Volume2}
                    iconColor="text-orange-500"
                    iconBg="bg-orange-500/10"
                    title="소리 알림"
                    description="새 메시지 수신 시 알림 소리를 재생합니다"
                  >
                    <Switch
                      checked={soundNotification}
                      onCheckedChange={setSoundNotification}
                    />
                  </SettingRow>
                </CardContent>
              </Card>
            </motion.div>

            {/* Save Button */}
            <motion.div variants={itemVariants} className="flex justify-end">
              <Button
                onClick={handleSave}
                className="rounded-xl px-6 h-11 gap-2 bg-gradient-to-r from-primary to-primary/80 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-shadow"
              >
                <Save className="h-4 w-4" />
                변경사항 저장
              </Button>
            </motion.div>
          </motion.div>
        );

      // ─── AI Tab ────────────────────────────────────────────────
      case "ai":
        return (
          <motion.div
            key="ai"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8"
          >
            {/* AI Model Configuration */}
            <motion.div variants={itemVariants}>
              <Card className="border-0 shadow-sm overflow-hidden rounded-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/[0.03] to-blue-500/[0.03] pointer-events-none" />
                <CardHeader className="pb-2 relative">
                  <SectionHeader
                    icon={Bot}
                    iconColor="text-violet-500"
                    iconBg="bg-violet-500/10"
                    title="AI 모델 설정"
                    description="자동 응대에 사용할 AI 모델을 설정합니다"
                  />
                </CardHeader>
                <CardContent className="relative space-y-6 pt-4">
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2.5">
                      <Label htmlFor="aiModel" className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                        기본 AI 모델
                      </Label>
                      <Select value={aiModel} onValueChange={setAiModel}>
                        <SelectTrigger className="w-full rounded-xl border-0 bg-muted/50 h-11">
                          <SelectValue placeholder="모델 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gpt-4">GPT-4</SelectItem>
                          <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                          <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                          <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2.5">
                      <Label htmlFor="maxResponseLength" className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                        최대 응답 길이 (토큰)
                      </Label>
                      <Input
                        id="maxResponseLength"
                        type="number"
                        value={maxResponseLength}
                        onChange={(e) => setMaxResponseLength(e.target.value)}
                        min="100"
                        max="4000"
                        className="rounded-xl border-0 bg-muted/50 h-11 tabular-nums focus-visible:ring-1 focus-visible:ring-primary/30"
                      />
                    </div>
                  </div>

                  {/* Confidence Threshold */}
                  <div className="rounded-2xl bg-muted/30 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-amber-500" />
                        <Label className="text-sm font-semibold">신뢰도 임계값</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-8 rounded-lg bg-gradient-to-r from-violet-500/10 to-blue-500/10 px-3 flex items-center">
                          <span className="text-sm font-bold tabular-nums text-primary">
                            {confidenceThreshold}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={confidenceThreshold}
                        onChange={(e) =>
                          setConfidenceThreshold(Number(e.target.value))
                        }
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-muted accent-primary progress-shine"
                      />
                      <div className="flex justify-between text-[11px] text-muted-foreground mt-2 tabular-nums">
                        <span>0%</span>
                        <span>25%</span>
                        <span>50%</span>
                        <span>75%</span>
                        <span>100%</span>
                      </div>
                    </div>
                    <p className="text-[12px] text-muted-foreground leading-relaxed">
                      AI 응답의 신뢰도가 이 값 이하일 경우 자동 응답 대신 상담사에게 전달됩니다
                    </p>
                  </div>

                  {/* Auto Response Toggle */}
                  <SettingRow
                    icon={Zap}
                    iconColor="text-emerald-500"
                    iconBg="bg-emerald-500/10"
                    title="자동 응대 활성화"
                    description="AI가 고객 문의에 자동으로 응답합니다"
                  >
                    <Switch
                      checked={autoResponseEnabled}
                      onCheckedChange={setAutoResponseEnabled}
                    />
                  </SettingRow>
                </CardContent>
              </Card>
            </motion.div>

            {/* System Prompt */}
            <motion.div variants={itemVariants}>
              <Card className="border-0 shadow-sm overflow-hidden rounded-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.03] to-cyan-500/[0.03] pointer-events-none" />
                <CardHeader className="pb-2 relative">
                  <SectionHeader
                    icon={MessageSquare}
                    iconColor="text-blue-500"
                    iconBg="bg-blue-500/10"
                    title="기본 시스템 프롬프트"
                    description="AI 모델에 전달되는 기본 지시사항을 설정합니다"
                  />
                </CardHeader>
                <CardContent className="relative pt-4">
                  <Textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={6}
                    className="resize-none rounded-xl border-0 bg-muted/50 focus-visible:ring-1 focus-visible:ring-primary/30 leading-relaxed"
                    placeholder="시스템 프롬프트를 입력하세요..."
                  />
                  <p className="mt-3 text-[12px] text-muted-foreground">
                    거래처별로 별도의 프롬프트를 설정할 수도 있습니다
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Keywords & Topics */}
            <motion.div variants={itemVariants}>
              <div className="grid gap-6 md:grid-cols-2">
                <Card className="border-0 shadow-sm overflow-hidden rounded-2xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/[0.03] to-amber-500/[0.03] pointer-events-none" />
                  <CardHeader className="pb-2 relative">
                    <SectionHeader
                      icon={AlertTriangle}
                      iconColor="text-orange-500"
                      iconBg="bg-orange-500/10"
                      title="에스컬레이션 키워드"
                      description="감지 시 즉시 상담사에게 전달됩니다"
                    />
                  </CardHeader>
                  <CardContent className="relative pt-4">
                    <TagInput
                      tags={escalationKeywords}
                      onTagsChange={setEscalationKeywords}
                      placeholder="키워드 입력 후 Enter"
                      color="orange"
                    />
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm overflow-hidden rounded-2xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-red-500/[0.03] to-rose-500/[0.03] pointer-events-none" />
                  <CardHeader className="pb-2 relative">
                    <SectionHeader
                      icon={Shield}
                      iconColor="text-red-500"
                      iconBg="bg-red-500/10"
                      title="금지 주제"
                      description="AI가 이 주제에 대해 답변하지 않습니다"
                    />
                  </CardHeader>
                  <CardContent className="relative pt-4">
                    <TagInput
                      tags={forbiddenTopics}
                      onTagsChange={setForbiddenTopics}
                      placeholder="주제 입력 후 Enter"
                      color="red"
                    />
                  </CardContent>
                </Card>
              </div>
            </motion.div>

            {/* Save Button */}
            <motion.div variants={itemVariants} className="flex justify-end">
              <Button
                onClick={handleSave}
                className="rounded-xl px-6 h-11 gap-2 bg-gradient-to-r from-primary to-primary/80 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-shadow"
              >
                <Save className="h-4 w-4" />
                변경사항 저장
              </Button>
            </motion.div>
          </motion.div>
        );

      // ─── Translation Tab ───────────────────────────────────────
      case "translation":
        return (
          <motion.div
            key="translation"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8"
          >
            {/* DeepL Connection */}
            <motion.div variants={itemVariants}>
              <Card className="border-0 shadow-sm overflow-hidden rounded-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.03] to-indigo-500/[0.03] pointer-events-none" />
                <CardHeader className="pb-2 relative">
                  <SectionHeader
                    icon={Languages}
                    iconColor="text-blue-500"
                    iconBg="bg-blue-500/10"
                    title="번역 API 연결"
                    description="번역 서비스 연결 상태를 확인합니다"
                  />
                </CardHeader>
                <CardContent className="relative space-y-3 pt-4">
                  <div className="flex items-center justify-between rounded-2xl bg-muted/30 p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600/10">
                        <span className="text-sm font-extrabold text-blue-600 dark:text-blue-400">DL</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold">DeepL API</p>
                        <p className="text-[13px] text-muted-foreground">
                          고품질 자동 번역 서비스
                        </p>
                      </div>
                    </div>
                    {deeplConnected ? (
                      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0 rounded-full px-3 py-1.5 gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 live-dot" />
                        연결됨
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="rounded-full">미연결</Badge>
                    )}
                  </div>

                  <SettingRow
                    icon={Zap}
                    iconColor="text-emerald-500"
                    iconBg="bg-emerald-500/10"
                    title="자동 번역 활성화"
                    description="고객 메시지를 자동으로 번역합니다"
                  >
                    <Switch
                      checked={autoTranslation}
                      onCheckedChange={setAutoTranslation}
                    />
                  </SettingRow>
                </CardContent>
              </Card>
            </motion.div>

            {/* Translation Direction */}
            <motion.div variants={itemVariants}>
              <Card className="border-0 shadow-sm overflow-hidden rounded-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/[0.03] to-teal-500/[0.03] pointer-events-none" />
                <CardHeader className="pb-2 relative">
                  <SectionHeader
                    icon={ArrowRight}
                    iconColor="text-cyan-500"
                    iconBg="bg-cyan-500/10"
                    title="기본 번역 방향"
                    description="자동 감지 실패 시 이 설정이 적용됩니다"
                  />
                </CardHeader>
                <CardContent className="relative pt-4">
                  <Select
                    value={defaultTranslationDirection}
                    onValueChange={setDefaultTranslationDirection}
                  >
                    <SelectTrigger className="w-full max-w-sm rounded-xl border-0 bg-muted/50 h-11">
                      <SelectValue placeholder="번역 방향 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ko-en">한국어 → English</SelectItem>
                      <SelectItem value="ko-ja">한국어 → 日本語</SelectItem>
                      <SelectItem value="ko-zh">한국어 → 中文</SelectItem>
                      <SelectItem value="ko-vi">한국어 → Tiếng Việt</SelectItem>
                      <SelectItem value="en-ko">English → 한국어</SelectItem>
                      <SelectItem value="ja-ko">日本語 → 한국어</SelectItem>
                      <SelectItem value="zh-ko">中文 → 한국어</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            </motion.div>

            {/* Supported Languages */}
            <motion.div variants={itemVariants}>
              <Card className="border-0 shadow-sm overflow-hidden rounded-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.03] to-green-500/[0.03] pointer-events-none" />
                <CardHeader className="pb-2 relative">
                  <SectionHeader
                    icon={Globe}
                    iconColor="text-emerald-500"
                    iconBg="bg-emerald-500/10"
                    title="지원 언어 목록"
                    description="활성화된 언어에 대해 자동 번역이 제공됩니다"
                  />
                </CardHeader>
                <CardContent className="relative pt-4">
                  <div className="space-y-2.5 stagger-children">
                    {supportedLanguages.map((lang) => (
                      <div
                        key={lang.code}
                        className="group flex items-center justify-between rounded-2xl bg-muted/30 p-4 transition-colors hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-primary/5">
                            <span className="text-[11px] font-extrabold uppercase text-primary tabular-nums">
                              {lang.code}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{lang.name}</p>
                            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
                              {lang.code.toUpperCase()}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={lang.enabled}
                          onCheckedChange={() => toggleLanguage(lang.code)}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Save Button */}
            <motion.div variants={itemVariants} className="flex justify-end">
              <Button
                onClick={handleSave}
                className="rounded-xl px-6 h-11 gap-2 bg-gradient-to-r from-primary to-primary/80 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-shadow"
              >
                <Save className="h-4 w-4" />
                변경사항 저장
              </Button>
            </motion.div>
          </motion.div>
        );

      // ─── Notifications Tab ─────────────────────────────────────
      case "notifications":
        return (
          <motion.div
            key="notifications"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8"
          >
            {/* Slack Connection */}
            <motion.div variants={itemVariants}>
              <Card className="border-0 shadow-sm overflow-hidden rounded-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-[#4A154B]/[0.03] to-[#E01E5A]/[0.03] pointer-events-none" />
                <CardHeader className="pb-2 relative">
                  <SectionHeader
                    icon={Slack}
                    iconColor="text-[#4A154B] dark:text-[#E01E5A]"
                    iconBg="bg-[#4A154B]/10"
                    title="Slack 연동"
                    description="Slack 워크스페이스와 연결하여 알림을 수신합니다"
                  />
                </CardHeader>
                <CardContent className="relative space-y-5 pt-4">
                  <div className="flex items-center justify-between rounded-2xl bg-muted/30 p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#4A154B]/10">
                        <Slack className="h-5 w-5 text-[#4A154B] dark:text-[#E01E5A]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Slack 연결 상태</p>
                        <p className="text-[11px] text-muted-foreground font-mono tabular-nums">
                          {slackToken}
                        </p>
                      </div>
                    </div>
                    {slackConnected ? (
                      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0 rounded-full px-3 py-1.5 gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 live-dot" />
                        연결됨
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="rounded-full">미연결</Badge>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    <Label htmlFor="slackChannel" className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Slack 기본 채널
                    </Label>
                    <Input
                      id="slackChannel"
                      value={slackDefaultChannel}
                      onChange={(e) => setSlackDefaultChannel(e.target.value)}
                      placeholder="#channel-name"
                      className="rounded-xl border-0 bg-muted/50 h-11 font-mono focus-visible:ring-1 focus-visible:ring-primary/30"
                    />
                    <p className="text-[12px] text-muted-foreground">
                      알림이 전송될 기본 Slack 채널을 설정합니다
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Alert Settings */}
            <motion.div variants={itemVariants}>
              <Card className="border-0 shadow-sm overflow-hidden rounded-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-red-500/[0.03] to-orange-500/[0.03] pointer-events-none" />
                <CardHeader className="pb-2 relative">
                  <SectionHeader
                    icon={Bell}
                    iconColor="text-red-500"
                    iconBg="bg-red-500/10"
                    title="알림 유형 설정"
                    description="Slack으로 수신할 알림 유형을 선택합니다"
                  />
                </CardHeader>
                <CardContent className="relative space-y-3 pt-4">
                  <SettingRow
                    icon={AlertTriangle}
                    iconColor="text-red-500"
                    iconBg="bg-red-500/10"
                    title="에스컬레이션 알림"
                    description="고객 문의가 상담사에게 에스컬레이션될 때 알림"
                  >
                    <Switch
                      checked={escalationAlert}
                      onCheckedChange={setEscalationAlert}
                    />
                  </SettingRow>

                  <SettingRow
                    icon={CalendarCheck}
                    iconColor="text-emerald-500"
                    iconBg="bg-emerald-500/10"
                    title="예약 확정 알림"
                    description="새로운 예약이 확정될 때 알림"
                  >
                    <Switch
                      checked={bookingConfirmAlert}
                      onCheckedChange={setBookingConfirmAlert}
                    />
                  </SettingRow>

                  <SettingRow
                    icon={Clock}
                    iconColor="text-amber-500"
                    iconBg="bg-amber-500/10"
                    title="무응답 경고"
                    description="고객 문의에 일정 시간 이상 응답이 없을 때 경고"
                  >
                    <Switch
                      checked={noResponseAlert}
                      onCheckedChange={setNoResponseAlert}
                    />
                  </SettingRow>

                  <AnimatePresence>
                    {noResponseAlert && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                        animate={{ opacity: 1, height: "auto", marginTop: 8 }}
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
                        className="overflow-hidden"
                      >
                        <div className="ml-[60px] rounded-xl bg-amber-500/5 p-4 space-y-3">
                          <Label htmlFor="noResponseThreshold" className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                            무응답 기준 시간
                          </Label>
                          <div className="flex items-center gap-3">
                            <Input
                              id="noResponseThreshold"
                              type="number"
                              value={noResponseThreshold}
                              onChange={(e) =>
                                setNoResponseThreshold(e.target.value)
                              }
                              min="1"
                              max="72"
                              className="w-24 rounded-xl border-0 bg-muted/50 h-10 tabular-nums focus-visible:ring-1 focus-visible:ring-primary/30"
                            />
                            <span className="text-sm text-muted-foreground font-medium">
                              시간
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>

            {/* Save Button */}
            <motion.div variants={itemVariants} className="flex justify-end">
              <Button
                onClick={handleSave}
                className="rounded-xl px-6 h-11 gap-2 bg-gradient-to-r from-primary to-primary/80 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-shadow"
              >
                <Save className="h-4 w-4" />
                변경사항 저장
              </Button>
            </motion.div>
          </motion.div>
        );

      // ─── Channels Tab ──────────────────────────────────────────
      case "channels":
        return (
          <motion.div
            key="channels"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8"
          >
            {/* Navigation Card */}
            <motion.div variants={itemVariants}>
              <Card className="border-0 shadow-sm overflow-hidden rounded-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] to-violet-500/[0.04] pointer-events-none" />
                <CardContent className="relative p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-violet-500/20">
                        <Cable className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold">채널 관리</h3>
                        <p className="text-[13px] text-muted-foreground">
                          메신저 채널을 연결하고 관리합니다
                        </p>
                      </div>
                    </div>
                    <Link href="/settings/channels">
                      <Button className="rounded-xl h-11 gap-2 bg-gradient-to-r from-primary to-primary/80 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-shadow">
                        채널 관리 페이지로 이동
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Connected Channels Summary */}
            <motion.div variants={itemVariants}>
              <Card className="border-0 shadow-sm overflow-hidden rounded-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.03] to-cyan-500/[0.03] pointer-events-none" />
                <CardHeader className="pb-2 relative">
                  <div className="flex items-center justify-between">
                    <SectionHeader
                      icon={CheckCircle2}
                      iconColor="text-emerald-500"
                      iconBg="bg-emerald-500/10"
                      title="연결된 채널 현황"
                      description="현재 연결된 메신저 채널 요약입니다"
                    />
                    <Badge variant="secondary" className="border-0 rounded-full px-3 py-1.5 bg-primary/10 text-primary font-bold tabular-nums">
                      {connectedChannelsSummary.reduce(
                        (acc, ch) => acc + ch.count,
                        0
                      )}
                      개
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="relative pt-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {connectedChannelsSummary.map((channel, index) => {
                      const Icon = channelIconMap[channel.channelType || channel.type.toLowerCase()] || MessageSquare;
                      return (
                        <motion.div
                          key={channel.type}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{
                            delay: index * 0.05,
                            duration: 0.3,
                            ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
                          }}
                          className="card-3d flex items-center gap-3.5 rounded-2xl bg-muted/30 p-4 transition-colors hover:bg-muted/50"
                        >
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${channel.color}`}
                          >
                            <Icon className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm truncate">
                                {channel.type}
                              </p>
                              {channel.active ? (
                                <Badge
                                  className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0 rounded-full text-[10px] px-1.5 py-0 shrink-0 gap-1"
                                >
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 live-dot" />
                                  활성
                                </Badge>
                              ) : (
                                <Badge
                                  variant="secondary"
                                  className="border-0 rounded-full text-[10px] px-1.5 py-0 shrink-0"
                                >
                                  비활성
                                </Badge>
                              )}
                            </div>
                            <p className="text-[13px] text-muted-foreground tabular-nums">
                              {channel.count}개 계정
                            </p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Quick Actions */}
            <motion.div variants={itemVariants}>
              <Card className="border-0 shadow-sm overflow-hidden rounded-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.02] to-orange-500/[0.02] pointer-events-none" />
                <CardHeader className="pb-2 relative">
                  <SectionHeader
                    icon={Zap}
                    iconColor="text-amber-500"
                    iconBg="bg-amber-500/10"
                    title="빠른 작업"
                    description="채널과 관련된 빠른 작업을 수행합니다"
                  />
                </CardHeader>
                <CardContent className="relative flex flex-wrap gap-3 pt-4">
                  <Link href="/settings/channels/connect">
                    <Button
                      variant="outline"
                      className="rounded-xl h-11 gap-2 border-0 bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      새 채널 연결
                    </Button>
                  </Link>
                  <Link href="/settings/channels">
                    <Button
                      variant="outline"
                      className="rounded-xl h-11 gap-2 border-0 bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <Settings className="h-4 w-4" />
                      채널 설정
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-8 animate-in-up">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
      >
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-500 to-zinc-500">
            <Settings className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">설정</h1>
            <p className="text-sm text-muted-foreground">
              시스템 설정을 맞춤 구성하세요
            </p>
          </div>
        </div>
      </motion.div>

      {/* Layout: Sidebar Tabs + Content */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Tabs */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
          className="lg:w-[240px] shrink-0"
        >
          <div className="lg:sticky lg:top-6">
            <Card className="border-0 shadow-sm overflow-hidden rounded-2xl">
              <div className="absolute inset-0 bg-gradient-to-b from-muted/30 to-transparent pointer-events-none" />
              <CardContent className="relative p-2.5">
                <nav className="space-y-1 stagger-children">
                  {tabs.map((tab) => (
                    <TabButton
                      key={tab.id}
                      active={activeTab === tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      icon={tab.icon}
                      label={tab.label}
                      badge={tab.badge}
                    />
                  ))}
                </nav>
              </CardContent>
            </Card>

            {/* Decorative Info Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="mt-4"
            >
              <Card className="border-0 shadow-sm overflow-hidden rounded-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] to-violet-500/[0.04] pointer-events-none" />
                <CardContent className="relative p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Pro Tip
                    </p>
                  </div>
                  <p className="text-[12px] leading-relaxed text-muted-foreground">
                    AI 신뢰도 임계값을 적절히 설정하면 자동 응대 품질과 상담사 업무량을 최적화할 수 있습니다.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </motion.div>

        {/* Tab Content */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.15, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
          className="flex-1 min-w-0"
        >
          <AnimatePresence mode="wait">
            {renderContent()}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Toast Notification */}
      <Toast message="설정이 저장되었습니다" visible={showToast} />
    </div>
  );
}
