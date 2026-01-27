/**
 * Performance Optimization Service
 * 성능 최적화 및 모니터링
 */

import { Redis } from "@upstash/redis";

// Types
export interface CacheConfig {
  prefix: string;
  ttlSeconds: number;
  staleWhileRevalidate?: number;
}

export interface PerformanceMetrics {
  endpoint: string;
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestCount: number;
  errorRate: number;
  cacheHitRate: number;
}

export interface QueryMetrics {
  query: string;
  avgExecutionTime: number;
  executionCount: number;
  slowestExecution: number;
}

export interface OptimizationRecommendation {
  type: "cache" | "query" | "index" | "code";
  priority: "high" | "medium" | "low";
  description: string;
  impact: string;
  implementation: string;
}

class PerformanceOptimizationService {
  private redis: Redis | null = null;
  private metricsBuffer: Map<string, number[]> = new Map();

  private getRedis(): Redis | null {
    if (!this.redis) {
      const url = process.env.UPSTASH_REDIS_REST_URL;
      const token = process.env.UPSTASH_REDIS_REST_TOKEN;
      if (url && token) {
        this.redis = new Redis({ url, token });
      }
    }
    return this.redis;
  }

  /**
   * 캐시 설정 - 스마트 캐싱 전략
   */
  private getCacheConfigs(): Record<string, CacheConfig> {
    return {
      // RAG 검색 결과 캐싱 (자주 묻는 질문)
      "rag:search": {
        prefix: "rag:search:",
        ttlSeconds: 300, // 5분
        staleWhileRevalidate: 60, // 1분 동안 stale 허용
      },
      // 고객 프로필 캐싱
      "customer:profile": {
        prefix: "customer:profile:",
        ttlSeconds: 600, // 10분
      },
      // 테넌트 설정 캐싱
      "tenant:config": {
        prefix: "tenant:config:",
        ttlSeconds: 3600, // 1시간
      },
      // 지식베이스 문서 캐싱
      "knowledge:doc": {
        prefix: "knowledge:doc:",
        ttlSeconds: 1800, // 30분
      },
      // 번역 결과 캐싱
      "translation": {
        prefix: "translation:",
        ttlSeconds: 86400, // 24시간
      },
      // API 응답 캐싱
      "api:response": {
        prefix: "api:response:",
        ttlSeconds: 60, // 1분
      },
    };
  }

  /**
   * 캐시 저장
   */
  async cacheSet<T>(
    key: string,
    value: T,
    configKey: keyof ReturnType<typeof this.getCacheConfigs>
  ): Promise<boolean> {
    const redis = this.getRedis();
    if (!redis) return false;

    const config = this.getCacheConfigs()[configKey];
    const fullKey = `${config.prefix}${key}`;

    try {
      await redis.set(fullKey, JSON.stringify(value), {
        ex: config.ttlSeconds,
      });
      return true;
    } catch (error) {
      console.error("Cache set error:", error);
      return false;
    }
  }

  /**
   * 캐시 조회
   */
  async cacheGet<T>(
    key: string,
    configKey: keyof ReturnType<typeof this.getCacheConfigs>
  ): Promise<T | null> {
    const redis = this.getRedis();
    if (!redis) return null;

    const config = this.getCacheConfigs()[configKey];
    const fullKey = `${config.prefix}${key}`;

    try {
      const result = await redis.get(fullKey);
      if (result) {
        return typeof result === "string" ? JSON.parse(result) : (result as T);
      }
      return null;
    } catch (error) {
      console.error("Cache get error:", error);
      return null;
    }
  }

  /**
   * 캐시 삭제
   */
  async cacheDelete(
    key: string,
    configKey: keyof ReturnType<typeof this.getCacheConfigs>
  ): Promise<boolean> {
    const redis = this.getRedis();
    if (!redis) return false;

    const config = this.getCacheConfigs()[configKey];
    const fullKey = `${config.prefix}${key}`;

    try {
      await redis.del(fullKey);
      return true;
    } catch (error) {
      console.error("Cache delete error:", error);
      return false;
    }
  }

  /**
   * 패턴 기반 캐시 삭제
   */
  async cacheDeletePattern(pattern: string): Promise<number> {
    const redis = this.getRedis();
    if (!redis) return 0;

    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      return keys.length;
    } catch (error) {
      console.error("Cache delete pattern error:", error);
      return 0;
    }
  }

  /**
   * 응답 시간 측정 및 기록
   */
  async recordResponseTime(endpoint: string, responseTimeMs: number): Promise<void> {
    const redis = this.getRedis();
    const key = `metrics:response_time:${endpoint}`;

    // 메모리 버퍼에 추가
    if (!this.metricsBuffer.has(key)) {
      this.metricsBuffer.set(key, []);
    }
    this.metricsBuffer.get(key)!.push(responseTimeMs);

    // 버퍼가 100개 이상이면 Redis로 플러시
    if (this.metricsBuffer.get(key)!.length >= 100) {
      await this.flushMetricsBuffer(key);
    }

    // Redis에도 직접 기록 (실시간 모니터링용)
    if (redis) {
      try {
        await redis.lpush(`${key}:recent`, responseTimeMs);
        await redis.ltrim(`${key}:recent`, 0, 999); // 최근 1000개만 유지
      } catch (error) {
        console.error("Record response time error:", error);
      }
    }
  }

  /**
   * 메트릭 버퍼 플러시
   */
  private async flushMetricsBuffer(key: string): Promise<void> {
    const redis = this.getRedis();
    if (!redis) return;

    const buffer = this.metricsBuffer.get(key);
    if (!buffer || buffer.length === 0) return;

    try {
      // 통계 계산
      const sorted = [...buffer].sort((a, b) => a - b);
      const avg = buffer.reduce((a, b) => a + b, 0) / buffer.length;
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];

      // 집계 데이터 저장
      const timestamp = Math.floor(Date.now() / 60000) * 60000; // 분 단위
      await redis.hset(`${key}:aggregated:${timestamp}`, {
        avg,
        p95,
        p99,
        count: buffer.length,
      });

      // 집계 데이터 TTL 설정 (7일)
      await redis.expire(`${key}:aggregated:${timestamp}`, 604800);

      // 버퍼 클리어
      this.metricsBuffer.set(key, []);
    } catch (error) {
      console.error("Flush metrics buffer error:", error);
    }
  }

  /**
   * 성능 메트릭 조회
   */
  async getPerformanceMetrics(
    endpoint: string,
    periodMinutes: number = 60
  ): Promise<PerformanceMetrics> {
    const redis = this.getRedis();
    const key = `metrics:response_time:${endpoint}`;

    const defaultMetrics: PerformanceMetrics = {
      endpoint,
      avgResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      requestCount: 0,
      errorRate: 0,
      cacheHitRate: 0,
    };

    if (!redis) return defaultMetrics;

    try {
      // 최근 데이터 가져오기
      const recentData = await redis.lrange(`${key}:recent`, 0, -1);
      if (recentData.length === 0) return defaultMetrics;

      const times = recentData.map((t) => Number(t));
      const sorted = [...times].sort((a, b) => a - b);

      return {
        endpoint,
        avgResponseTime: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
        p95ResponseTime: sorted[Math.floor(sorted.length * 0.95)] || 0,
        p99ResponseTime: sorted[Math.floor(sorted.length * 0.99)] || 0,
        requestCount: times.length,
        errorRate: 0, // 별도 에러 카운터에서 계산
        cacheHitRate: 0, // 별도 캐시 히트 카운터에서 계산
      };
    } catch (error) {
      console.error("Get performance metrics error:", error);
      return defaultMetrics;
    }
  }

  /**
   * 캐시 히트/미스 기록
   */
  async recordCacheAccess(key: string, hit: boolean): Promise<void> {
    const redis = this.getRedis();
    if (!redis) return;

    const today = new Date().toISOString().split("T")[0];
    const metricsKey = `metrics:cache:${today}`;

    try {
      if (hit) {
        await redis.hincrby(metricsKey, "hits", 1);
      } else {
        await redis.hincrby(metricsKey, "misses", 1);
      }
      await redis.expire(metricsKey, 604800); // 7일 TTL
    } catch (error) {
      console.error("Record cache access error:", error);
    }
  }

  /**
   * 캐시 히트율 조회
   */
  async getCacheHitRate(days: number = 1): Promise<number> {
    const redis = this.getRedis();
    if (!redis) return 0;

    try {
      let totalHits = 0;
      let totalMisses = 0;

      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];
        const metricsKey = `metrics:cache:${dateStr}`;

        const data = await redis.hgetall(metricsKey);
        if (data) {
          totalHits += Number(data.hits || 0);
          totalMisses += Number(data.misses || 0);
        }
      }

      const total = totalHits + totalMisses;
      return total > 0 ? (totalHits / total) * 100 : 0;
    } catch (error) {
      console.error("Get cache hit rate error:", error);
      return 0;
    }
  }

  /**
   * 최적화 추천 생성
   */
  async getOptimizationRecommendations(): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    // 캐시 히트율 분석
    const cacheHitRate = await this.getCacheHitRate(7);
    if (cacheHitRate < 50) {
      recommendations.push({
        type: "cache",
        priority: "high",
        description: `캐시 히트율이 ${cacheHitRate.toFixed(1)}%로 낮습니다`,
        impact: "API 응답 시간 50% 이상 개선 가능",
        implementation: "자주 조회되는 데이터에 대한 캐시 TTL 증가 및 캐시 키 전략 개선",
      });
    }

    // 응답 시간 분석
    const endpoints = ["rag/query", "messages", "conversations", "customers"];
    for (const endpoint of endpoints) {
      const metrics = await this.getPerformanceMetrics(endpoint);
      if (metrics.avgResponseTime > 1000) {
        recommendations.push({
          type: "query",
          priority: metrics.avgResponseTime > 3000 ? "high" : "medium",
          description: `${endpoint} 엔드포인트 평균 응답 시간: ${metrics.avgResponseTime}ms`,
          impact: "사용자 경험 개선 및 서버 부하 감소",
          implementation: "쿼리 최적화, 인덱스 추가, 또는 결과 캐싱 적용",
        });
      }
    }

    // 기본 최적화 추천
    recommendations.push({
      type: "index",
      priority: "medium",
      description: "자주 사용되는 검색 쿼리에 대한 인덱스 최적화",
      impact: "검색 성능 30-50% 개선",
      implementation: `
        -- 추천 인덱스
        CREATE INDEX CONCURRENTLY idx_messages_conversation_created
          ON messages(conversation_id, created_at DESC);
        CREATE INDEX CONCURRENTLY idx_knowledge_chunks_tenant_embedding
          ON knowledge_chunks(tenant_id) INCLUDE (embedding);
      `,
    });

    return recommendations;
  }

  /**
   * 데이터베이스 쿼리 분석
   */
  async analyzeSlowQueries(): Promise<QueryMetrics[]> {
    // Supabase/PostgreSQL pg_stat_statements에서 느린 쿼리 조회
    // 실제 구현에서는 Supabase Admin API 또는 직접 DB 연결 필요

    return [
      {
        query: "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at",
        avgExecutionTime: 150,
        executionCount: 10000,
        slowestExecution: 2500,
      },
      {
        query: "SELECT * FROM knowledge_chunks WHERE tenant_id = ? ORDER BY embedding <=> ?",
        avgExecutionTime: 200,
        executionCount: 5000,
        slowestExecution: 3000,
      },
    ];
  }

  /**
   * 성능 대시보드 데이터
   */
  async getPerformanceDashboard(): Promise<{
    overview: {
      avgResponseTime: number;
      cacheHitRate: number;
      errorRate: number;
      requestsPerMinute: number;
    };
    endpoints: PerformanceMetrics[];
    recommendations: OptimizationRecommendation[];
    slowQueries: QueryMetrics[];
  }> {
    const endpoints = ["rag/query", "messages", "conversations", "customers"];
    const endpointMetrics = await Promise.all(
      endpoints.map((e) => this.getPerformanceMetrics(e))
    );

    const avgResponseTime =
      endpointMetrics.reduce((sum, m) => sum + m.avgResponseTime, 0) / endpoints.length;
    const totalRequests = endpointMetrics.reduce((sum, m) => sum + m.requestCount, 0);

    return {
      overview: {
        avgResponseTime: Math.round(avgResponseTime),
        cacheHitRate: await this.getCacheHitRate(1),
        errorRate: 0.5, // TODO: 실제 에러율 계산
        requestsPerMinute: Math.round(totalRequests / 60),
      },
      endpoints: endpointMetrics,
      recommendations: await this.getOptimizationRecommendations(),
      slowQueries: await this.analyzeSlowQueries(),
    };
  }
}

export const performanceService = new PerformanceOptimizationService();
