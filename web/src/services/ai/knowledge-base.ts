import { createServiceClient } from "@/lib/supabase/server";
import { KnowledgeDocument, Insertable } from "@/lib/supabase/types";
import { generateEmbedding, chunkText, generateEmbeddings } from "./embeddings";

export interface CreateDocumentInput {
  tenantId: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  sourceType?: "manual" | "escalation" | "import";
  sourceId?: string;
  createdBy?: string;
}

export interface UpdateDocumentInput {
  title?: string;
  content?: string;
  category?: string;
  tags?: string[];
  isActive?: boolean;
}

/**
 * Knowledge Base Service
 * Manages documents and their vector embeddings
 */
export const knowledgeBaseService = {
  /**
   * Create a new knowledge document with embeddings
   */
  async createDocument(input: CreateDocumentInput): Promise<KnowledgeDocument> {
    const supabase = await createServiceClient();

    // Create the document
    const { data: document, error: docError } = await (supabase
      .from("knowledge_documents") as any)
      .insert({
        tenant_id: input.tenantId,
        title: input.title,
        content: input.content,
        category: input.category,
        tags: input.tags || [],
        source_type: input.sourceType || "manual",
        source_id: input.sourceId,
        created_by: input.createdBy,
        is_active: true,
        version: 1,
      })
      .select()
      .single();

    if (docError) throw docError;

    // Generate embeddings for the document
    await this.generateDocumentEmbeddings(document.id, input.content);

    return document;
  },

  /**
   * Update a knowledge document
   */
  async updateDocument(
    documentId: string,
    updates: UpdateDocumentInput
  ): Promise<KnowledgeDocument> {
    const supabase = await createServiceClient();

    // Get current version
    const { data: current } = await (supabase
      .from("knowledge_documents") as any)
      .select("version, content")
      .eq("id", documentId)
      .single();

    // Update document
    const { data: document, error } = await (supabase
      .from("knowledge_documents") as any)
      .update({
        ...updates,
        version: (current?.version || 0) + 1,
      })
      .eq("id", documentId)
      .select()
      .single();

    if (error) throw error;

    // Regenerate embeddings if content changed
    if (updates.content && updates.content !== current?.content) {
      await this.regenerateEmbeddings(documentId, updates.content);
    }

    return document;
  },

  /**
   * Delete a knowledge document
   */
  async deleteDocument(documentId: string): Promise<void> {
    const supabase = await createServiceClient();

    // Embeddings will be deleted via CASCADE
    const { error } = await (supabase
      .from("knowledge_documents") as any)
      .delete()
      .eq("id", documentId);

    if (error) throw error;
  },

  /**
   * Soft delete (deactivate) a document
   */
  async deactivateDocument(documentId: string): Promise<void> {
    const supabase = await createServiceClient();

    const { error } = await (supabase
      .from("knowledge_documents") as any)
      .update({ is_active: false })
      .eq("id", documentId);

    if (error) throw error;
  },

  /**
   * Generate embeddings for a document
   */
  async generateDocumentEmbeddings(
    documentId: string,
    content: string
  ): Promise<void> {
    const supabase = await createServiceClient();

    // Chunk the content
    const chunks = chunkText(content, 500, 50);

    // Generate embeddings in batches
    const batchSize = 10;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const embeddings = await generateEmbeddings(batch);

      // Insert embeddings
      const embeddingRecords = embeddings.map((emb, idx) => ({
        document_id: documentId,
        chunk_index: i + idx,
        chunk_text: batch[idx],
        embedding: emb.embedding,
      }));

      const { error } = await (supabase
        .from("knowledge_embeddings") as any)
        .insert(embeddingRecords);

      if (error) {
        console.error("Error inserting embeddings:", error);
        throw error;
      }
    }
  },

  /**
   * Regenerate embeddings for an updated document
   */
  async regenerateEmbeddings(
    documentId: string,
    newContent: string
  ): Promise<void> {
    const supabase = await createServiceClient();

    // Delete old embeddings
    await (supabase
      .from("knowledge_embeddings") as any)
      .delete()
      .eq("document_id", documentId);

    // Generate new embeddings
    await this.generateDocumentEmbeddings(documentId, newContent);
  },

  /**
   * Get all documents for a tenant
   */
  async getDocuments(
    tenantId: string,
    options?: {
      category?: string;
      tags?: string[];
      isActive?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<KnowledgeDocument[]> {
    const supabase = await createServiceClient();

    let query = (supabase
      .from("knowledge_documents") as any)
      .select("*")
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false });

    if (options?.category) {
      query = query.eq("category", options.category);
    }

    if (options?.tags && options.tags.length > 0) {
      query = query.overlaps("tags", options.tags);
    }

    if (options?.isActive !== undefined) {
      query = query.eq("is_active", options.isActive);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(
        options.offset,
        options.offset + (options.limit || 20) - 1
      );
    }

    const { data, error } = await query;

    if (error) throw error;

    return data || [];
  },

  /**
   * Get a single document by ID
   */
  async getDocument(documentId: string): Promise<KnowledgeDocument | null> {
    const supabase = await createServiceClient();

    const { data, error } = await (supabase
      .from("knowledge_documents") as any)
      .select("*")
      .eq("id", documentId)
      .single();

    if (error) throw error;

    return data;
  },

  /**
   * Get all categories for a tenant
   */
  async getCategories(tenantId: string): Promise<string[]> {
    const supabase = await createServiceClient();

    const { data, error } = await (supabase
      .from("knowledge_documents") as any)
      .select("category")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .not("category", "is", null);

    if (error) throw error;

    // Get unique categories
    const categories = [...new Set(data?.map((d) => d.category) || [])];
    return categories.filter(Boolean) as string[];
  },

  /**
   * Import documents from escalation (learning from human responses)
   */
  async importFromEscalation(
    escalationId: string,
    tenantId: string,
    question: string,
    answer: string,
    createdBy?: string
  ): Promise<KnowledgeDocument> {
    // Generate paraphrased questions for better retrieval
    const content = `## 질문
${question}

## 답변
${answer}

## 관련 질문 예시
- ${question}
`;

    return this.createDocument({
      tenantId,
      title: `FAQ: ${question.slice(0, 50)}...`,
      content,
      category: "FAQ",
      tags: ["에스컬레이션", "학습"],
      sourceType: "escalation",
      sourceId: escalationId,
      createdBy,
    });
  },

  /**
   * Bulk import documents (for initial setup)
   */
  async bulkImport(
    tenantId: string,
    documents: { title: string; content: string; category?: string }[],
    createdBy?: string
  ): Promise<number> {
    let successCount = 0;

    for (const doc of documents) {
      try {
        await this.createDocument({
          tenantId,
          title: doc.title,
          content: doc.content,
          category: doc.category,
          sourceType: "import",
          createdBy,
        });
        successCount++;
      } catch (error) {
        console.error(`Failed to import document: ${doc.title}`, error);
      }
    }

    return successCount;
  },

  /**
   * Get document statistics for a tenant
   */
  async getStatistics(tenantId: string): Promise<{
    totalDocuments: number;
    activeDocuments: number;
    totalChunks: number;
    categoryCounts: Record<string, number>;
  }> {
    const supabase = await createServiceClient();

    // Get document counts
    const { data: docs } = await (supabase
      .from("knowledge_documents") as any)
      .select("id, is_active, category")
      .eq("tenant_id", tenantId);

    const totalDocuments = docs?.length || 0;
    const activeDocuments = docs?.filter((d) => d.is_active).length || 0;

    // Get chunk count
    const activeDocIds = docs?.filter((d) => d.is_active).map((d) => d.id) || [];
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
    docs
      ?.filter((d) => d.is_active && d.category)
      .forEach((d) => {
        categoryCounts[d.category!] = (categoryCounts[d.category!] || 0) + 1;
      });

    return {
      totalDocuments,
      activeDocuments,
      totalChunks,
      categoryCounts,
    };
  },
};

export default knowledgeBaseService;
