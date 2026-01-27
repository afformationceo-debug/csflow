"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Search,
  Plus,
  FileText,
  MoreVertical,
  Edit,
  Trash2,
  Upload,
  Brain,
  FolderOpen,
  Tag,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  Check,
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

const defaultCategories = ["FAQ", "가격", "예약", "주의사항", "시술정보"];

export default function KnowledgeBasePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<KnowledgeDocumentItem | null>(null);
  const [newDocument, setNewDocument] = useState({
    title: "",
    content: "",
    category: "",
    tags: "",
  });

  // React Query hooks
  const {
    data: documents,
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

  const handleCreateDocument = async () => {
    if (!newDocument.title || !newDocument.content) {
      toast.error("제목과 내용을 입력해주세요");
      return;
    }

    try {
      await createMutation.mutateAsync({
        tenantId: TENANT_ID,
        title: newDocument.title,
        content: newDocument.content,
        category: newDocument.category || undefined,
        tags: newDocument.tags
          ? newDocument.tags.split(",").map((t) => t.trim()).filter(Boolean)
          : undefined,
      });
      toast.success("문서가 생성되었습니다");
      setIsCreateDialogOpen(false);
      setNewDocument({ title: "", content: "", category: "", tags: "" });
    } catch (error) {
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
      setNewDocument({ title: "", content: "", category: "", tags: "" });
    } catch (error) {
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
    } catch (error) {
      toast.error("문서 삭제에 실패했습니다");
    }
  };

  const handleRegenerateEmbeddings = async (documentId: string) => {
    try {
      await regenerateEmbeddingsMutation.mutateAsync(documentId);
      toast.success("임베딩이 재생성되었습니다");
    } catch (error) {
      toast.error("임베딩 재생성에 실패했습니다");
    }
  };

  const handleToggleActive = async (doc: KnowledgeDocumentItem) => {
    try {
      await updateMutation.mutateAsync({
        documentId: doc.id,
        updates: { isActive: !doc.is_active },
      });
      toast.success(doc.is_active ? "문서가 비활성화되었습니다" : "문서가 활성화되었습니다");
    } catch (error) {
      toast.error("상태 변경에 실패했습니다");
    }
  };

  const openEditDialog = (doc: KnowledgeDocumentItem) => {
    setSelectedDocument(doc);
    setNewDocument({
      title: doc.title,
      content: doc.content,
      category: doc.category || "",
      tags: doc.tags?.join(", ") || "",
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
          <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
            수동 입력
          </Badge>
        );
      case "escalation":
        return (
          <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/20">
            에스컬레이션 학습
          </Badge>
        );
      case "import":
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
            일괄 업로드
          </Badge>
        );
      default:
        return null;
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">지식베이스</h1>
          <p className="text-muted-foreground">AI 자동응대를 위한 지식 문서를 관리합니다</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetchDocuments()}
            disabled={documentsLoading}
          >
            <RefreshCw className={`h-4 w-4 ${documentsLoading ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            일괄 업로드
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                문서 추가
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>새 문서 추가</DialogTitle>
                <DialogDescription>
                  AI 자동응대에 사용될 지식 문서를 추가합니다. 저장 시 자동으로 임베딩이 생성됩니다.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>제목 *</Label>
                  <Input
                    placeholder="문서 제목을 입력하세요"
                    value={newDocument.title}
                    onChange={(e) =>
                      setNewDocument({ ...newDocument, title: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>카테고리</Label>
                  <Select
                    value={newDocument.category}
                    onValueChange={(value) =>
                      setNewDocument({ ...newDocument, category: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="카테고리 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {allCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>태그</Label>
                  <Input
                    placeholder="쉼표로 구분하여 입력 (예: 라식, 가격, 비용)"
                    value={newDocument.tags}
                    onChange={(e) =>
                      setNewDocument({ ...newDocument, tags: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>내용 *</Label>
                  <Textarea
                    placeholder="문서 내용을 입력하세요. 마크다운 형식을 지원합니다."
                    rows={10}
                    value={newDocument.content}
                    onChange={(e) =>
                      setNewDocument({ ...newDocument, content: e.target.value })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  취소
                </Button>
                <Button onClick={handleCreateDocument} disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      저장 중...
                    </>
                  ) : (
                    "저장"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                전체 문서
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{statistics?.totalDocuments || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    활성 {statistics?.activeDocuments || 0}개
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                임베딩 청크
              </CardTitle>
              <Brain className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{statistics?.totalChunks || 0}</div>
                  <p className="text-xs text-muted-foreground">벡터 검색 가능</p>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                카테고리
              </CardTitle>
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {Object.keys(statistics?.categoryCounts || {}).length}
                  </div>
                  <p className="text-xs text-muted-foreground">분류 체계</p>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                평균 정확도
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                --
              </div>
              <p className="text-xs text-muted-foreground">AI 응답 기준</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="문서 검색..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={!selectedCategory ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(undefined)}
              >
                전체
              </Button>
              {allCategories.map((cat) => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {documentsError && (
        <Card className="border-destructive">
          <CardContent className="py-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>문서를 불러오는 중 오류가 발생했습니다.</span>
              <Button variant="outline" size="sm" onClick={() => refetchDocuments()}>
                다시 시도
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {documentsLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="space-y-3">
                  <Skeleton className="h-6 w-1/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Documents List */}
      {!documentsLoading && !documentsError && (
        <AnimatePresence mode="popLayout">
          <div className="space-y-4">
            {documents?.map((doc, index) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.05 }}
                layout
              >
                <Card className={`hover:bg-muted/50 transition-colors ${!doc.is_active ? "opacity-60" : ""}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg">{doc.title}</h3>
                          {getSourceBadge(doc.source_type)}
                          {doc.category && (
                            <Badge variant="secondary">{doc.category}</Badge>
                          )}
                          {!doc.is_active && (
                            <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-500/20">
                              비활성
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground text-sm line-clamp-2 mb-3">
                          {doc.content}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {doc.tags && doc.tags.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Tag className="h-3 w-3" />
                              {doc.tags.join(", ")}
                            </span>
                          )}
                          <span>버전 {doc.version}</span>
                          <span>청크 {doc.chunk_count || 0}개</span>
                          <span>
                            수정:{" "}
                            {new Date(doc.updated_at).toLocaleDateString("ko-KR")}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={doc.is_active}
                          onCheckedChange={() => handleToggleActive(doc)}
                        />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(doc)}>
                              <Edit className="mr-2 h-4 w-4" />
                              수정
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleRegenerateEmbeddings(doc.id)}
                              disabled={regenerateEmbeddingsMutation.isPending}
                            >
                              <Brain className="mr-2 h-4 w-4" />
                              임베딩 재생성
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => openDeleteDialog(doc)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              삭제
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* Empty State */}
      {!documentsLoading && !documentsError && documents?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-lg mb-2">문서가 없습니다</h3>
            <p className="text-muted-foreground mb-4">
              검색 조건에 맞는 문서가 없거나 아직 등록된 문서가 없습니다.
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              첫 문서 추가하기
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>문서 수정</DialogTitle>
            <DialogDescription>
              문서를 수정합니다. 내용 변경 시 자동으로 임베딩이 재생성됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>제목</Label>
              <Input
                placeholder="문서 제목을 입력하세요"
                value={newDocument.title}
                onChange={(e) =>
                  setNewDocument({ ...newDocument, title: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>카테고리</Label>
              <Select
                value={newDocument.category}
                onValueChange={(value) =>
                  setNewDocument({ ...newDocument, category: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="카테고리 선택" />
                </SelectTrigger>
                <SelectContent>
                  {allCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>태그</Label>
              <Input
                placeholder="쉼표로 구분하여 입력 (예: 라식, 가격, 비용)"
                value={newDocument.tags}
                onChange={(e) =>
                  setNewDocument({ ...newDocument, tags: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>내용</Label>
              <Textarea
                placeholder="문서 내용을 입력하세요. 마크다운 형식을 지원합니다."
                rows={10}
                value={newDocument.content}
                onChange={(e) =>
                  setNewDocument({ ...newDocument, content: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleUpdateDocument} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  저장 중...
                </>
              ) : (
                "저장"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>문서 삭제</DialogTitle>
            <DialogDescription>
              &ldquo;{selectedDocument?.title}&rdquo; 문서를 삭제하시겠습니까?
              <br />
              이 작업은 되돌릴 수 없으며, 관련된 임베딩도 함께 삭제됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteDocument}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  삭제 중...
                </>
              ) : (
                "삭제"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
