import { describe, it, expect, vi, beforeEach } from "vitest";
import { detectLanguage, LANGUAGE_NAMES, COUNTRY_TO_LANGUAGE } from "@/services/translation";

// Mock dependencies
vi.mock("@/lib/upstash/redis", () => ({
  CACHE_KEYS: {
    translationCache: (hash: string) => `translation:${hash}`,
  },
  CACHE_TTL: {
    translation: 86400,
  },
  getFromCache: vi.fn().mockResolvedValue(null),
  setToCache: vi.fn().mockResolvedValue(undefined),
}));

describe("Translation Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("detectLanguage", () => {
    it("should detect Korean text", async () => {
      expect(await detectLanguage("안녕하세요")).toBe("KO");
      expect(await detectLanguage("라식 수술 비용이 얼마인가요?")).toBe("KO");
    });

    it("should detect Japanese text (Hiragana)", async () => {
      expect(await detectLanguage("こんにちは")).toBe("JA");
      expect(await detectLanguage("ありがとうございます")).toBe("JA");
    });

    it("should detect Japanese text (Katakana)", async () => {
      expect(await detectLanguage("カタカナ")).toBe("JA");
    });

    it("should detect Chinese text", async () => {
      expect(await detectLanguage("你好")).toBe("ZH");
      expect(await detectLanguage("谢谢")).toBe("ZH");
    });

    it("should detect Thai text", async () => {
      expect(await detectLanguage("สวัสดี")).toBe("TH");
    });

    it("should detect Arabic text", async () => {
      expect(await detectLanguage("مرحبا")).toBe("AR");
    });

    it("should detect Russian text", async () => {
      expect(await detectLanguage("Привет")).toBe("RU");
    });

    it("should default to English for Latin scripts", async () => {
      expect(await detectLanguage("Hello")).toBe("EN");
      expect(await detectLanguage("Bonjour")).toBe("EN"); // French detected as EN (Latin)
      expect(await detectLanguage("Good morning!")).toBe("EN");
    });

    it("should default to English for empty or ambiguous text", async () => {
      expect(await detectLanguage("123")).toBe("EN");
      expect(await detectLanguage("!!!")).toBe("EN");
    });

    it("should detect first matching language in mixed text", async () => {
      // Korean appears first in pattern list
      expect(await detectLanguage("안녕 Hello")).toBe("KO");
    });
  });

  describe("LANGUAGE_NAMES", () => {
    it("should have all 14 supported languages", () => {
      expect(Object.keys(LANGUAGE_NAMES)).toHaveLength(14);
    });

    it("should have correct language names", () => {
      expect(LANGUAGE_NAMES.KO).toBe("한국어");
      expect(LANGUAGE_NAMES.EN).toBe("English");
      expect(LANGUAGE_NAMES.JA).toBe("日本語");
      expect(LANGUAGE_NAMES.ZH).toBe("简体中文");
      expect(LANGUAGE_NAMES["ZH-TW"]).toBe("繁體中文");
      expect(LANGUAGE_NAMES.VI).toBe("Tiếng Việt");
    });
  });

  describe("COUNTRY_TO_LANGUAGE", () => {
    it("should map Korean country names correctly", () => {
      expect(COUNTRY_TO_LANGUAGE["한국"]).toBe("KO");
      expect(COUNTRY_TO_LANGUAGE["South Korea"]).toBe("KO");
    });

    it("should map Japanese country names correctly", () => {
      expect(COUNTRY_TO_LANGUAGE["일본"]).toBe("JA");
      expect(COUNTRY_TO_LANGUAGE["Japan"]).toBe("JA");
    });

    it("should map English-speaking countries correctly", () => {
      expect(COUNTRY_TO_LANGUAGE["미국"]).toBe("EN");
      expect(COUNTRY_TO_LANGUAGE["USA"]).toBe("EN");
      expect(COUNTRY_TO_LANGUAGE["United States"]).toBe("EN");
      expect(COUNTRY_TO_LANGUAGE["영국"]).toBe("EN");
      expect(COUNTRY_TO_LANGUAGE["UK"]).toBe("EN");
    });

    it("should map Southeast Asian countries correctly", () => {
      expect(COUNTRY_TO_LANGUAGE["베트남"]).toBe("VI");
      expect(COUNTRY_TO_LANGUAGE["Vietnam"]).toBe("VI");
      expect(COUNTRY_TO_LANGUAGE["태국"]).toBe("TH");
      expect(COUNTRY_TO_LANGUAGE["Thailand"]).toBe("TH");
      expect(COUNTRY_TO_LANGUAGE["인도네시아"]).toBe("ID");
      expect(COUNTRY_TO_LANGUAGE["Indonesia"]).toBe("ID");
    });

    it("should distinguish traditional and simplified Chinese", () => {
      expect(COUNTRY_TO_LANGUAGE["중국"]).toBe("ZH");
      expect(COUNTRY_TO_LANGUAGE["대만"]).toBe("ZH-TW");
      expect(COUNTRY_TO_LANGUAGE["Taiwan"]).toBe("ZH-TW");
    });
  });
});
