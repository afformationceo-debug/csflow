import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractVariables, applyVariables } from "@/services/templates";

// Mock dependencies
vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
}));

describe("Template Service - Pure Functions", () => {
  describe("extractVariables", () => {
    it("should extract single variable", () => {
      const content = "안녕하세요, {{customerName}}님";
      const vars = extractVariables(content);
      expect(vars).toEqual(["customerName"]);
    });

    it("should extract multiple variables", () => {
      const content = "{{customerName}}님의 {{bookingDate}} {{bookingTime}} 예약이 확정되었습니다.";
      const vars = extractVariables(content);
      expect(vars).toContain("customerName");
      expect(vars).toContain("bookingDate");
      expect(vars).toContain("bookingTime");
      expect(vars).toHaveLength(3);
    });

    it("should deduplicate repeated variables", () => {
      const content = "{{hospitalName}}에서 알려드립니다. {{hospitalName}} 방문을 환영합니다.";
      const vars = extractVariables(content);
      expect(vars).toEqual(["hospitalName"]);
    });

    it("should return empty array when no variables exist", () => {
      const content = "안녕하세요, 무엇을 도와드릴까요?";
      const vars = extractVariables(content);
      expect(vars).toEqual([]);
    });

    it("should handle multiline content", () => {
      const content = `{{customerName}}님,
예약일시: {{bookingDate}} {{bookingTime}}
병원명: {{hospitalName}}`;
      const vars = extractVariables(content);
      expect(vars).toHaveLength(4);
      expect(vars).toContain("customerName");
      expect(vars).toContain("bookingDate");
      expect(vars).toContain("bookingTime");
      expect(vars).toContain("hospitalName");
    });

    it("should not match partial patterns", () => {
      const content = "{ {notVar} } and {notVar} and {{}}";
      const vars = extractVariables(content);
      expect(vars).toEqual([]);
    });

    it("should only match word characters inside braces", () => {
      const content = "{{validVar123}} but not {{invalid-var}}";
      const vars = extractVariables(content);
      expect(vars).toEqual(["validVar123"]);
    });
  });

  describe("applyVariables", () => {
    it("should replace a single variable", () => {
      const content = "안녕하세요, {{customerName}}님";
      const result = applyVariables(content, { customerName: "김환자" });
      expect(result).toBe("안녕하세요, 김환자님");
    });

    it("should replace multiple variables", () => {
      const content = "{{customerName}}님의 {{bookingDate}} 예약이 확정되었습니다.";
      const result = applyVariables(content, {
        customerName: "이환자",
        bookingDate: "2024-02-15",
      });
      expect(result).toBe("이환자님의 2024-02-15 예약이 확정되었습니다.");
    });

    it("should replace all occurrences of the same variable", () => {
      const content = "{{hospitalName}}에서 알려드립니다. {{hospitalName}} 드림";
      const result = applyVariables(content, { hospitalName: "힐링안과" });
      expect(result).toBe("힐링안과에서 알려드립니다. 힐링안과 드림");
    });

    it("should leave unreferenced variables unchanged", () => {
      const content = "{{customerName}}님, {{unknownVar}} 안내";
      const result = applyVariables(content, { customerName: "박환자" });
      expect(result).toBe("박환자님, {{unknownVar}} 안내");
    });

    it("should handle empty variables object", () => {
      const content = "{{customerName}}님";
      const result = applyVariables(content, {});
      expect(result).toBe("{{customerName}}님");
    });

    it("should handle empty string values", () => {
      const content = "이름: {{name}}, 전화: {{phone}}";
      const result = applyVariables(content, { name: "", phone: "010-1234-5678" });
      expect(result).toBe("이름: , 전화: 010-1234-5678");
    });

    it("should handle multiline template with all variables", () => {
      const content = `{{customerName}}님의 예약이 확정되었습니다.

📅 예약일시: {{bookingDate}} {{bookingTime}}
🏥 시술명: {{serviceName}}
📍 병원명: {{hospitalName}}

변경이나 취소가 필요하시면 언제든 말씀해주세요.`;

      const result = applyVariables(content, {
        customerName: "田中太郎",
        bookingDate: "2024-02-15",
        bookingTime: "10:00",
        serviceName: "라식",
        hospitalName: "힐링안과",
      });

      expect(result).toContain("田中太郎");
      expect(result).toContain("2024-02-15");
      expect(result).toContain("10:00");
      expect(result).toContain("라식");
      expect(result).toContain("힐링안과");
    });
  });
});
