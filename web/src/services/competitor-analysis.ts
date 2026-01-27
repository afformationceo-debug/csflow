/**
 * Competitor Analysis Service
 * 경쟁사 가격/서비스 분석 (웹 스크래핑 기반)
 */

import OpenAI from "openai";
import { createServiceClient } from "@/lib/supabase/server";

// Types
export interface CompetitorInfo {
  id: string;
  name: string;
  website: string;
  specialty: string;
  location: string;
  lastUpdated: string;
}

export interface PriceData {
  competitorId: string;
  competitorName: string;
  procedure: string;
  priceMin: number;
  priceMax: number;
  currency: string;
  notes?: string;
  source: string;
  collectedAt: string;
}

export interface ServiceComparison {
  procedure: string;
  ourPrice: {
    min: number;
    max: number;
    currency: string;
  };
  competitorPrices: Array<{
    competitor: string;
    min: number;
    max: number;
    currency: string;
    priceDiff: number; // 우리 대비 %
  }>;
  marketAverage: number;
  ourPosition: "below_average" | "average" | "above_average" | "premium";
}

export interface CompetitorReport {
  generatedAt: string;
  tenantId: string;
  competitors: CompetitorInfo[];
  priceComparisons: ServiceComparison[];
  insights: string[];
  recommendations: string[];
}

class CompetitorAnalysisService {
  private openai: OpenAI | null = null;

  private getOpenAI(): OpenAI {
    if (!this.openai) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY is not configured");
      }
      this.openai = new OpenAI({ apiKey });
    }
    return this.openai;
  }

  /**
   * 경쟁사 목록 관리
   */
  async addCompetitor(
    tenantId: string,
    competitor: Omit<CompetitorInfo, "id" | "lastUpdated">
  ): Promise<CompetitorInfo> {
    const supabase = await createServiceClient();

    const newCompetitor: CompetitorInfo = {
      id: crypto.randomUUID(),
      ...competitor,
      lastUpdated: new Date().toISOString(),
    };

    // 실제 DB 저장
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("competitors").insert({
      id: newCompetitor.id,
      tenant_id: tenantId,
      name: newCompetitor.name,
      website: newCompetitor.website,
      specialty: newCompetitor.specialty,
      location: newCompetitor.location,
      created_at: newCompetitor.lastUpdated,
    });

    if (error) {
      // 테이블이 없을 수 있으므로 에러 무시하고 메모리에서 반환
      console.warn("Competitors table may not exist:", error.message);
    }

    return newCompetitor;
  }

  /**
   * 경쟁사 목록 조회
   */
  async getCompetitors(tenantId: string): Promise<CompetitorInfo[]> {
    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from("competitors")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("name");

    if (error) {
      // 테이블이 없을 경우 빈 배열 반환
      console.warn("Competitors table may not exist:", error.message);
      return [];
    }

    return (data || []).map((item) => ({
      id: item.id,
      name: item.name,
      website: item.website,
      specialty: item.specialty,
      location: item.location,
      lastUpdated: item.updated_at || item.created_at,
    }));
  }

  /**
   * 가격 정보 수동 입력
   */
  async addPriceData(
    tenantId: string,
    priceData: Omit<PriceData, "collectedAt">
  ): Promise<PriceData> {
    const supabase = await createServiceClient();

    const data: PriceData = {
      ...priceData,
      collectedAt: new Date().toISOString(),
    };

    // DB 저장 (competitor_prices 테이블)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("competitor_prices").insert({
      tenant_id: tenantId,
      competitor_id: data.competitorId,
      procedure: data.procedure,
      price_min: data.priceMin,
      price_max: data.priceMax,
      currency: data.currency,
      notes: data.notes,
      source: data.source,
      collected_at: data.collectedAt,
    });

    if (error) {
      console.warn("Competitor prices table may not exist:", error.message);
    }

    return data;
  }

  /**
   * 가격 비교 분석
   */
  async comparePrices(
    tenantId: string,
    procedure: string,
    ourPrice: { min: number; max: number; currency: string }
  ): Promise<ServiceComparison> {
    const supabase = await createServiceClient();

    // 경쟁사 가격 조회
    const { data: competitorPrices } = await supabase
      .from("competitor_prices")
      .select(`
        *,
        competitors (name)
      `)
      .eq("tenant_id", tenantId)
      .ilike("procedure", `%${procedure}%`)
      .order("collected_at", { ascending: false });

    // 중복 제거 (경쟁사별 최신 가격만)
    const latestPrices = new Map<string, PriceData>();
    for (const price of competitorPrices || []) {
      if (!latestPrices.has(price.competitor_id)) {
        latestPrices.set(price.competitor_id, {
          competitorId: price.competitor_id,
          competitorName: price.competitors?.name || "Unknown",
          procedure: price.procedure,
          priceMin: price.price_min,
          priceMax: price.price_max,
          currency: price.currency,
          notes: price.notes,
          source: price.source,
          collectedAt: price.collected_at,
        });
      }
    }

    const ourAvg = (ourPrice.min + ourPrice.max) / 2;
    const competitorData = Array.from(latestPrices.values()).map((price) => {
      const competitorAvg = (price.priceMin + price.priceMax) / 2;
      const priceDiff = ((competitorAvg - ourAvg) / ourAvg) * 100;

      return {
        competitor: price.competitorName,
        min: price.priceMin,
        max: price.priceMax,
        currency: price.currency,
        priceDiff: Math.round(priceDiff * 10) / 10,
      };
    });

    // 시장 평균 계산
    const allPrices = competitorData.map((c) => (c.min + c.max) / 2);
    const marketAverage =
      allPrices.length > 0
        ? allPrices.reduce((sum, p) => sum + p, 0) / allPrices.length
        : ourAvg;

    // 포지션 결정
    let ourPosition: ServiceComparison["ourPosition"];
    const diffFromAvg = ((ourAvg - marketAverage) / marketAverage) * 100;

    if (diffFromAvg < -15) {
      ourPosition = "below_average";
    } else if (diffFromAvg < 10) {
      ourPosition = "average";
    } else if (diffFromAvg < 25) {
      ourPosition = "above_average";
    } else {
      ourPosition = "premium";
    }

    return {
      procedure,
      ourPrice,
      competitorPrices: competitorData,
      marketAverage: Math.round(marketAverage),
      ourPosition,
    };
  }

  /**
   * AI 기반 인사이트 생성
   */
  async generateInsights(comparisons: ServiceComparison[]): Promise<string[]> {
    const openai = this.getOpenAI();

    const prompt = `아래 의료 서비스 가격 비교 데이터를 분석하고, 비즈니스에 유용한 인사이트 5개를 한국어로 제공해주세요.

가격 비교 데이터:
${JSON.stringify(comparisons, null, 2)}

요구사항:
1. 각 인사이트는 구체적이고 실행 가능해야 함
2. 시장 포지셔닝, 가격 전략, 경쟁 우위에 대한 분석 포함
3. 데이터 기반으로 객관적인 분석

JSON 배열 형식으로 응답해주세요: ["인사이트1", "인사이트2", ...]`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    try {
      const content = response.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(content);
      return parsed.insights || parsed || [];
    } catch {
      return ["인사이트 생성에 실패했습니다."];
    }
  }

  /**
   * AI 기반 추천 생성
   */
  async generateRecommendations(comparisons: ServiceComparison[]): Promise<string[]> {
    const openai = this.getOpenAI();

    const prompt = `아래 의료 서비스 가격 비교 데이터를 기반으로, 가격 전략 및 마케팅 추천 사항 5개를 한국어로 제공해주세요.

가격 비교 데이터:
${JSON.stringify(comparisons, null, 2)}

요구사항:
1. 각 추천은 구체적인 액션 아이템이어야 함
2. 해외환자유치 관점에서의 전략 포함
3. 단기 및 장기 전략 모두 포함

JSON 배열 형식으로 응답해주세요: ["추천1", "추천2", ...]`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    try {
      const content = response.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(content);
      return parsed.recommendations || parsed || [];
    } catch {
      return ["추천 생성에 실패했습니다."];
    }
  }

  /**
   * 종합 리포트 생성
   */
  async generateReport(
    tenantId: string,
    procedures: string[],
    ourPrices: Record<string, { min: number; max: number; currency: string }>
  ): Promise<CompetitorReport> {
    // 경쟁사 목록 조회
    const competitors = await this.getCompetitors(tenantId);

    // 각 시술별 가격 비교
    const priceComparisons: ServiceComparison[] = [];
    for (const procedure of procedures) {
      if (ourPrices[procedure]) {
        const comparison = await this.comparePrices(tenantId, procedure, ourPrices[procedure]);
        priceComparisons.push(comparison);
      }
    }

    // AI 인사이트 및 추천 생성
    const [insights, recommendations] = await Promise.all([
      this.generateInsights(priceComparisons),
      this.generateRecommendations(priceComparisons),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      tenantId,
      competitors,
      priceComparisons,
      insights,
      recommendations,
    };
  }

  /**
   * 가격 변동 알림 설정
   */
  async setPriceAlert(
    tenantId: string,
    options: {
      competitorId: string;
      procedure: string;
      thresholdPercent: number; // 변동 임계값 (%)
      notifyEmail?: string;
      notifyWebhook?: string;
    }
  ): Promise<{ alertId: string }> {
    const supabase = await createServiceClient();
    const alertId = crypto.randomUUID();

    // DB 저장 (price_alerts 테이블)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("price_alerts").insert({
      id: alertId,
      tenant_id: tenantId,
      competitor_id: options.competitorId,
      procedure: options.procedure,
      threshold_percent: options.thresholdPercent,
      notify_email: options.notifyEmail,
      notify_webhook: options.notifyWebhook,
      is_active: true,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.warn("Price alerts table may not exist:", error.message);
    }

    return { alertId };
  }
}

export const competitorAnalysisService = new CompetitorAnalysisService();
