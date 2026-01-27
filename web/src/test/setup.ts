import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock environment variables
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
vi.stubEnv("ANTHROPIC_API_KEY", "test-anthropic-key");
vi.stubEnv("DEEPL_API_KEY", "test-deepl-key");
vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://test.upstash.io");
vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-redis-token");
vi.stubEnv("UPSTASH_VECTOR_REST_URL", "https://test-vector.upstash.io");
vi.stubEnv("UPSTASH_VECTOR_REST_TOKEN", "test-vector-token");

// Mock fetch globally
global.fetch = vi.fn();

// Mock crypto.randomUUID
vi.stubGlobal("crypto", {
  randomUUID: () => "test-uuid-1234-5678-9012",
});

// Suppress console errors in tests (optional)
// vi.spyOn(console, 'error').mockImplementation(() => {});

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});
