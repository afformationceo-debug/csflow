import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before import - use class syntax for constructors
vi.mock("openai", () => {
  const MockOpenAI = class {
    chat = {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: "테스트 응답입니다." } }],
          usage: { total_tokens: 150 },
        }),
      },
    };
  };
  return { default: MockOpenAI };
});

vi.mock("@anthropic-ai/sdk", () => {
  const MockAnthropic = class {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "Claude 테스트 응답입니다." }],
        usage: { input_tokens: 50, output_tokens: 100 },
      }),
    };
  };
  return { default: MockAnthropic };
});

import { llmService } from "@/services/ai/llm";
import type { RetrievedDocument } from "@/services/ai/retriever";

describe("LLM Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("selectModel", () => {
    it("should select GPT-4 for simple queries", () => {
      const model = llmService.selectModel("가격이 얼마인가요?", 2);
      expect(model).toBe("gpt-4");
    });

    it("should select Claude for long queries (>200 chars)", () => {
      const longQuery = "라식 수술을 받고 싶은데요, 현재 시력이 양쪽 다 0.1 이하이고 난시도 좀 있습니다. 고도근시의 경우에도 라식이 가능한지, 아니면 라섹이나 ICL 같은 다른 수술을 받아야 하는지 궁금합니다. 그리고 수술 후 회복 기간이나 주의사항도 알고 싶습니다.";
      const model = llmService.selectModel(longQuery, 2);
      expect(model).toBe("claude-3-sonnet");
    });

    it("should select Claude for queries with many documents (>5)", () => {
      const model = llmService.selectModel("가격 문의", 6);
      expect(model).toBe("claude-3-sonnet");
    });

    it("should select Claude for medical keywords - 의료", () => {
      const model = llmService.selectModel("의료 상담 문의", 2);
      expect(model).toBe("claude-3-sonnet");
    });

    it("should select Claude for medical keywords - 수술", () => {
      const model = llmService.selectModel("수술 후 관리", 2);
      expect(model).toBe("claude-3-sonnet");
    });

    it("should select Claude for medical keywords - 합병증", () => {
      const model = llmService.selectModel("합병증 위험이 있나요?", 2);
      expect(model).toBe("claude-3-sonnet");
    });

    it("should select Claude for medical keywords - 부작용", () => {
      const model = llmService.selectModel("부작용은 없나요?", 2);
      expect(model).toBe("claude-3-sonnet");
    });

    it("should select GPT-4 for simple non-medical queries", () => {
      const model = llmService.selectModel("예약하고 싶습니다", 1);
      expect(model).toBe("gpt-4");
    });
  });

  describe("generate", () => {
    const mockDocuments: RetrievedDocument[] = [
      {
        id: "doc-1",
        title: "라식 가격 안내",
        chunkText: "라식 수술 비용은 양안 기준 150만원입니다.",
        similarity: 0.92,
        documentId: "doc-1",
        metadata: {},
      },
      {
        id: "doc-2",
        title: "라식 후 관리",
        chunkText: "수술 후 1주일간 눈을 비비지 않도록 주의하세요.",
        similarity: 0.85,
        documentId: "doc-2",
        metadata: {},
      },
    ];

    it("should generate response with GPT-4 model", async () => {
      const result = await llmService.generate("라식 비용이 얼마인가요?", mockDocuments, {
        model: "gpt-4",
      });

      expect(result.content).toBeDefined();
      expect(result.model).toBe("gpt-4");
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.tokensUsed).toBe(150);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("should generate response with Claude model", async () => {
      const result = await llmService.generate("라식 비용이 얼마인가요?", mockDocuments, {
        model: "claude-3-sonnet",
      });

      expect(result.content).toBeDefined();
      expect(result.model).toBe("claude-3-sonnet");
      expect(result.tokensUsed).toBe(150); // 50 + 100
    });

    it("should calculate high confidence with relevant documents", async () => {
      const result = await llmService.generate("라식 비용", mockDocuments, {
        model: "gpt-4",
      });

      // avgSimilarity = (0.92 + 0.85) / 2 = 0.885
      // confidence = 0.885 * 0.6 + 0.4 = 0.931
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it("should calculate lower confidence with no documents", async () => {
      const result = await llmService.generate("알 수 없는 질문", [], {
        model: "gpt-4",
      });

      // confidence = 0 * 0.6 + 0.4 - 0.3 (no context penalty) = 0.1
      expect(result.confidence).toBeLessThan(0.5);
    });

    it("should default to gpt-4 model if not specified", async () => {
      const result = await llmService.generate("테스트", mockDocuments);
      expect(result.model).toBe("gpt-4");
    });
  });
});
