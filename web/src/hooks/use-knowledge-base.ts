import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { KnowledgeDocument } from "@/lib/supabase/types";

export interface KnowledgeDocumentItem {
  id: string;
  title: string;
  content: string;
  category: string | null;
  tags: string[];
  source_type: "manual" | "escalation" | "import";
  source_id: string | null;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  chunk_count?: number;
}

export interface KnowledgeDocumentFilters {
  tenantId: string;
  category?: string;
  tags?: string[];
  isActive?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CreateDocumentInput {
  tenantId: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
}

export interface UpdateDocumentInput {
  title?: string;
  content?: string;
  category?: string;
  tags?: string[];
  isActive?: boolean;
}

// Query keys
const knowledgeKeys = {
  all: ["knowledge"] as const,
  documents: (filters: KnowledgeDocumentFilters) =>
    [...knowledgeKeys.all, "documents", filters] as const,
  document: (id: string) => [...knowledgeKeys.all, "document", id] as const,
  categories: (tenantId: string) =>
    [...knowledgeKeys.all, "categories", tenantId] as const,
  statistics: (tenantId: string) =>
    [...knowledgeKeys.all, "statistics", tenantId] as const,
};

/**
 * Hook to fetch knowledge documents with filters
 */
export function useKnowledgeDocuments(
  filters: KnowledgeDocumentFilters,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: knowledgeKeys.documents(filters),
    queryFn: async () => {
      const supabase = createClient();

      let query = (supabase.from("knowledge_documents") as any)
        .select(`
          *,
          embeddings:knowledge_chunks(count)
        `)
        .eq("tenant_id", filters.tenantId)
        .order("updated_at", { ascending: false });

      if (filters.category) {
        query = query.eq("category", filters.category);
      }

      if (filters.isActive !== undefined) {
        query = query.eq("is_active", filters.isActive);
      }

      if (filters.search) {
        query = query.ilike("title", `%${filters.search}%`);
      }

      if (filters.tags && filters.tags.length > 0) {
        query = query.overlaps("tags", filters.tags);
      }

      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      if (filters.offset) {
        query = query.range(
          filters.offset,
          filters.offset + (filters.limit || 20) - 1
        );
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transform to include chunk count
      return ((data as KnowledgeDocumentItem[]) || []).map((doc) => ({
        ...doc,
        chunk_count: Array.isArray((doc as any).embeddings)
          ? (doc as any).embeddings[0]?.count || 0
          : 0,
      }));
    },
    staleTime: 30000, // 30 seconds
    enabled: options?.enabled !== false, // Default to true if not specified
  });
}

/**
 * Hook to fetch a single knowledge document
 */
export function useKnowledgeDocument(documentId: string | null) {
  return useQuery({
    queryKey: knowledgeKeys.document(documentId || ""),
    queryFn: async () => {
      if (!documentId) return null;

      const supabase = createClient();

      const { data, error } = await (supabase
        .from("knowledge_documents") as any)
        .select("*")
        .eq("id", documentId)
        .single();

      if (error) throw error;

      return data as KnowledgeDocumentItem;
    },
    enabled: !!documentId,
  });
}

/**
 * Hook to fetch categories for a tenant
 */
export function useKnowledgeCategories(
  tenantId: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: knowledgeKeys.categories(tenantId),
    queryFn: async () => {
      const supabase = createClient();

      const { data, error } = await (supabase
        .from("knowledge_documents") as any)
        .select("category")
        .eq("tenant_id", tenantId)
        .not("category", "is", null);

      if (error) throw error;

      // Get unique categories
      const categories = [...new Set((data as { category: string }[])?.map((d) => d.category) || [])];
      return categories.filter(Boolean) as string[];
    },
    staleTime: 60000, // 1 minute
    enabled: options?.enabled !== false && !!tenantId,
  });
}

/**
 * Hook to fetch knowledge base statistics
 */
export function useKnowledgeStatistics(
  tenantId: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: knowledgeKeys.statistics(tenantId),
    queryFn: async () => {
      const supabase = createClient();

      // Get document counts
      const { data: docs, error: docsError } = await (supabase
        .from("knowledge_documents") as any)
        .select("id, is_active, category")
        .eq("tenant_id", tenantId);

      if (docsError) throw docsError;

      const docsList = docs as { id: string; is_active: boolean; category: string }[] | null;
      const totalDocuments = docsList?.length || 0;
      const activeDocuments = docsList?.filter((d) => d.is_active).length || 0;

      // Get chunk count for active documents
      const activeDocIds = docsList?.filter((d) => d.is_active).map((d) => d.id) || [];
      let totalChunks = 0;

      if (activeDocIds.length > 0) {
        const { count } = await (supabase
          .from("knowledge_embeddings") as any)
          .select("*", { count: "exact", head: true })
          .in("document_id", activeDocIds);
        totalChunks = count || 0;
      }

      // Category counts
      const categoryCounts: Record<string, number> = {};
      docsList
        ?.filter((d) => d.is_active && d.category)
        .forEach((d) => {
          categoryCounts[d.category] = (categoryCounts[d.category] || 0) + 1;
        });

      return {
        totalDocuments,
        activeDocuments,
        totalChunks,
        categoryCounts,
      };
    },
    staleTime: 60000, // 1 minute
    enabled: options?.enabled !== false && !!tenantId,
  });
}

/**
 * Hook to create a knowledge document
 */
export function useCreateKnowledgeDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateDocumentInput) => {
      const response = await fetch("/api/knowledge/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create document");
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: [...knowledgeKeys.all, "documents"],
      });
      queryClient.invalidateQueries({
        queryKey: knowledgeKeys.categories(variables.tenantId),
      });
      queryClient.invalidateQueries({
        queryKey: knowledgeKeys.statistics(variables.tenantId),
      });
    },
  });
}

/**
 * Hook to update a knowledge document
 */
export function useUpdateKnowledgeDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      documentId,
      updates,
    }: {
      documentId: string;
      updates: UpdateDocumentInput;
    }) => {
      const response = await fetch(`/api/knowledge/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update document");
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: [...knowledgeKeys.all, "documents"],
      });
      queryClient.invalidateQueries({
        queryKey: knowledgeKeys.document(data.id),
      });
    },
  });
}

/**
 * Hook to delete a knowledge document
 */
export function useDeleteKnowledgeDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: string) => {
      const response = await fetch(`/api/knowledge/documents/${documentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete document");
      }

      return documentId;
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: [...knowledgeKeys.all],
      });
    },
  });
}

/**
 * Hook to regenerate embeddings for a document
 */
export function useRegenerateEmbeddings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: string) => {
      const response = await fetch(
        `/api/knowledge/documents/${documentId}/embeddings`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to regenerate embeddings");
      }

      return response.json();
    },
    onSuccess: (_, documentId) => {
      queryClient.invalidateQueries({
        queryKey: knowledgeKeys.document(documentId),
      });
      queryClient.invalidateQueries({
        queryKey: [...knowledgeKeys.all, "statistics"],
      });
    },
  });
}
