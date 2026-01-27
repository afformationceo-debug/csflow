/**
 * Upstash Vector Service
 * RAG 벡터 검색을 위한 Upstash Vector 연동
 */

import { Index } from "@upstash/vector";

// Types
export interface VectorDocument {
  id: string;
  tenantId: string;
  content: string;
  metadata: {
    title?: string;
    category?: string;
    tags?: string[];
    sourceType?: string;
    documentId?: string;
    chunkIndex?: number;
    [key: string]: unknown;
  };
}

export interface VectorSearchResult {
  id: string;
  score: number;
  content: string;
  metadata: VectorDocument["metadata"];
}

export interface VectorSearchOptions {
  topK?: number;
  filter?: string;
  includeMetadata?: boolean;
  includeVectors?: boolean;
  minScore?: number;
}

class UpstashVectorService {
  private index: Index | null = null;

  private getIndex(): Index {
    if (!this.index) {
      const url = process.env.UPSTASH_VECTOR_REST_URL;
      const token = process.env.UPSTASH_VECTOR_REST_TOKEN;

      if (!url || !token) {
        throw new Error("UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_TOKEN are required");
      }

      this.index = new Index({
        url,
        token,
      });
    }
    return this.index;
  }

  /**
   * 임베딩 생성 (OpenAI API 사용)
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to generate embedding: ${error}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  /**
   * 벡터 업서트 (단일)
   */
  async upsertVector(document: VectorDocument): Promise<void> {
    const index = this.getIndex();
    const embedding = await this.generateEmbedding(document.content);

    await index.upsert({
      id: document.id,
      vector: embedding,
      metadata: {
        tenantId: document.tenantId,
        content: document.content,
        ...document.metadata,
      },
    });
  }

  /**
   * 벡터 배치 업서트
   */
  async upsertVectorsBatch(documents: VectorDocument[]): Promise<void> {
    const index = this.getIndex();

    // 임베딩 병렬 생성 (10개씩 배치)
    const batchSize = 10;
    const vectors: Array<{
      id: string;
      vector: number[];
      metadata: Record<string, unknown>;
    }> = [];

    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      const embeddings = await Promise.all(batch.map((doc) => this.generateEmbedding(doc.content)));

      for (let j = 0; j < batch.length; j++) {
        vectors.push({
          id: batch[j].id,
          vector: embeddings[j],
          metadata: {
            tenantId: batch[j].tenantId,
            content: batch[j].content,
            ...batch[j].metadata,
          },
        });
      }
    }

    // Upstash Vector에 배치 업서트
    await index.upsert(vectors);
  }

  /**
   * 유사도 검색
   */
  async search(
    query: string,
    tenantId: string,
    options: VectorSearchOptions = {}
  ): Promise<VectorSearchResult[]> {
    const index = this.getIndex();
    const {
      topK = 10,
      filter,
      includeMetadata = true,
      minScore = 0.5,
    } = options;

    // 쿼리 임베딩 생성
    const queryEmbedding = await this.generateEmbedding(query);

    // 테넌트 필터 적용
    const tenantFilter = `tenantId = '${tenantId}'`;
    const finalFilter = filter ? `${tenantFilter} AND ${filter}` : tenantFilter;

    // 벡터 검색 실행
    const results = await index.query({
      vector: queryEmbedding,
      topK,
      filter: finalFilter,
      includeMetadata,
      includeVectors: false,
    });

    // 결과 변환 및 필터링
    return results
      .filter((r) => r.score >= minScore)
      .map((r) => ({
        id: r.id as string,
        score: r.score,
        content: (r.metadata?.content as string) || "",
        metadata: {
          title: r.metadata?.title as string,
          category: r.metadata?.category as string,
          tags: r.metadata?.tags as string[],
          sourceType: r.metadata?.sourceType as string,
          documentId: r.metadata?.documentId as string,
          chunkIndex: r.metadata?.chunkIndex as number,
        },
      }));
  }

  /**
   * 하이브리드 검색 (벡터 + 키워드)
   */
  async hybridSearch(
    query: string,
    tenantId: string,
    options: VectorSearchOptions & { keywords?: string[] } = {}
  ): Promise<VectorSearchResult[]> {
    const { keywords = [], ...vectorOptions } = options;

    // 벡터 검색 결과
    const vectorResults = await this.search(query, tenantId, {
      ...vectorOptions,
      topK: (vectorOptions.topK || 10) * 2, // 더 많이 가져와서 리랭킹
    });

    // 키워드 매칭 점수 추가
    if (keywords.length > 0) {
      const keywordPattern = new RegExp(keywords.join("|"), "gi");

      for (const result of vectorResults) {
        const keywordMatches = (result.content.match(keywordPattern) || []).length;
        const keywordBoost = keywordMatches * 0.1; // 매칭당 0.1 점수 추가
        result.score = Math.min(1, result.score + keywordBoost);
      }

      // 점수로 재정렬
      vectorResults.sort((a, b) => b.score - a.score);
    }

    // 요청한 topK만큼만 반환
    return vectorResults.slice(0, options.topK || 10);
  }

  /**
   * 벡터 삭제
   */
  async deleteVector(id: string): Promise<void> {
    const index = this.getIndex();
    await index.delete(id);
  }

  /**
   * 벡터 배치 삭제
   */
  async deleteVectorsBatch(ids: string[]): Promise<void> {
    const index = this.getIndex();
    await index.delete(ids);
  }

  /**
   * 테넌트별 모든 벡터 삭제
   */
  async deleteByTenant(tenantId: string): Promise<number> {
    const index = this.getIndex();

    // Upstash Vector는 필터 기반 삭제를 지원하지 않으므로
    // 먼저 모든 벡터를 조회한 후 삭제해야 함
    // 실제 프로덕션에서는 메타데이터 테이블에서 ID 목록을 관리하는 것이 좋음

    // 임시 구현: 빈 쿼리로 모든 벡터 조회 (주의: 대규모 데이터에서는 비효율적)
    const results = await index.query({
      vector: new Array(1536).fill(0), // 빈 벡터
      topK: 10000,
      filter: `tenantId = '${tenantId}'`,
      includeMetadata: false,
    });

    const ids = results.map((r) => r.id as string);
    if (ids.length > 0) {
      await index.delete(ids);
    }

    return ids.length;
  }

  /**
   * 인덱스 통계 조회
   */
  async getIndexStats(): Promise<{
    vectorCount: number;
    dimension: number;
  }> {
    const index = this.getIndex();
    const info = await index.info();

    return {
      vectorCount: info.vectorCount,
      dimension: info.dimension,
    };
  }

  /**
   * 문서 청크 분할 및 벡터화
   */
  async indexDocument(
    tenantId: string,
    documentId: string,
    content: string,
    metadata: VectorDocument["metadata"],
    options: { chunkSize?: number; overlap?: number } = {}
  ): Promise<string[]> {
    const { chunkSize = 500, overlap = 50 } = options;

    // 텍스트를 청크로 분할
    const chunks: string[] = [];
    let start = 0;

    while (start < content.length) {
      const end = Math.min(start + chunkSize, content.length);
      chunks.push(content.slice(start, end));
      start = end - overlap;

      if (start >= content.length - overlap) break;
    }

    // 각 청크를 벡터로 저장
    const vectorDocuments: VectorDocument[] = chunks.map((chunk, index) => ({
      id: `${documentId}_chunk_${index}`,
      tenantId,
      content: chunk,
      metadata: {
        ...metadata,
        documentId,
        chunkIndex: index,
        totalChunks: chunks.length,
      },
    }));

    await this.upsertVectorsBatch(vectorDocuments);

    return vectorDocuments.map((d) => d.id);
  }
}

export const upstashVectorService = new UpstashVectorService();
