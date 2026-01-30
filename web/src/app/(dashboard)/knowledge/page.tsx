"use client";

import { useState, useMemo, useEffect } from "react";
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
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Plus,
  FileText,
  MoreVertical,
  Edit,
  Trash2,
  Upload,
  Download,
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

const defaultCategories = ["FAQ", "시술정보", "가격정보", "안내사항", "예약"];

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

// Empty array - all data comes from DB
const emptyDocuments: KnowledgeDocumentItem[] = [];

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
  const [tenantOptions, setTenantOptions] = useState<{ id: string; name: string }[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string | undefined>(undefined);
  const [newDocument, setNewDocument] = useState({
    title: "",
    content: "",
    category: "",
    tags: "",
    tenant: "",
  });
  const [isCsvUploadDialogOpen, setIsCsvUploadDialogOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvType, setCsvType] = useState<"tenants" | "knowledge">("knowledge");
  const [isUploading, setIsUploading] = useState(false);

  // Fetch tenants on mount
  useEffect(() => {
    fetch("/api/tenants")
      .then((r) => r.json())
      .then((data) => {
        const tenants = (data.tenants || []).map((t: any) => ({
          id: t.id,
          name: t.display_name || t.name,
        }));
        setTenantOptions(tenants);
        if (tenants.length > 0 && !activeTenantId) {
          setActiveTenantId(tenants[0].id);
        }
      })
      .catch(() => {});
  }, [activeTenantId]);

  // React Query hooks - only fetch if we have a valid tenant ID
  const {
    data: apiDocuments,
    isLoading: documentsLoading,
    error: documentsError,
    refetch: refetchDocuments,
  } = useKnowledgeDocuments({
    tenantId: selectedTenantFilter || activeTenantId || "",
    category: selectedCategory,
    search: searchQuery || undefined,
  }, {
    enabled: !!(selectedTenantFilter || activeTenantId), // Only run query when we have a tenant ID
  });

  const { data: categories } = useKnowledgeCategories(activeTenantId || "", {
    enabled: !!activeTenantId,
  });
  const { data: statistics, isLoading: statsLoading } = useKnowledgeStatistics(activeTenantId || "", {
    enabled: !!activeTenantId,
  });

  const createMutation = useCreateKnowledgeDocument();
  const updateMutation = useUpdateKnowledgeDocument();
  const deleteMutation = useDeleteKnowledgeDocument();
  const regenerateEmbeddingsMutation = useRegenerateEmbeddings();

  // Combined categories from API and default
  const allCategories = Array.from(
    new Set([...defaultCategories, ...(categories || [])])
  );

  // Use DB data only
  const documents = useMemo(() => {
    return apiDocuments || emptyDocuments;
  }, [apiDocuments]);

  // Stats from DB only
  const stats = useMemo(() => {
    return {
      totalDocuments: statistics?.totalDocuments || 0,
      totalChunks: statistics?.totalChunks || 0,
      embeddingCoverage: statistics && statistics.totalDocuments > 0
        ? Math.round((statistics.activeDocuments / statistics.totalDocuments) * 100)
        : 0,
      lastSync: "-",
    };
  }, [statistics]);

  const handleCreateDocument = async () => {
    if (!newDocument.title || !newDocument.content) {
      toast.error("제목과 내용을 입력해주세요");
      return;
    }

    try {
      await createMutation.mutateAsync({
        tenantId: newDocument.tenant || activeTenantId,
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

  const handleCsvDownload = async (type: "knowledge" | "tenants") => {
    try {
      const url = type === "knowledge"
        ? `/api/knowledge/bulk${selectedTenantFilter ? `?tenantId=${selectedTenantFilter}` : ""}`
        : "/api/tenants/bulk";

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("다운로드 실패");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = type === "knowledge"
        ? `knowledge-${selectedTenantFilter || "all"}-${Date.now()}.csv`
        : `tenants-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);

      toast.success(`✅ CSV 템플릿 다운로드 완료`);
    } catch (error: any) {
      toast.error(error.message || "다운로드에 실패했습니다");
    }
  };

  const handleTemplateDownload = async (specialty: string) => {
    try {
      const response = await fetch(`/api/knowledge/template?specialty=${specialty}`);

      if (!response.ok) {
        throw new Error("템플릿 다운로드 실패");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;

      // 파일명은 서버에서 Content-Disposition 헤더로 제공됨
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      a.download = filenameMatch ? filenameMatch[1] : `template-${specialty}.csv`;

      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);

      toast.success(`✅ 진료과별 템플릿 다운로드 완료`);
    } catch (error: any) {
      toast.error(error.message || "템플릿 다운로드에 실패했습니다");
    }
  };

  const handleCsvUpload = async () => {
    if (!csvFile) {
      toast.error("CSV 파일을 선택해주세요");
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", csvFile);

      const url = csvType === "knowledge" ? "/api/knowledge/bulk" : "/api/tenants/bulk";

      const response = await fetch(url, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "업로드 실패");
      }

      if (csvType === "knowledge") {
        toast.success(
          `✅ 지식베이스 업로드 완료\n문서: ${result.successCount}개\n임베딩: ${result.embeddingCount}개`
        );
      } else {
        toast.success(
          `✅ 거래처 업로드 완료\n성공: ${result.successCount}개`
        );
      }

      if (result.errors && result.errors.length > 0) {
        toast.warning(`⚠️ 일부 항목 실패 (${result.errorCount}개)`);
      }

      setIsCsvUploadDialogOpen(false);
      setCsvFile(null);
      refetchDocuments();

      // Refetch tenants if we uploaded tenants
      if (csvType === "tenants") {
        fetch("/api/tenants")
          .then((r) => r.json())
          .then((data) => setTenantOptions(data))
          .catch(console.error);
      }
    } catch (error: any) {
      toast.error(error.message || "CSV 업로드에 실패했습니다");
    } finally {
      setIsUploading(false);
    }
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 rounded-xl border-0 shadow-sm bg-card">
                <Download className="h-4 w-4" />
                CSV 다운로드
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => handleCsvDownload("knowledge")}>
                <FileText className="h-4 w-4 mr-2" />
                지식베이스 CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCsvDownload("tenants")}>
                <Building2 className="h-4 w-4 mr-2" />
                거래처 CSV
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                진료과별 템플릿
              </div>
              <DropdownMenuItem onClick={() => handleTemplateDownload("ophthalmology")}>
                <FileText className="h-4 w-4 mr-2 text-blue-500" />
                안과 템플릿
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleTemplateDownload("dentistry")}>
                <FileText className="h-4 w-4 mr-2 text-emerald-500" />
                치과 템플릿
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleTemplateDownload("plastic_surgery")}>
                <FileText className="h-4 w-4 mr-2 text-violet-500" />
                성형외과 템플릿
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleTemplateDownload("dermatology")}>
                <FileText className="h-4 w-4 mr-2 text-amber-500" />
                피부과 템플릿
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleTemplateDownload("general")}>
                <FileText className="h-4 w-4 mr-2 text-slate-500" />
                일반 템플릿
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Dialog open={isCsvUploadDialogOpen} onOpenChange={setIsCsvUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 rounded-xl border-0 shadow-sm bg-card">
                <Upload className="h-4 w-4" />
                CSV 업로드
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px] rounded-2xl border-0 shadow-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-primary/10">
                    <Upload className="h-4 w-4 text-primary" />
                  </div>
                  CSV 일괄 업로드
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  거래처 정보 또는 지식베이스 문서를 CSV 파일로 일괄 업로드합니다. 지식베이스 업로드 시 자동으로 벡터 임베딩이 생성됩니다.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    업로드 유형 *
                  </Label>
                  <Select value={csvType} onValueChange={(v) => setCsvType(v as "tenants" | "knowledge")}>
                    <SelectTrigger className="rounded-xl border-0 bg-muted/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="knowledge">지식베이스 (Knowledge)</SelectItem>
                      <SelectItem value="tenants">거래처 (Tenants)</SelectItem>
                    </SelectContent>
                  </Select>
                  {csvType === "knowledge" && (
                    <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 text-xs space-y-1.5">
                      <div className="font-semibold text-violet-700 dark:text-violet-300 flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5" />
                        풀자동화 시스템 핵심
                      </div>
                      <div className="text-muted-foreground leading-relaxed">
                        지식베이스가 충분히 구축되어야 AI가 예약 관련 질문에 정확하게 답변하고 예약 의도를 감지할 수 있습니다.
                        최소 <span className="font-semibold text-violet-600 dark:text-violet-400">50개 이상의 FAQ</span>를 업로드하는 것을 권장합니다.
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    CSV 파일 *
                  </Label>
                  <div className="flex flex-col gap-2">
                    <Input
                      type="file"
                      accept=".csv"
                      onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                      className="rounded-xl border-0 bg-muted/50 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                    />
                    {csvFile && (
                      <div className="text-xs text-muted-foreground flex items-center gap-2 px-3">
                        <FileText className="h-3 w-3" />
                        {csvFile.name} ({(csvFile.size / 1024).toFixed(1)} KB)
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs space-y-2">
                  <div className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5" />
                    CSV 형식 안내
                  </div>
                  {csvType === "knowledge" ? (
                    <div className="text-muted-foreground space-y-1">
                      <div className="font-medium text-amber-700 dark:text-amber-300 mb-1">필수 컬럼:</div>
                      <div className="pl-2 space-y-0.5">
                        <div>• <code className="bg-amber-900/10 px-1.5 py-0.5 rounded text-[10px] font-mono">tenant_name</code> - 거래처 이름 (예: &quot;힐링안과&quot;)</div>
                        <div>• <code className="bg-amber-900/10 px-1.5 py-0.5 rounded text-[10px] font-mono">title</code> - 문서 제목 (예: &quot;라식 수술 비용&quot;)</div>
                        <div>• <code className="bg-amber-900/10 px-1.5 py-0.5 rounded text-[10px] font-mono">content</code> - 문서 내용 (예: &quot;라식 수술은 양안 기준 150만원입니다&quot;)</div>
                        <div>• <code className="bg-amber-900/10 px-1.5 py-0.5 rounded text-[10px] font-mono">category</code> - 카테고리 (FAQ, 시술정보, 가격정보, 안내사항, 예약)</div>
                        <div>• <code className="bg-amber-900/10 px-1.5 py-0.5 rounded text-[10px] font-mono">tags</code> - 태그 (쉼표 구분, 예: &quot;라식,수술,비용&quot;)</div>
                      </div>
                      <div className="pt-2 border-t border-amber-500/10 mt-2">
                        <div className="font-medium text-amber-700 dark:text-amber-300 mb-1">샘플 FAQ 행:</div>
                        <div className="bg-amber-900/5 rounded p-1.5 font-mono text-[9px] overflow-x-auto">
                          힐링안과,라식 비용,라식 수술은 양안 기준 150만원입니다.,가격정보,라식,비용
                        </div>
                        <div className="bg-amber-900/5 rounded p-1.5 font-mono text-[9px] overflow-x-auto mt-1">
                          힐링안과,라식 회복기간,라식 수술 후 3-5일 정도면 일상생활이 가능합니다.,FAQ,라식,회복
                        </div>
                        <div className="bg-amber-900/5 rounded p-1.5 font-mono text-[9px] overflow-x-auto mt-1">
                          힐링안과,예약 방법,카카오톡 또는 전화로 예약하실 수 있습니다.,예약,예약,상담
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-muted-foreground space-y-0.5">
                      <div>• 컬럼: name, name_en, specialty, default_language, system_prompt</div>
                      <div>• 예시: &quot;힐링안과&quot;,&quot;Healing Eye&quot;,&quot;ophthalmology&quot;,&quot;ja&quot;,&quot;[프롬프트]&quot;</div>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCsvUploadDialogOpen(false)} className="rounded-xl">
                  취소
                </Button>
                <Button
                  onClick={handleCsvUpload}
                  disabled={!csvFile || isUploading}
                  className="rounded-xl gap-2"
                >
                  {isUploading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      업로드 중...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      업로드
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
                  활성 문서 {statsLoading ? "--" : (statistics?.activeDocuments || 0)}개
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

            {/* Tenant Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 rounded-xl border-0 bg-muted/50 min-w-[140px] justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{tenantOptions.find((t) => t.id === selectedTenantFilter)?.name || "전체 거래처"}</span>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl border-0 shadow-lg">
                <DropdownMenuItem
                  onClick={() => setSelectedTenantFilter(undefined)}
                  className="rounded-lg"
                >
                  <CircleDot className="mr-2 h-4 w-4 text-muted-foreground" />
                  전체 거래처
                </DropdownMenuItem>
                {tenantOptions.map((tenant) => (
                  <DropdownMenuItem
                    key={tenant.id}
                    onClick={() => setSelectedTenantFilter(tenant.id)}
                    className="rounded-lg"
                  >
                    <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                    {tenant.name}
                    {selectedTenantFilter === tenant.id && (
                      <Check className="ml-auto h-4 w-4 text-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

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
              {selectedTenantFilter && (
                <Badge
                  variant="secondary"
                  className="gap-1 rounded-full border-0 text-[11px] cursor-pointer bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  onClick={() => setSelectedTenantFilter(undefined)}
                >
                  <Building2 className="h-3 w-3" />
                  {tenantOptions.find((t) => t.id === selectedTenantFilter)?.name}
                  <X className="h-3 w-3" />
                </Badge>
              )}
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
