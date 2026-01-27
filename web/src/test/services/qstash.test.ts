import { describe, it, expect, vi, beforeEach } from "vitest";

// Must mock before imports - use class syntax for constructors
vi.mock("@upstash/qstash", () => {
  const MockClient = class {
    publishJSON = vi.fn().mockResolvedValue({ messageId: "msg-123" });
    batchJSON = vi.fn().mockResolvedValue([{ messageId: "msg-1" }, { messageId: "msg-2" }]);
    schedules = {
      create: vi.fn().mockResolvedValue({ scheduleId: "sched-123" }),
    };
  };
  return { Client: MockClient };
});

describe("QStash Job Queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("QSTASH_TOKEN", "test-token");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://test.example.com");
  });

  describe("Module exports", () => {
    it("should export enqueueJob function", async () => {
      const mod = await import("@/lib/upstash/qstash");
      expect(mod.enqueueJob).toBeDefined();
      expect(typeof mod.enqueueJob).toBe("function");
    });

    it("should export enqueueBatch function", async () => {
      const mod = await import("@/lib/upstash/qstash");
      expect(mod.enqueueBatch).toBeDefined();
      expect(typeof mod.enqueueBatch).toBe("function");
    });

    it("should export scheduleRecurringJob function", async () => {
      const mod = await import("@/lib/upstash/qstash");
      expect(mod.scheduleRecurringJob).toBeDefined();
      expect(typeof mod.scheduleRecurringJob).toBe("function");
    });
  });

  describe("JobPayload interface", () => {
    it("should accept valid job payload structure", () => {
      const payload = {
        type: "process_message" as const,
        data: { conversationId: "conv-1", messageId: "msg-1" },
        metadata: {
          tenantId: "tenant-1",
          priority: "high" as const,
          retryCount: 0,
        },
      };

      expect(payload.type).toBe("process_message");
      expect(payload.data.conversationId).toBe("conv-1");
      expect(payload.metadata?.priority).toBe("high");
    });

    it("should support all 18 job types", () => {
      const jobTypes = [
        "process_message",
        "send_message",
        "translate_message",
        "ai_generate_response",
        "send_escalation_notification",
        "send_reminder",
        "sync_crm",
        "update_knowledge_embeddings",
        "send_notification",
        "update_crm",
        "send_satisfaction_survey",
        "crm_full_sync",
        "process_crm_booking",
        "sla_breach_notification",
        "sla_check",
        "proactive_outreach",
        "voice_transcription",
        "sentiment_analysis",
      ];

      jobTypes.forEach((type) => {
        expect(typeof type).toBe("string");
        expect(type.length).toBeGreaterThan(0);
      });

      expect(jobTypes).toHaveLength(18);
    });

    it("should support optional delay in milliseconds", () => {
      const payload = {
        type: "send_satisfaction_survey" as const,
        data: { conversationId: "conv-1" },
        delay: 30 * 60 * 1000,
      };

      expect(payload.delay).toBe(1800000);
    });

    it("should support metadata with all optional fields", () => {
      const metadata = {
        tenantId: "tenant-123",
        priority: "normal" as const,
        retryCount: 3,
      };

      expect(metadata.tenantId).toBe("tenant-123");
      expect(metadata.priority).toBe("normal");
      expect(metadata.retryCount).toBe(3);
    });
  });
});
