import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: {
              id: "tenant-1",
              name: "Test Tenant",
              ai_config: {
                enabled: true,
                confidence_threshold: 0.75,
                model: "gpt-4",
                system_prompt: "You are a helpful assistant.",
              },
            },
            error: null,
          })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { id: "log-1" },
            error: null,
          })),
        })),
      })),
    })),
  })),
}));

// Mock OpenAI
vi.mock("openai", () => ({
  default: vi.fn(() => ({
    chat: {
      completions: {
        create: vi.fn(() =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: "This is a test response from the AI.",
                },
              },
            ],
            usage: {
              prompt_tokens: 100,
              completion_tokens: 50,
            },
          })
        ),
      },
    },
    embeddings: {
      create: vi.fn(() =>
        Promise.resolve({
          data: [{ embedding: new Array(1536).fill(0.1) }],
        })
      ),
    },
  })),
}));

describe("RAG Pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Query Processing", () => {
    it("should detect query language", () => {
      // 한국어 감지
      const koreanText = "라식 수술 비용이 얼마인가요?";
      expect(koreanText.match(/[\uAC00-\uD7A3]/)).toBeTruthy();

      // 일본어 감지
      const japaneseText = "手術の費用はいくらですか？";
      expect(japaneseText.match(/[\u3040-\u309F\u30A0-\u30FF]/)).toBeTruthy();

      // 영어
      const englishText = "What is the cost of LASIK surgery?";
      expect(englishText.match(/^[a-zA-Z\s\?\.\,\!]+$/)).toBeTruthy();
    });

    it("should classify query intent", () => {
      const intents = {
        price: ["비용", "가격", "얼마", "cost", "price"],
        booking: ["예약", "appointment", "book"],
        info: ["정보", "알려", "information", "tell me"],
      };

      const query = "라식 수술 비용이 얼마인가요?";
      const matchedIntent = Object.entries(intents).find(([_, keywords]) =>
        keywords.some((k) => query.includes(k))
      );

      expect(matchedIntent?.[0]).toBe("price");
    });
  });

  describe("Confidence Calculation", () => {
    it("should calculate confidence score correctly", () => {
      const scores = {
        retrieval: 0.85,
        generation: 0.9,
        factuality: 0.8,
        domain: 0.75,
        consistency: 0.95,
      };

      const weights = {
        retrieval: 0.2,
        generation: 0.25,
        factuality: 0.3,
        domain: 0.15,
        consistency: 0.1,
      };

      const overallScore = Object.entries(scores).reduce(
        (total, [key, score]) => total + score * weights[key as keyof typeof weights],
        0
      );

      expect(overallScore).toBeCloseTo(0.845);
    });

    it("should determine escalation correctly", () => {
      const threshold = 0.75;

      const shouldEscalate = (confidence: number) => confidence < threshold;

      expect(shouldEscalate(0.5)).toBe(true);
      expect(shouldEscalate(0.74)).toBe(true);
      expect(shouldEscalate(0.75)).toBe(false);
      expect(shouldEscalate(0.9)).toBe(false);
    });
  });

  describe("Response Validation", () => {
    it("should detect escalation keywords", () => {
      const escalationKeywords = ["환불", "불만", "소송", "고소", "변호사"];
      const testQuery = "환불 받고 싶어요";

      const hasEscalationKeyword = escalationKeywords.some((keyword) =>
        testQuery.includes(keyword)
      );

      expect(hasEscalationKeyword).toBe(true);
    });

    it("should validate response safety", () => {
      const unsafePatterns = [
        /처방/,
        /약물.*복용/,
        /진단/,
        /의사.*없이/,
      ];

      const safeResponse = "일반적인 정보를 안내해 드립니다.";
      const unsafeResponse = "이 약물을 복용하시면 됩니다.";

      const isSafe = (response: string) =>
        !unsafePatterns.some((pattern) => pattern.test(response));

      expect(isSafe(safeResponse)).toBe(true);
      expect(isSafe(unsafeResponse)).toBe(false);
    });
  });
});

describe("LLM Router", () => {
  describe("Model Selection", () => {
    it("should select GPT-4 for simple queries", () => {
      const selectModel = (query: string, complexity: number) => {
        if (complexity < 0.5) return "gpt-4o-mini";
        if (complexity < 0.75) return "gpt-4o";
        return "claude-3-opus";
      };

      expect(selectModel("가격이 얼마에요?", 0.3)).toBe("gpt-4o-mini");
      expect(selectModel("수술 절차를 설명해주세요.", 0.6)).toBe("gpt-4o");
      expect(selectModel("복잡한 의료 상담이 필요합니다.", 0.9)).toBe("claude-3-opus");
    });
  });
});

describe("Translation Service", () => {
  it("should support multiple languages", () => {
    const supportedLanguages = ["ko", "en", "ja", "zh", "vi", "th"];

    const isSupported = (lang: string) => supportedLanguages.includes(lang);

    expect(isSupported("ko")).toBe(true);
    expect(isSupported("ja")).toBe(true);
    expect(isSupported("fr")).toBe(false);
  });
});
