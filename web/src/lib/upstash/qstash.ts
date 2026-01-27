import { Client } from "@upstash/qstash";

// Create QStash client only if token is available
const qstashToken = process.env.QSTASH_TOKEN;
export const qstash = qstashToken
  ? new Client({ token: qstashToken })
  : null;

// Job types
export type JobType =
  | "process_message"
  | "send_message"
  | "translate_message"
  | "ai_generate_response"
  | "send_escalation_notification"
  | "send_reminder"
  | "sync_crm"
  | "update_knowledge_embeddings"
  | "send_notification"
  | "update_crm"
  | "send_satisfaction_survey"
  | "crm_full_sync"
  | "process_crm_booking"
  | "sla_breach_notification"
  | "sla_check"
  | "proactive_outreach"
  | "voice_transcription"
  | "sentiment_analysis";

export interface JobPayload {
  type: JobType;
  data: Record<string, unknown>;
  metadata?: {
    tenantId?: string;
    priority?: "low" | "normal" | "high";
    retryCount?: number;
  };
  delay?: number; // Delay in milliseconds
}

// Queue endpoints
const QUEUE_ENDPOINTS = {
  process_message: "/api/jobs/process-message",
  send_message: "/api/jobs/send-message",
  translate_message: "/api/jobs/translate",
  ai_generate_response: "/api/jobs/ai-response",
  send_escalation_notification: "/api/jobs/escalation-notify",
  send_reminder: "/api/jobs/reminder",
  sync_crm: "/api/jobs/crm-sync",
  update_knowledge_embeddings: "/api/jobs/update-embeddings",
} as const;

export async function enqueueJob(payload: JobPayload, delay?: number) {
  if (!qstash) {
    console.warn("QStash not configured, skipping job:", payload.type);
    return null;
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const endpoint = QUEUE_ENDPOINTS[payload.type];

  const options: Parameters<typeof qstash.publishJSON>[0] = {
    url: `${baseUrl}${endpoint}`,
    body: payload,
    retries: 3,
  };

  if (delay) {
    options.delay = delay;
  }

  return qstash.publishJSON(options);
}

export async function enqueueBatch(jobs: JobPayload[]) {
  if (!qstash) {
    console.warn("QStash not configured, skipping batch jobs");
    return null;
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const messages = jobs.map((job) => ({
    destination: `${baseUrl}${QUEUE_ENDPOINTS[job.type]}`,
    body: JSON.stringify(job),
  }));

  return qstash.batchJSON(messages);
}

// Schedule recurring jobs
export async function scheduleRecurringJob(
  jobType: JobType,
  cron: string,
  payload: Omit<JobPayload, "type">
) {
  if (!qstash) {
    console.warn("QStash not configured, skipping schedule creation");
    return null;
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const endpoint = QUEUE_ENDPOINTS[jobType];

  return qstash.schedules.create({
    destination: `${baseUrl}${endpoint}`,
    cron,
    body: JSON.stringify({ type: jobType, ...payload }),
  });
}
