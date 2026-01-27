import {
  CACHE_KEYS,
  CACHE_TTL,
  getFromCache,
  setToCache,
} from "@/lib/upstash/redis";
import crypto from "crypto";

// Supported languages
export type SupportedLanguage =
  | "KO" // Korean
  | "EN" // English
  | "JA" // Japanese
  | "ZH" // Chinese (Simplified)
  | "ZH-TW" // Chinese (Traditional)
  | "VI" // Vietnamese
  | "TH" // Thai
  | "ID" // Indonesian
  | "DE" // German
  | "FR" // French
  | "ES" // Spanish
  | "PT" // Portuguese
  | "RU" // Russian
  | "AR"; // Arabic

export interface TranslationResult {
  text: string;
  detectedSourceLang?: string;
  cached?: boolean;
}

export interface TranslationOptions {
  sourceLang?: SupportedLanguage;
  targetLang: SupportedLanguage;
  formality?: "default" | "more" | "less" | "prefer_more" | "prefer_less";
  preserveFormatting?: boolean;
}

// Language detection
export async function detectLanguage(text: string): Promise<SupportedLanguage> {
  // Quick detection for common patterns
  const patterns: { pattern: RegExp; lang: SupportedLanguage }[] = [
    { pattern: /[\uAC00-\uD7AF]/, lang: "KO" }, // Korean
    { pattern: /[\u3040-\u309F\u30A0-\u30FF]/, lang: "JA" }, // Japanese (Hiragana/Katakana)
    { pattern: /[\u4E00-\u9FFF]/, lang: "ZH" }, // Chinese
    { pattern: /[\u0E00-\u0E7F]/, lang: "TH" }, // Thai
    { pattern: /[\u0600-\u06FF]/, lang: "AR" }, // Arabic
    { pattern: /[\u0400-\u04FF]/, lang: "RU" }, // Russian/Cyrillic
  ];

  for (const { pattern, lang } of patterns) {
    if (pattern.test(text)) {
      return lang;
    }
  }

  // Default to English for Latin scripts
  return "EN";
}

// Generate cache key for translation
function getTranslationCacheKey(
  text: string,
  targetLang: SupportedLanguage
): string {
  const hash = crypto.createHash("md5").update(`${text}:${targetLang}`).digest("hex");
  return CACHE_KEYS.translationCache(hash);
}

// DeepL API client
class DeepLClient {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.DEEPL_API_KEY || "";
    // Use free API endpoint if key ends with :fx
    this.baseUrl = this.apiKey.endsWith(":fx")
      ? "https://api-free.deepl.com/v2"
      : "https://api.deepl.com/v2";
  }

  async translate(
    text: string | string[],
    options: TranslationOptions
  ): Promise<TranslationResult[]> {
    const texts = Array.isArray(text) ? text : [text];

    const response = await fetch(`${this.baseUrl}/translate`, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: texts,
        target_lang: options.targetLang,
        source_lang: options.sourceLang,
        formality: options.formality,
        preserve_formatting: options.preserveFormatting,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepL API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    return data.translations.map(
      (t: { text: string; detected_source_language: string }) => ({
        text: t.text,
        detectedSourceLang: t.detected_source_language,
      })
    );
  }

  async getUsage(): Promise<{ character_count: number; character_limit: number }> {
    const response = await fetch(`${this.baseUrl}/usage`, {
      method: "GET",
      headers: {
        Authorization: `DeepL-Auth-Key ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`DeepL API error: ${response.status}`);
    }

    return response.json();
  }
}

const deepl = new DeepLClient();

// Main translation service
export const translationService = {
  /**
   * Translate a single text
   */
  async translate(
    text: string,
    targetLang: SupportedLanguage,
    sourceLang?: SupportedLanguage
  ): Promise<TranslationResult> {
    // Check cache first
    const cacheKey = getTranslationCacheKey(text, targetLang);
    const cached = await getFromCache<TranslationResult>(cacheKey);

    if (cached) {
      return { ...cached, cached: true };
    }

    // Translate using DeepL
    const results = await deepl.translate(text, {
      targetLang,
      sourceLang,
    });

    const result = results[0];

    // Cache the result
    await setToCache(cacheKey, result, CACHE_TTL.translation);

    return result;
  },

  /**
   * Translate multiple texts in batch
   */
  async translateBatch(
    texts: string[],
    targetLang: SupportedLanguage,
    sourceLang?: SupportedLanguage
  ): Promise<TranslationResult[]> {
    // Check cache for each text
    const results: (TranslationResult | null)[] = await Promise.all(
      texts.map(async (text) => {
        const cacheKey = getTranslationCacheKey(text, targetLang);
        const cached = await getFromCache<TranslationResult>(cacheKey);
        return cached ? { ...cached, cached: true } : null;
      })
    );

    // Find texts that need translation
    const uncachedIndices: number[] = [];
    const uncachedTexts: string[] = [];

    results.forEach((result, index) => {
      if (!result) {
        uncachedIndices.push(index);
        uncachedTexts.push(texts[index]);
      }
    });

    // Translate uncached texts
    if (uncachedTexts.length > 0) {
      const translations = await deepl.translate(uncachedTexts, {
        targetLang,
        sourceLang,
      });

      // Cache and merge results
      await Promise.all(
        translations.map(async (translation, i) => {
          const originalIndex = uncachedIndices[i];
          const cacheKey = getTranslationCacheKey(
            texts[originalIndex],
            targetLang
          );
          await setToCache(cacheKey, translation, CACHE_TTL.translation);
          results[originalIndex] = translation;
        })
      );
    }

    return results as TranslationResult[];
  },

  /**
   * Detect language of text
   */
  async detectLanguage(text: string): Promise<SupportedLanguage> {
    return detectLanguage(text);
  },

  /**
   * Auto-translate message for CS platform
   * Translates to Korean for agents, translates agent response to customer's language
   */
  async translateForCS(
    text: string,
    direction: "to_agent" | "to_customer",
    customerLang?: SupportedLanguage
  ): Promise<TranslationResult & { originalLang: SupportedLanguage }> {
    if (direction === "to_agent") {
      // Detect customer language and translate to Korean
      const detectedLang = await this.detectLanguage(text);

      if (detectedLang === "KO") {
        return {
          text,
          originalLang: "KO",
          detectedSourceLang: "KO",
        };
      }

      const result = await this.translate(text, "KO", detectedLang);
      return {
        ...result,
        originalLang: detectedLang,
      };
    } else {
      // Translate agent's Korean response to customer's language
      const targetLang = customerLang || "EN";

      if (targetLang === "KO") {
        return {
          text,
          originalLang: "KO",
        };
      }

      const result = await this.translate(text, targetLang, "KO");
      return {
        ...result,
        originalLang: "KO",
      };
    }
  },

  /**
   * Get API usage statistics
   */
  async getUsage() {
    return deepl.getUsage();
  },
};

// Language display names
export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  KO: "한국어",
  EN: "English",
  JA: "日本語",
  ZH: "简体中文",
  "ZH-TW": "繁體中文",
  VI: "Tiếng Việt",
  TH: "ไทย",
  ID: "Bahasa Indonesia",
  DE: "Deutsch",
  FR: "Français",
  ES: "Español",
  PT: "Português",
  RU: "Русский",
  AR: "العربية",
};

// Country to language mapping (for auto-detection)
export const COUNTRY_TO_LANGUAGE: Record<string, SupportedLanguage> = {
  한국: "KO",
  "South Korea": "KO",
  일본: "JA",
  Japan: "JA",
  중국: "ZH",
  China: "ZH",
  대만: "ZH-TW",
  Taiwan: "ZH-TW",
  미국: "EN",
  USA: "EN",
  "United States": "EN",
  영국: "EN",
  UK: "EN",
  "United Kingdom": "EN",
  베트남: "VI",
  Vietnam: "VI",
  태국: "TH",
  Thailand: "TH",
  인도네시아: "ID",
  Indonesia: "ID",
  독일: "DE",
  Germany: "DE",
  프랑스: "FR",
  France: "FR",
  스페인: "ES",
  Spain: "ES",
  러시아: "RU",
  Russia: "RU",
};
