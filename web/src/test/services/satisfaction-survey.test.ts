import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
}));

vi.mock("@/services/channels", () => ({
  sendChannelMessage: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/services/translation", () => ({
  translationService: {
    translate: vi.fn().mockResolvedValue({ text: "translated" }),
    detectLanguage: vi.fn().mockResolvedValue("KO"),
  },
}));

vi.mock("@/lib/upstash/qstash", () => ({
  enqueueJob: vi.fn().mockResolvedValue(null),
}));

import { satisfactionSurveyService } from "@/services/satisfaction-survey";
import type { SupportedLanguage } from "@/services/translation";

describe("Satisfaction Survey Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSurveyTemplate", () => {
    it("should return Korean template for KO", () => {
      const template = satisfactionSurveyService.getSurveyTemplate("KO" as SupportedLanguage);

      expect(template).toBeDefined();
      expect(template!.intro).toContain("설문");
      expect(template!.ratingQuestion).toContain("만족");
      expect(template!.ratingOptions).toHaveLength(5);
      expect(template!.thankYou).toBeDefined();
    });

    it("should return English template for EN", () => {
      const template = satisfactionSurveyService.getSurveyTemplate("EN" as SupportedLanguage);

      expect(template).toBeDefined();
      expect(template!.intro).toContain("survey");
      expect(template!.ratingQuestion).toContain("satisfied");
      expect(template!.ratingOptions).toHaveLength(5);
    });

    it("should return Japanese template for JA", () => {
      const template = satisfactionSurveyService.getSurveyTemplate("JA" as SupportedLanguage);

      expect(template).toBeDefined();
      expect(template!.intro).toContain("アンケート");
      expect(template!.ratingOptions).toHaveLength(5);
    });

    it("should return Chinese template for ZH", () => {
      const template = satisfactionSurveyService.getSurveyTemplate("ZH" as SupportedLanguage);

      expect(template).toBeDefined();
      expect(template!.intro).toContain("满意度");
    });

    it("should return Vietnamese template for VI", () => {
      const template = satisfactionSurveyService.getSurveyTemplate("VI" as SupportedLanguage);

      expect(template).toBeDefined();
      expect(template!.ratingOptions).toHaveLength(5);
    });

    it("should return Thai template for TH", () => {
      const template = satisfactionSurveyService.getSurveyTemplate("TH" as SupportedLanguage);

      expect(template).toBeDefined();
      expect(template!.ratingOptions).toHaveLength(5);
    });

    it("should fallback to Korean for unsupported languages", () => {
      const template = satisfactionSurveyService.getSurveyTemplate("DE" as SupportedLanguage);

      // Falls back to KO
      expect(template).toBeDefined();
      expect(template!.intro).toContain("설문");
    });

    it("should have 5 rating options (1-5) in all templates", () => {
      const languages: SupportedLanguage[] = ["KO", "EN", "JA", "ZH", "VI", "TH"];

      for (const lang of languages) {
        const template = satisfactionSurveyService.getSurveyTemplate(lang);
        expect(template!.ratingOptions).toHaveLength(5);

        // Each option should start with a number 1-5
        template!.ratingOptions.forEach((option, index) => {
          expect(option.startsWith(`${index + 1}`)).toBe(true);
        });
      }
    });
  });

  describe("buildSurveyMessage", () => {
    it("should build message with intro and rating question", () => {
      const template = satisfactionSurveyService.getSurveyTemplate("KO" as SupportedLanguage);
      const message = satisfactionSurveyService.buildSurveyMessage(template, "survey-1");

      expect(message.text).toContain(template!.intro);
      expect(message.text).toContain(template!.ratingQuestion);
    });

    it("should have 5 quick replies for ratings", () => {
      const template = satisfactionSurveyService.getSurveyTemplate("KO" as SupportedLanguage);
      const message = satisfactionSurveyService.buildSurveyMessage(template, "survey-1");

      expect(message.quickReplies).toHaveLength(5);
    });

    it("should have correct quick reply structure", () => {
      const template = satisfactionSurveyService.getSurveyTemplate("EN" as SupportedLanguage);
      const message = satisfactionSurveyService.buildSurveyMessage(template, "survey-1");

      message.quickReplies!.forEach((reply) => {
        expect(reply.label).toBeDefined();
        expect(reply.action).toBe("message");
        expect(reply.value).toMatch(/^[1-5]$/);
      });
    });

    it("should have numeric values 1-5 in quick replies", () => {
      const template = satisfactionSurveyService.getSurveyTemplate("KO" as SupportedLanguage);
      const message = satisfactionSurveyService.buildSurveyMessage(template, "survey-1");

      const values = message.quickReplies!.map((r) => r.value);
      expect(values).toEqual(["1", "2", "3", "4", "5"]);
    });

    it("should work with English template", () => {
      const template = satisfactionSurveyService.getSurveyTemplate("EN" as SupportedLanguage);
      const message = satisfactionSurveyService.buildSurveyMessage(template, "survey-2");

      expect(message.text).toContain("survey");
      expect(message.quickReplies).toHaveLength(5);
    });
  });
});
