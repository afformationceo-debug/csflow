import { createServiceClient } from "@/lib/supabase/server";
import { generateEmbedding } from "./embeddings";

export interface RetrievedDocument {
  id: string;
  documentId: string;
  title: string;
  chunkText: string;
  similarity: number;
  category?: string;
  tags?: string[];
}

export interface RetrievalOptions {
  tenantId: string;
  query: string;
  topK?: number;
  threshold?: number;
  categories?: string[];
  tags?: string[];
}

/**
 * Retrieve relevant documents using hybrid search
 * Combines vector similarity with full-text search using RRF (Reciprocal Rank Fusion)
 */
export async function retrieveDocuments(
  options: RetrievalOptions
): Promise<RetrievedDocument[]> {
  const {
    tenantId,
    query,
    topK = 5,
    threshold = 0.7,
    categories,
    tags,
  } = options;

  const supabase = await createServiceClient();

  // Generate embedding for query
  const { embedding } = await generateEmbedding(query);

  // Vector search using the match_documents function
  const { data: vectorResults, error: vectorError } = await (supabase as any).rpc(
    "match_documents",
    {
      query_embedding: embedding,
      p_tenant_id: tenantId,
      match_threshold: threshold,
      match_count: topK * 2, // Get more for reranking
    }
  );

  if (vectorError) {
    console.error("Vector search error:", vectorError);
    throw vectorError;
  }

  // Get document metadata for the results
  const documentIds = [
    ...new Set(vectorResults?.map((r: { document_id: string }) => r.document_id) || []),
  ];

  if (documentIds.length === 0) {
    return [];
  }

  // Fetch document details
  let documentsQuery = (supabase
    .from("knowledge_documents") as any)
    .select("id, title, category, tags")
    .in("id", documentIds);

  if (categories && categories.length > 0) {
    documentsQuery = documentsQuery.in("category", categories);
  }

  if (tags && tags.length > 0) {
    documentsQuery = documentsQuery.overlaps("tags", tags);
  }

  const { data: documents, error: docError } = await documentsQuery;

  if (docError) {
    console.error("Document fetch error:", docError);
    throw docError;
  }

  // Create document lookup map
  const docMap = new Map<string, { id: string; title: string; category?: string; tags?: string[] }>(
    documents?.map((d: { id: string; title: string; category?: string; tags?: string[] }) => [d.id, d]) || []
  );

  // Combine results with document metadata
  const results: RetrievedDocument[] = (vectorResults || [])
    .filter((r: { document_id: string }) => docMap.has(r.document_id))
    .map((r: { id: string; document_id: string; chunk_text: string; similarity: number }) => {
      const doc = docMap.get(r.document_id)!;
      return {
        id: r.id,
        documentId: r.document_id,
        title: doc.title,
        chunkText: r.chunk_text,
        similarity: r.similarity,
        category: doc.category,
        tags: doc.tags,
      };
    })
    .slice(0, topK);

  return results;
}

/**
 * Full-text search for knowledge documents
 */
export async function fullTextSearch(
  tenantId: string,
  query: string,
  limit: number = 10
): Promise<{ id: string; title: string; content: string; rank: number }[]> {
  const supabase = await createServiceClient();

  // PostgreSQL full-text search
  const { data, error } = await (supabase
    .from("knowledge_documents") as any)
    .select("id, title, content")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .textSearch("content", query, {
      type: "websearch",
      config: "korean", // Use Korean text search config
    })
    .limit(limit);

  if (error) {
    console.error("Full-text search error:", error);
    return [];
  }

  return (data || []).map((d, index) => ({
    ...d,
    rank: 1 / (index + 1), // Simple rank based on position
  }));
}

/**
 * Hybrid search combining vector and full-text with RRF
 */
export async function hybridSearch(
  options: RetrievalOptions
): Promise<RetrievedDocument[]> {
  const { tenantId, query, topK = 5, threshold = 0.7 } = options;

  // Run both searches in parallel
  const [vectorResults, textResults] = await Promise.all([
    retrieveDocuments({ ...options, topK: topK * 2 }),
    fullTextSearch(tenantId, query, topK * 2),
  ]);

  // RRF (Reciprocal Rank Fusion)
  const k = 60; // RRF constant
  const scores = new Map<string, { score: number; doc: RetrievedDocument }>();

  // Score from vector search
  vectorResults.forEach((doc, rank) => {
    const rrfScore = 1 / (k + rank + 1);
    scores.set(doc.documentId, {
      score: rrfScore,
      doc,
    });
  });

  // Add scores from full-text search
  textResults.forEach((result, rank) => {
    const rrfScore = 1 / (k + rank + 1);
    const existing = scores.get(result.id);

    if (existing) {
      existing.score += rrfScore;
    } else {
      // Create placeholder for text-only results
      scores.set(result.id, {
        score: rrfScore,
        doc: {
          id: result.id,
          documentId: result.id,
          title: result.title,
          chunkText: result.content.slice(0, 500),
          similarity: 0,
        },
      });
    }
  });

  // Sort by combined score and return top K
  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((item) => item.doc);
}
