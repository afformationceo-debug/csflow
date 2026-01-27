import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
}));

vi.mock("@/lib/upstash/qstash", () => ({
  enqueueJob: vi.fn().mockResolvedValue(null),
}));

import { slaMonitoringService } from "@/services/sla-monitoring";

describe("SLA Monitoring Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getDefaultSLAConfig", () => {
    it("should return default config with correct structure", () => {
      const config = slaMonitoringService.getDefaultSLAConfig("tenant-1");

      expect(config.tenantId).toBe("tenant-1");
      expect(config.name).toBe("Default SLA");
      expect(config.isActive).toBe(true);
    });

    it("should have correct default first response targets", () => {
      const config = slaMonitoringService.getDefaultSLAConfig("tenant-1");

      expect(config.targets.firstResponseTime.target).toBe(5);
      expect(config.targets.firstResponseTime.warning).toBe(3);
    });

    it("should have correct default resolution time targets", () => {
      const config = slaMonitoringService.getDefaultSLAConfig("tenant-1");

      expect(config.targets.resolutionTime.target).toBe(240); // 4 hours
      expect(config.targets.resolutionTime.warning).toBe(120); // 2 hours
    });

    it("should have correct AI response rate targets", () => {
      const config = slaMonitoringService.getDefaultSLAConfig("tenant-1");

      expect(config.targets.aiResponseRate.target).toBe(80);
      expect(config.targets.aiResponseRate.warning).toBe(70);
    });

    it("should have correct customer satisfaction targets", () => {
      const config = slaMonitoringService.getDefaultSLAConfig("tenant-1");

      expect(config.targets.customerSatisfaction.target).toBe(4.0);
      expect(config.targets.customerSatisfaction.warning).toBe(3.5);
    });

    it("should have correct escalation rate targets", () => {
      const config = slaMonitoringService.getDefaultSLAConfig("tenant-1");

      expect(config.targets.escalationRate.target).toBe(20);
      expect(config.targets.escalationRate.warning).toBe(30);
    });

    it("should have Korea/Seoul timezone in business hours", () => {
      const config = slaMonitoringService.getDefaultSLAConfig("tenant-1");

      expect(config.businessHours.timezone).toBe("Asia/Seoul");
    });

    it("should have correct weekday schedule (Mon-Fri 9-18)", () => {
      const config = slaMonitoringService.getDefaultSLAConfig("tenant-1");
      const schedule = config.businessHours.schedule;

      // Monday through Friday
      for (const day of ["1", "2", "3", "4", "5"]) {
        expect(schedule[day].isWorkday).toBe(true);
        expect(schedule[day].start).toBe("09:00");
        expect(schedule[day].end).toBe("18:00");
      }
    });

    it("should have weekends as non-workdays", () => {
      const config = slaMonitoringService.getDefaultSLAConfig("tenant-1");
      const schedule = config.businessHours.schedule;

      // Sunday and Saturday
      expect(schedule["0"].isWorkday).toBe(false);
      expect(schedule["6"].isWorkday).toBe(false);
    });

    it("should have 3-level escalation policy", () => {
      const config = slaMonitoringService.getDefaultSLAConfig("tenant-1");
      const levels = config.escalationPolicy.levels;

      expect(levels).toHaveLength(3);
    });

    it("should have increasing escalation thresholds", () => {
      const config = slaMonitoringService.getDefaultSLAConfig("tenant-1");
      const levels = config.escalationPolicy.levels;

      expect(levels[0].thresholdMinutes).toBe(15);
      expect(levels[1].thresholdMinutes).toBe(60);
      expect(levels[2].thresholdMinutes).toBe(240);
    });

    it("should have increasing notification channels per level", () => {
      const config = slaMonitoringService.getDefaultSLAConfig("tenant-1");
      const levels = config.escalationPolicy.levels;

      expect(levels[0].notifyChannels).toEqual(["email"]);
      expect(levels[1].notifyChannels).toEqual(["email", "slack"]);
      expect(levels[2].notifyChannels).toEqual(["email", "slack", "sms"]);
    });

    it("should have auto-assign enabled for level 2+", () => {
      const config = slaMonitoringService.getDefaultSLAConfig("tenant-1");
      const levels = config.escalationPolicy.levels;

      expect(levels[0].autoAssign).toBe(false);
      expect(levels[1].autoAssign).toBe(true);
      expect(levels[2].autoAssign).toBe(true);
    });

    it("should have no holidays by default", () => {
      const config = slaMonitoringService.getDefaultSLAConfig("tenant-1");

      expect(config.businessHours.holidays).toEqual([]);
    });
  });

  describe("mapSLAConfig", () => {
    it("should correctly map database row to SLAConfig", () => {
      const dbRow = {
        id: "config-1",
        tenant_id: "tenant-1",
        name: "Custom SLA",
        description: "Custom SLA configuration",
        targets: {
          firstResponseTime: { target: 3, warning: 2 },
          resolutionTime: { target: 180, warning: 90 },
          aiResponseRate: { target: 85, warning: 75 },
          customerSatisfaction: { target: 4.5, warning: 4.0 },
          escalationRate: { target: 15, warning: 25 },
        },
        business_hours: {
          timezone: "Asia/Tokyo",
          schedule: {},
          holidays: [],
        },
        escalation_policy: {
          levels: [],
        },
        is_active: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-15T00:00:00Z",
      };

      const config = slaMonitoringService.mapSLAConfig(dbRow);

      expect(config.id).toBe("config-1");
      expect(config.tenantId).toBe("tenant-1");
      expect(config.name).toBe("Custom SLA");
      expect(config.description).toBe("Custom SLA configuration");
      expect(config.targets.firstResponseTime.target).toBe(3);
      expect(config.businessHours.timezone).toBe("Asia/Tokyo");
      expect(config.isActive).toBe(true);
      expect(config.createdAt).toBeInstanceOf(Date);
      expect(config.updatedAt).toBeInstanceOf(Date);
    });

    it("should handle null description", () => {
      const dbRow = {
        id: "config-2",
        tenant_id: "tenant-2",
        name: "Test",
        description: null,
        targets: {} as any,
        business_hours: { timezone: "UTC", schedule: {}, holidays: [] },
        escalation_policy: { levels: [] },
        is_active: false,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      const config = slaMonitoringService.mapSLAConfig(dbRow);
      expect(config.description).toBeNull();
      expect(config.isActive).toBe(false);
    });
  });
});
