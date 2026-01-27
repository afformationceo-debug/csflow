"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
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
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Plus,
  FileText,
  MoreVertical,
  Edit,
  Trash2,
  Upload,
  Brain,
  Tag,
  RefreshCw,
  AlertCircle,
  Check,
  Clock,
  LayoutGrid,
  List,
  Database,
  Activity,
  Filter,
  ChevronDown,
  Layers,
  Building2,
  CircleDot,
  Sparkles,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  useKnowledgeDocuments,
  useKnowledgeCategories,
  useKnowledgeStatistics,
  useCreateKnowledgeDocument,
  useUpdateKnowledgeDocument,
  useDeleteKnowledgeDocument,
  useRegenerateEmbeddings,
  type KnowledgeDocumentItem,
} from "@/hooks";

// TODO: Get from auth context
const TENANT_ID = "demo-tenant";

const defaultCategories = ["FAQ", "시술정보", "가격정보", "안내사항", "예약"];

const tenantOptions = [
  { id: "healing-eye", name: "힐링안과" },
  { id: "smile-dental", name: "스마일치과" },
  { id: "beauty-clinic", name: "뷰티클리닉" },
  { id: "seoul-ortho", name: "서울정형외과" },
];

const categoryColorMap: Record<string, { bg: string; text: string; dot: string }> = {
  FAQ: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", dot: "bg-blue-500" },
  시술정보: { bg: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400", dot: "bg-violet-500" },
  가격정보: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  안내사항: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  예약: { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", dot: "bg-rose-500" },
  가격: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  주의사항: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", dot: "bg-orange-500" },
};

const defaultCategoryColor = { bg: "bg-gray-500/10", text: "text-gray-600 dark:text-gray-400", dot: "bg-gray-500" };

type EmbeddingStatus = "embedded" | "pending" | "failed";

type ViewMode = "grid" | "list";

// Mock data for when API returns no results
const mockDocuments: (KnowledgeDocumentItem & { tenant_name?: string; embedding_status?: EmbeddingStatus })[] = [
  {
    id: "mock-1",
    title: "라식/라섹 수술 FAQ",
    content: "Q: 라식과 라섹의 차이점은 무엇인가요?\nA: 라식은 각막 절편을 만들어 레이저로 교정하는 방법이고, 라섹은 각막 상피를 제거한 후 레이저로 교정합니다. 라식은 회복이 빠르고, 라섹은 각막이 얇은 경우에 적합합니다.\n\nQ: 수술 후 회복 기간은?\nA: 라식은 1-2일, 라섹은 3-5일 정도 소요됩니다.",
    category: "FAQ",
    tags: ["라식", "라섹", "시력교정"],
    source_type: "manual",
    source_id: null,
    is_active: true,
    version: 3,
    created_at: "2026-01-15T09:00:00Z",
    updated_at: "2026-01-26T14:30:00Z",
    created_by: null,
    chunk_count: 8,
    tenant_name: "힐링안과",
    embedding_status: "embedded",
  },
  {
    id: "mock-2",
    title: "임플란트 시술 안내",
    content: "임플란트는 상실된 치아를 대체하기 위해 인공 치아근을 턱뼈에 심는 시술입니다. 시술 기간은 약 3-6개월이 소요되며, 뼈 이식이 필요한 경우 추가 기간이 필요합니다.",
    category: "시술정보",
    tags: ["임플란트", "치아"],
    source_type: "manual",
    source_id: null,
    is_active: true,
    version: 2,
    created_at: "2026-01-10T10:00:00Z",
    updated_at: "2026-01-25T11:20:00Z",
    created_by: null,
    chunk_count: 5,
    tenant_name: "스마일치과",
    embedding_status: "embedded",
  },
  {
    id: "mock-3",
    title: "보톡스/필러 가격표 (2026년)",
    content: "보톡스 (이마): 150,000원\n보톡스 (눈가): 100,000원\n필러 (코): 300,000원\n필러 (턱): 350,000원\n패키지 (보톡스+필러): 400,000원부터",
    category: "가격정보",
    tags: ["보톡스", "필러", "가격"],
    source_type: "manual",
    source_id: null,
    is_active: true,
    version: 5,
    created_at: "2026-01-05T08:00:00Z",
    updated_at: "2026-01-27T09:15:00Z",
    created_by: null,
    chunk_count: 3,
    tenant_name: "뷰티클리닉",
    embedding_status: "embedded",
  },
  {
    id: "mock-4",
    title: "수술 전 주의사항",
    content: "1. 수술 전날 밤 12시 이후 금식\n2. 콘택트렌즈 착용 중단 (소프트 1주일, 하드 2주일 전)\n3. 수술 당일 화장 금지\n4. 편한 복장으로 내원\n5. 보호자 동반 필수",
    category: "안내사항",
    tags: ["수술", "주의사항", "사전안내"],
    source_type: "manual",
    source_id: null,
    is_active: true,
    version: 1,
    created_at: "2026-01-20T15:00:00Z",
    updated_at: "2026-01-24T16:45:00Z",
    created_by: null,
    chunk_count: 4,
    tenant_name: "힐링안과",
    embedding_status: "pending",
  },
  {
    id: "mock-5",
    title: "무릎 관절 치료 프로그램",
    content: "비수술 치료 프로그램:\n- 도수치료: 1회 50,000원\n- 체외충격파: 1회 30,000원\n- 프롤로 주사: 1회 100,000원\n- 줄기세포 치료: 1회 2,000,000원\n\n수술 치료:\n- 관절내시경: 2,000,000원~\n- 인공관절: 8,000,000원~",
    category: "가격정보",
    tags: ["무릎", "관절", "가격"],
    source_type: "import",
    source_id: null,
    is_active: true,
    version: 1,
    created_at: "2026-01-18T11:00:00Z",
    updated_at: "2026-01-23T10:00:00Z",
    created_by: null,
    chunk_count: 6,
    tenant_name: "서울정형외과",
    embedding_status: "embedded",
  },
  {
    id: "mock-6",
    title: "외국인 환자 예약 절차",
    content: "1단계: 온라인 상담 (카카오톡/라인/위챗)\n2단계: 사전 검사 자료 송부\n3단계: 예약 확정 및 보증금 결제\n4단계: 입국 후 첫 내원\n5단계: 시술/수술 진행\n6단계: 경과 관찰 및 퇴원",
    category: "안내사항",
    tags: ["외국인", "예약", "절차"],
    source_type: "escalation",
    source_id: null,
    is_active: true,
    version: 2,
    created_at: "2026-01-12T14:00:00Z",
    updated_at: "2026-01-22T08:30:00Z",
    created_by: null,
    chunk_count: 5,
    tenant_name: "힐링안과",
    embedding_status: "embedded",
  },
  {
    id: "mock-7",
    title: "치아 미백 시술 정보",
    content: "전문가 미백 (In-office whitening):\n- 소요시간: 약 1시간\n- 효과: 즉시 2-8톤 밝아짐\n- 비용: 300,000원\n\n자가 미백 (Home whitening):\n- 기간: 2-4주\n- 비용: 200,000원 (트레이 포함)",
    category: "시술정보",
    tags: ["미백", "치아미백"],
    source_type: "manual",
    source_id: null,
    is_active: false,
    version: 1,
    created_at: "2026-01-08T09:00:00Z",
    updated_at: "2026-01-21T17:00:00Z",
    created_by: null,
    chunk_count: 3,
    tenant_name: "스마일치과",
    embedding_status: "failed",
  },
  {
    id: "mock-8",
    title: "레이저 리프팅 FAQ",
    content: "Q: 울쎄라와 써마지의 차이점?\nA: 울쎄라는 초음파, 써마지는 고주파를 이용합니다. 울쎄라는 깊은 층(SMAS)까지 작용하고, 써마지는 진피층에 작용합니다.\n\nQ: 시술 주기?\nA: 울쎄라 6개월-1년, 써마지 3-6개월 간격 추천",
    category: "FAQ",
    tags: ["울쎄라", "써마지", "리프팅"],
    source_type: "manual",
    source_id: null,
    is_active: true,
    version: 4,
    created_at: "2026-01-03T13:00:00Z",
    updated_at: "2026-01-20T15:00:00Z",
    created_by: null,
    chunk_count: 6,
    tenant_name: "뷰티클리닉",
    embedding_status: "embedded",
  },
];

// Animation variants
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
      damping: 30,
    },
  },
};

const statsCardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 30,
    },
  },
};

function getCategoryColor(category: string) {
  return categoryColorMap[category] || defaultCategoryColor;
}

function getEmbeddingStatusConfig(status: EmbeddingStatus) {
  switch (status) {
    case "embedded":
      return {
        label: "임베딩 완료",
        color: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-500/10",
        dotClass: "bg-emerald-500 live-dot",
        icon: Check,
      };
    case "pending":
      return {
        label: "처리 대기",
        color: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-500/10",
        dotClass: "bg-amber-500 live-dot",
        icon: Clock,
      };
    case "failed":
      return {
        label: "실패",
        color: "text-red-600 dark:text-red-400",
        bg: "bg-red-500/10",
        dotClass: "bg-red-500",
        icon: AlertCircle,
      };
  }
}

function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "방금 전";
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;
  return new Date(dateString).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}

export default function KnowledgeBasePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [selectedTenantFilter, setSelectedTenantFilter] = useState<string | undefined>(undefined);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<KnowledgeDocumentItem | null>(null);
  const [newDocument, setNewDocument] = useState({
    title: "",
    content: "",
    category: "",
    tags: "",
    tenant: "",
  });

  // React Query hooks
  const {
    data: apiDocuments,
    isLoading: documentsLoading,
    error: documentsError,
    refetch: refetchDocuments,
  } = useKnowledgeDocuments({
    tenantId: TENANT_ID,
    category: selectedCategory,
    search: searchQuery || undefined,
  });

  const { data: categories } = useKnowledgeCategories(TENANT_ID);
  const { data: statistics, isLoading: statsLoading } = useKnowledgeStatistics(TENANT_ID);

  const createMutation = useCreateKnowledgeDocument();
  const updateMutation = useUpdateKnowledgeDocument();
  const deleteMutation = useDeleteKnowledgeDocument();
  const regenerateEmbeddingsMutation = useRegenerateEmbeddings();

  // Combined categories from API and default
  const allCategories = Array.from(
    new Set([...defaultCategories, ...(categories || [])])
  );

  // Use mock data when API returns no results
  const documents = useMemo(() => {
    if (apiDocuments && apiDocuments.length > 0) return apiDocuments;
    // Filter mock data
    let filtered = [...mockDocuments];
    if (selectedCategory) {
      filtered = filtered.filter((d) => d.category === selectedCategory);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.content.toLowerCase().includes(q) ||
          d.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (selectedTenantFilter) {
      filtered = filtered.filter((d) => (d as any).tenant_name === selectedTenantFilter);
    }
    return filtered;
  }, [apiDocuments, selectedCategory, searchQuery, selectedTenantFilter]);

  // Compute stats from mock if API has no results
  const stats = useMemo(() => {
    if (statistics && statistics.totalDocuments > 0) {
      return {
        totalDocuments: statistics.totalDocuments,
        totalChunks: statistics.totalChunks,
        embeddingCoverage: statistics.activeDocuments > 0
          ? Math.round((statistics.totalChunks > 0 ? (statistics.activeDocuments / statistics.totalDocuments) * 100 : 0))
          : 0,
        lastSync: "2026-01-27 14:30",
      };
    }
    // Mock stats
    const totalDocs = mockDocuments.length;
    const totalChunks = mockDocuments.reduce((sum, d) => sum + (d.chunk_count || 0), 0);
    const embeddedCount = mockDocuments.filter((d) => (d as any).embedding_status === "embedded").length;
    const coverage = totalDocs > 0 ? Math.round((embeddedCount / totalDocs) * 100) : 0;
    return {
      totalDocuments: totalDocs,
      totalChunks: totalChunks,
      embeddingCoverage: coverage,
      lastSync: "2026-01-27 14:30",
    };
  }, [statistics]);

  const handleCreateDocument = async () => {
    if (!newDocument.title || !newDocument.content) {
      toast.error("제목과 내용을 입력해주세요");
      return;
    }

    try {
      await createMutation.mutateAsync({
        tenantId: newDocument.tenant || TENANT_ID,
        title: newDocument.title,
        content: newDocument.content,
        category: newDocument.category || undefined,
        tags: newDocument.tags
          ? newDocument.tags.split(",").map((t) => t.trim()).filter(Boolean)
          : undefined,
      });
      toast.success("문서가 생성되었습니다");
      setIsCreateDialogOpen(false);
      setNewDocument({ title: "", content: "", category: "", tags: "", tenant: "" });
    } catch {
      toast.error("문서 생성에 실패했습니다");
    }
  };

  const handleUpdateDocument = async () => {
    if (!selectedDocument) return;

    try {
      await updateMutation.mutateAsync({
        documentId: selectedDocument.id,
        updates: {
          title: newDocument.title || undefined,
          content: newDocument.content || undefined,
          category: newDocument.category || undefined,
          tags: newDocument.tags
            ? newDocument.tags.split(",").map((t) => t.trim()).filter(Boolean)
            : undefined,
        },
      });
      toast.success("문서가 수정되었습니다");
      setIsEditDialogOpen(false);
      setSelectedDocument(null);
      setNewDocument({ title: "", content: "", category: "", tags: "", tenant: "" });
    } catch {
      toast.error("문서 수정에 실패했습니다");
    }
  };

  const handleDeleteDocument = async () => {
    if (!selectedDocument) return;

    try {
      await deleteMutation.mutateAsync(selectedDocument.id);
      toast.success("문서가 삭제되었습니다");
      setIsDeleteDialogOpen(false);
      setSelectedDocument(null);
    } catch {
      toast.error("문서 삭제에 실패했습니다");
    }
  };

  const handleRegenerateEmbeddings = async (documentId: string) => {
    try {
      await regenerateEmbeddingsMutation.mutateAsync(documentId);
      toast.success("임베딩이 재생성되었습니다");
    } catch {
      toast.error("임베딩 재생성에 실패했습니다");
    }
  };

  const openEditDialog = (doc: KnowledgeDocumentItem) => {
    setSelectedDocument(doc);
    setNewDocument({
      title: doc.title,
      content: doc.content,
      category: doc.category || "",
      tags: doc.tags?.join(", ") || "",
      tenant: "",
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (doc: KnowledgeDocumentItem) => {
    setSelectedDocument(doc);
    setIsDeleteDialogOpen(true);
  };

  function getSourceBadge(sourceType: string) {
    switch (sourceType) {
      case "manual":
        return (
          <Badge variant="outline" className="border-0 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[11px] font-medium rounded-full">
            수동 입력
          </Badge>
        );
      case "escalation":
        return (
          <Badge variant="outline" className="border-0 bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[11px] font-medium rounded-full">
            에스컬레이션
          </Badge>
        );
      case "import":
        return (
          <Badge variant="outline" className="border-0 bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[11px] font-medium rounded-full">
            일괄 업로드
          </Badge>
        );
      default:
        return null;
    }
  }

  return (
    <div className="space-y-6 animate-in-up">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/20">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">지식베이스</h1>
              <p className="text-sm text-muted-foreground">
                AI가 더 정확한 답변을 할 수 있도록 지식을 관리하세요
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetchDocuments()}
            disabled={documentsLoading}
            className="rounded-xl"
          >
            <RefreshCw className={`h-4 w-4 ${documentsLoading ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" className="gap-2 rounded-xl border-0 shadow-sm bg-card">
            <Upload className="h-4 w-4" />
            일괄 업로드
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 rounded-xl shadow-sm">
                <Plus className="h-4 w-4" />
                문서 추가
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[640px] rounded-2xl border-0 shadow-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-primary/10">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  새 문서 추가
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  AI 자동응대에 사용될 지식 문서를 추가합니다. 저장 시 자동으로 임베딩이 생성됩니다.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    제목 *
                  </Label>
                  <Input
                    placeholder="문서 제목을 입력하세요"
                    className="rounded-xl border-0 bg-muted/50 focus:bg-background"
                    value={newDocument.title}
                    onChange={(e) =>
                      setNewDocument({ ...newDocument, title: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      카테고리
                    </Label>
                    <Select
                      value={newDocument.category}
                      onValueChange={(value) =>
                        setNewDocument({ ...newDocument, category: value })
                      }
                    >
                      <SelectTrigger className="rounded-xl border-0 bg-muted/50">
                        <SelectValue placeholder="카테고리 선택" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-0 shadow-lg">
                        {allCategories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2 h-2 rounded-full ${getCategoryColor(cat).dot}`}
                              />
                              {cat}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      테넌트
                    </Label>
                    <Select
                      value={newDocument.tenant}
                      onValueChange={(value) =>
                        setNewDocument({ ...newDocument, tenant: value })
                      }
                    >
                      <SelectTrigger className="rounded-xl border-0 bg-muted/50">
                        <SelectValue placeholder="테넌트 선택" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-0 shadow-lg">
                        {tenantOptions.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                              {t.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    태그
                  </Label>
                  <Input
                    placeholder="쉼표로 구분하여 입력 (예: 라식, 가격, 비용)"
                    className="rounded-xl border-0 bg-muted/50 focus:bg-background"
                    value={newDocument.tags}
                    onChange={(e) =>
                      setNewDocument({ ...newDocument, tags: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    내용 *
                  </Label>
                  <Textarea
                    placeholder="문서 내용을 입력하세요. 마크다운 형식을 지원합니다."
                    rows={8}
                    className="rounded-xl border-0 bg-muted/50 focus:bg-background resize-none"
                    value={newDocument.content}
                    onChange={(e) =>
                      setNewDocument({ ...newDocument, content: e.target.value })
                    }
                  />
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setIsCreateDialogOpen(false)}
                  className="rounded-xl"
                >
                  취소
                </Button>
                <Button
                  onClick={handleCreateDocument}
                  disabled={createMutation.isPending}
                  className="rounded-xl gap-2"
                >
                  {createMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      저장 중...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      저장
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid gap-4 md:grid-cols-4"
      >
        <motion.div variants={statsCardVariants}>
          <Card className="border-0 shadow-sm card-3d overflow-hidden rounded-2xl">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    전체 문서
                  </p>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-16 rounded-lg" />
                  ) : (
                    <p className="text-3xl font-bold tabular-nums">
                      {stats.totalDocuments}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/10">
                  <FileText className="h-5 w-5 text-blue-500" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 live-dot" />
                <span className="text-[11px] text-muted-foreground">
                  활성 문서 {statsLoading ? "--" : (statistics?.activeDocuments || mockDocuments.filter((d) => d.is_active).length)}개
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={statsCardVariants}>
          <Card className="border-0 shadow-sm card-3d overflow-hidden rounded-2xl">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    임베딩 청크
                  </p>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-16 rounded-lg" />
                  ) : (
                    <p className="text-3xl font-bold tabular-nums">
                      {stats.totalChunks}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-500/10">
                  <Database className="h-5 w-5 text-violet-500" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <Layers className="h-3 w-3 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">벡터 검색 가능</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={statsCardVariants}>
          <Card className="border-0 shadow-sm card-3d overflow-hidden rounded-2xl">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    임베딩 커버리지
                  </p>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-16 rounded-lg" />
                  ) : (
                    <p className="text-3xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {stats.embeddingCoverage}%
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10">
                  <Activity className="h-5 w-5 text-emerald-500" />
                </div>
              </div>
              <div className="mt-3">
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <motion.div
                    className="h-full bg-emerald-500 rounded-full progress-shine"
                    initial={{ width: 0 }}
                    animate={{ width: `${stats.embeddingCoverage}%` }}
                    transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.5 }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={statsCardVariants}>
          <Card className="border-0 shadow-sm card-3d overflow-hidden rounded-2xl">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    마지막 동기화
                  </p>
                  <p className="text-lg font-bold tabular-nums">
                    {stats.lastSync}
                  </p>
                </div>
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/10">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 live-dot" />
                <span className="text-[11px] text-muted-foreground">정상 운영 중</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Search and Filter Bar */}
      <Card className="border-0 shadow-sm rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="문서 제목, 내용, 태그로 검색..."
                className="pl-9 rounded-xl border-0 bg-muted/50 focus:bg-background"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Category Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 rounded-xl border-0 bg-muted/50 min-w-[140px] justify-between">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedCategory || "전체 카테고리"}</span>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl border-0 shadow-lg">
                <DropdownMenuItem
                  onClick={() => setSelectedCategory(undefined)}
                  className="rounded-lg"
                >
                  <CircleDot className="mr-2 h-4 w-4 text-muted-foreground" />
                  전체 카테고리
                </DropdownMenuItem>
                {allCategories.map((cat) => {
                  const color = getCategoryColor(cat);
                  return (
                    <DropdownMenuItem
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className="rounded-lg"
                    >
                      <span className={`mr-2 w-2.5 h-2.5 rounded-full ${color.dot}`} />
                      {cat}
                      {selectedCategory === cat && (
                        <Check className="ml-auto h-4 w-4 text-primary" />
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* View Mode Toggle */}
            <div className="flex items-center rounded-xl bg-muted/50 p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                  viewMode === "grid"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                  viewMode === "list"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Active Filters */}
          {(selectedCategory || selectedTenantFilter || searchQuery) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50"
            >
              <span className="text-[11px] font-medium text-muted-foreground">필터:</span>
              {selectedCategory && (
                <Badge
                  variant="secondary"
                  className={`gap-1 rounded-full border-0 text-[11px] cursor-pointer ${getCategoryColor(selectedCategory).bg} ${getCategoryColor(selectedCategory).text}`}
                  onClick={() => setSelectedCategory(undefined)}
                >
                  {selectedCategory}
                  <X className="h-3 w-3" />
                </Badge>
              )}
              {searchQuery && (
                <Badge
                  variant="secondary"
                  className="gap-1 rounded-full border-0 text-[11px] cursor-pointer"
                  onClick={() => setSearchQuery("")}
                >
                  &ldquo;{searchQuery}&rdquo;
                  <X className="h-3 w-3" />
                </Badge>
              )}
              <button
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors ml-1"
                onClick={() => {
                  setSelectedCategory(undefined);
                  setSelectedTenantFilter(undefined);
                  setSearchQuery("");
                }}
              >
                전체 해제
              </button>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Error State */}
      {documentsError && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="border-0 shadow-sm bg-red-500/5 rounded-2xl">
            <CardContent className="py-5 px-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-500/10">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-red-600 dark:text-red-400">
                    문서를 불러오는 중 오류가 발생했습니다
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    네트워크 상태를 확인하고 다시 시도해주세요
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchDocuments()}
                  className="rounded-xl border-0 shadow-sm"
                >
                  다시 시도
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Loading State */}
      {documentsLoading && (
        <div className={viewMode === "grid" ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3" : "space-y-3"}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="border-0 shadow-sm rounded-2xl">
              <CardContent className="p-5">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-5 rounded-lg" />
                    <Skeleton className="h-5 w-1/2 rounded-lg" />
                  </div>
                  <Skeleton className="h-4 w-full rounded-lg" />
                  <Skeleton className="h-4 w-2/3 rounded-lg" />
                  <div className="flex items-center gap-2 pt-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Documents - Grid View */}
      {!documentsLoading && !documentsError && viewMode === "grid" && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          <AnimatePresence mode="popLayout">
            {documents?.map((doc) => {
              const embeddingStatus: EmbeddingStatus =
                (doc as any).embedding_status || ((doc.chunk_count || 0) > 0 ? "embedded" : "pending");
              const embeddingConfig = getEmbeddingStatusConfig(embeddingStatus);
              const tenantName = (doc as any).tenant_name || "힐링안과";

              return (
                <motion.div
                  key={doc.id}
                  variants={itemVariants}
                  exit={{ opacity: 0, scale: 0.95 }}
                  layout
                >
                  <Card
                    className={`border-0 shadow-sm card-3d group cursor-default transition-all rounded-2xl ${
                      !doc.is_active ? "opacity-50" : ""
                    }`}
                  >
                    <CardContent className="p-5">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 shrink-0">
                            <FileText className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-sm truncate leading-tight">
                              {doc.title}
                            </h3>
                            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                              {tenantName}
                            </p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded-xl border-0 shadow-lg">
                            <DropdownMenuItem
                              onClick={() => openEditDialog(doc)}
                              className="rounded-lg gap-2"
                            >
                              <Edit className="h-4 w-4" />
                              수정
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleRegenerateEmbeddings(doc.id)}
                              disabled={regenerateEmbeddingsMutation.isPending}
                              className="rounded-lg gap-2"
                            >
                              <Brain className="h-4 w-4" />
                              임베딩 재생성
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="rounded-lg gap-2 text-destructive focus:text-destructive"
                              onClick={() => openDeleteDialog(doc)}
                            >
                              <Trash2 className="h-4 w-4" />
                              삭제
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Content Preview */}
                      <p className="text-[13px] text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
                        {doc.content}
                      </p>

                      {/* Badges Row */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-3">
                        {doc.category && (
                          <Badge
                            variant="secondary"
                            className={`border-0 rounded-full text-[11px] font-medium px-2 py-0.5 ${getCategoryColor(doc.category).bg} ${getCategoryColor(doc.category).text}`}
                          >
                            {doc.category}
                          </Badge>
                        )}
                        {getSourceBadge(doc.source_type)}
                        {!doc.is_active && (
                          <Badge
                            variant="secondary"
                            className="border-0 rounded-full text-[11px] font-medium px-2 py-0.5 bg-gray-500/10 text-gray-500"
                          >
                            비활성
                          </Badge>
                        )}
                      </div>

                      {/* Tags */}
                      {doc.tags && doc.tags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 mb-3">
                          {doc.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/50 rounded-full px-1.5 py-0.5"
                            >
                              <Tag className="h-2.5 w-2.5" />
                              {tag}
                            </span>
                          ))}
                          {doc.tags.length > 3 && (
                            <span className="text-[11px] text-muted-foreground">
                              +{doc.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-3 border-t border-border/50">
                        <div className="flex items-center gap-3">
                          {/* Embedding Status */}
                          <div className={`flex items-center gap-1.5 ${embeddingConfig.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${embeddingConfig.dotClass}`} />
                            <span className="text-[11px] font-medium">
                              {embeddingConfig.label}
                            </span>
                          </div>
                          {/* Chunk Count */}
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {doc.chunk_count || 0} 청크
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {formatRelativeTime(doc.updated_at)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Documents - List View */}
      {!documentsLoading && !documentsError && viewMode === "list" && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-2"
        >
          {/* List Header */}
          <div className="grid grid-cols-12 gap-4 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <div className="col-span-4">문서</div>
            <div className="col-span-2">카테고리</div>
            <div className="col-span-2">테넌트</div>
            <div className="col-span-1 text-center">청크</div>
            <div className="col-span-1 text-center">상태</div>
            <div className="col-span-1">수정일</div>
            <div className="col-span-1 text-right">작업</div>
          </div>

          <AnimatePresence mode="popLayout">
            {documents?.map((doc) => {
              const embeddingStatus: EmbeddingStatus =
                (doc as any).embedding_status || ((doc.chunk_count || 0) > 0 ? "embedded" : "pending");
              const embeddingConfig = getEmbeddingStatusConfig(embeddingStatus);
              const tenantName = (doc as any).tenant_name || "힐링안과";

              return (
                <motion.div
                  key={doc.id}
                  variants={itemVariants}
                  exit={{ opacity: 0, x: -20 }}
                  layout
                >
                  <Card
                    className={`border-0 shadow-sm card-3d transition-all rounded-2xl ${
                      !doc.is_active ? "opacity-50" : ""
                    }`}
                  >
                    <CardContent className="p-0">
                      <div className="grid grid-cols-12 gap-4 items-center px-5 py-3.5">
                        {/* Document Title */}
                        <div className="col-span-4 flex items-center gap-3 min-w-0">
                          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 shrink-0">
                            <FileText className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{doc.title}</p>
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                              {doc.content.slice(0, 60)}...
                            </p>
                          </div>
                        </div>

                        {/* Category */}
                        <div className="col-span-2">
                          {doc.category ? (
                            <Badge
                              variant="secondary"
                              className={`border-0 rounded-full text-[11px] font-medium ${getCategoryColor(doc.category).bg} ${getCategoryColor(doc.category).text}`}
                            >
                              {doc.category}
                            </Badge>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">--</span>
                          )}
                        </div>

                        {/* Tenant */}
                        <div className="col-span-2">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[13px]">{tenantName}</span>
                          </div>
                        </div>

                        {/* Chunk Count */}
                        <div className="col-span-1 text-center">
                          <span className="text-sm font-medium tabular-nums">
                            {doc.chunk_count || 0}
                          </span>
                        </div>

                        {/* Embedding Status */}
                        <div className="col-span-1 flex justify-center">
                          <div
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${embeddingConfig.bg}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${embeddingConfig.dotClass}`} />
                            <span className={`text-[11px] font-medium ${embeddingConfig.color}`}>
                              {embeddingConfig.label}
                            </span>
                          </div>
                        </div>

                        {/* Last Updated */}
                        <div className="col-span-1">
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {formatRelativeTime(doc.updated_at)}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="col-span-1 flex justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl border-0 shadow-lg">
                              <DropdownMenuItem
                                onClick={() => openEditDialog(doc)}
                                className="rounded-lg gap-2"
                              >
                                <Edit className="h-4 w-4" />
                                수정
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleRegenerateEmbeddings(doc.id)}
                                disabled={regenerateEmbeddingsMutation.isPending}
                                className="rounded-lg gap-2"
                              >
                                <Brain className="h-4 w-4" />
                                임베딩 재생성
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="rounded-lg gap-2 text-destructive focus:text-destructive"
                                onClick={() => openDeleteDialog(doc)}
                              >
                                <Trash2 className="h-4 w-4" />
                                삭제
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Empty State */}
      {!documentsLoading && !documentsError && documents?.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring" as const, stiffness: 300, damping: 30 }}
        >
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="py-16 text-center">
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mx-auto mb-5">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">문서가 없습니다</h3>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
                검색 조건에 맞는 문서가 없거나 아직 등록된 문서가 없습니다.
                첫 번째 지식 문서를 추가해보세요.
              </p>
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                className="rounded-xl gap-2"
              >
                <Plus className="h-4 w-4" />
                첫 문서 추가하기
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Document count footer */}
      {!documentsLoading && !documentsError && documents && documents.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-between px-1"
        >
          <p className="text-[11px] text-muted-foreground">
            총 <span className="font-semibold tabular-nums">{documents.length}</span>개 문서
          </p>
          <p className="text-[11px] text-muted-foreground">
            마지막 업데이트: {stats.lastSync}
          </p>
        </motion.div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[640px] rounded-2xl border-0 shadow-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-blue-500/10">
                <Edit className="h-4 w-4 text-blue-500" />
              </div>
              문서 수정
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              문서를 수정합니다. 내용 변경 시 자동으로 임베딩이 재생성됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                제목
              </Label>
              <Input
                placeholder="문서 제목을 입력하세요"
                className="rounded-xl border-0 bg-muted/50 focus:bg-background"
                value={newDocument.title}
                onChange={(e) =>
                  setNewDocument({ ...newDocument, title: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  카테고리
                </Label>
                <Select
                  value={newDocument.category}
                  onValueChange={(value) =>
                    setNewDocument({ ...newDocument, category: value })
                  }
                >
                  <SelectTrigger className="rounded-xl border-0 bg-muted/50">
                    <SelectValue placeholder="카테고리 선택" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-0 shadow-lg">
                    {allCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${getCategoryColor(cat).dot}`} />
                          {cat}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  테넌트
                </Label>
                <Select
                  value={newDocument.tenant}
                  onValueChange={(value) =>
                    setNewDocument({ ...newDocument, tenant: value })
                  }
                >
                  <SelectTrigger className="rounded-xl border-0 bg-muted/50">
                    <SelectValue placeholder="테넌트 선택" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-0 shadow-lg">
                    {tenantOptions.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          {t.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                태그
              </Label>
              <Input
                placeholder="쉼표로 구분하여 입력 (예: 라식, 가격, 비용)"
                className="rounded-xl border-0 bg-muted/50 focus:bg-background"
                value={newDocument.tags}
                onChange={(e) =>
                  setNewDocument({ ...newDocument, tags: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                내용
              </Label>
              <Textarea
                placeholder="문서 내용을 입력하세요. 마크다운 형식을 지원합니다."
                rows={8}
                className="rounded-xl border-0 bg-muted/50 focus:bg-background resize-none"
                value={newDocument.content}
                onChange={(e) =>
                  setNewDocument({ ...newDocument, content: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setIsEditDialogOpen(false)}
              className="rounded-xl"
            >
              취소
            </Button>
            <Button
              onClick={handleUpdateDocument}
              disabled={updateMutation.isPending}
              className="rounded-xl gap-2"
            >
              {updateMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  저장
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[440px] rounded-2xl border-0 shadow-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-red-500/10">
                <Trash2 className="h-4 w-4 text-red-500" />
              </div>
              문서 삭제
            </DialogTitle>
            <DialogDescription className="text-muted-foreground leading-relaxed">
              &ldquo;{selectedDocument?.title}&rdquo; 문서를 삭제하시겠습니까?
              이 작업은 되돌릴 수 없으며, 관련된 임베딩도 함께 삭제됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-4">
            <Button
              variant="ghost"
              onClick={() => setIsDeleteDialogOpen(false)}
              className="rounded-xl"
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteDocument}
              disabled={deleteMutation.isPending}
              className="rounded-xl gap-2"
            >
              {deleteMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  삭제 중...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  삭제
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
