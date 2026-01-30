/**
 * Widget Service
 * Backend service for chatbot widget API endpoints
 */

import { createServiceClient } from "@/lib/supabase/server";
import { ragPipeline } from "@/services/ai/rag-pipeline";
import { translationService } from "@/services/translation";

export interface WidgetSession {
  id: string;
  tenantId: string;
  customerId?: string;
  conversationId?: string;
  language: string;
  metadata: {
    userAgent?: string;
    referrer?: string;
    startedAt: string;
    lastActivityAt: string;
  };
}

export interface WidgetMessageRequest {
  tenantId: string;
  sessionId: string;
  message: string;
  language?: string;
  attachments?: Array<{
    type: "image" | "file";
    url: string;
    name: string;
  }>;
}

export interface WidgetMessageResponse {
  response: string;
  isAI: boolean;
  confidence?: number;
  suggestedActions?: Array<{
    label: string;
    action: string;
  }>;
  escalated?: boolean;
}

/**
 * Create a new widget session
 */
export async function createWidgetSession(
  tenantId: string,
  language: string = "ko",
  metadata: Record<string, string> = {}
): Promise<WidgetSession> {
  const supabase = await createServiceClient();

  // Verify tenant exists and widget is enabled
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant, error: tenantError } = await (supabase as any)
    .from("tenants")
    .select("id, settings")
    .eq("id", tenantId)
    .single();

  if (tenantError || !tenant) {
    throw new Error("Invalid tenant ID");
  }

  const settings = (tenant as { settings: Record<string, unknown> }).settings;
  if (settings?.widget_enabled === false) {
    throw new Error("Widget is not enabled for this tenant");
  }

  // Create anonymous customer for widget visitor
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: customer, error: customerError } = await (supabase as any)
    .from("customers")
    .insert({
      tenant_id: tenantId,
      language,
      metadata: {
        source: "widget",
        ...metadata,
      },
    })
    .select()
    .single();

  if (customerError) {
    throw new Error(`Failed to create customer: ${customerError.message}`);
  }

  // Create conversation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conversation, error: convError } = await (supabase as any)
    .from("conversations")
    .insert({
      customer_id: customer.id,
      status: "open",
      priority: "normal",
      metadata: {
        source: "widget",
      },
    })
    .select()
    .single();

  if (convError) {
    throw new Error(`Failed to create conversation: ${convError.message}`);
  }

  const session: WidgetSession = {
    id: crypto.randomUUID(),
    tenantId,
    customerId: customer.id,
    conversationId: conversation.id,
    language,
    metadata: {
      ...metadata,
      startedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
    },
  };

  // Store session (in production, use Redis for session storage)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("customers").update({
    metadata: {
      ...customer.metadata,
      widget_session: session,
    },
  }).eq("id", customer.id);

  return session;
}

/**
 * Process widget message
 */
export async function processWidgetMessage(
  request: WidgetMessageRequest
): Promise<WidgetMessageResponse> {
  const supabase = await createServiceClient();
  const { tenantId, sessionId, message, language = "ko" } = request;

  // Get session info from customer
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: customers } = await (supabase as any)
    .from("customers")
    .select("id, metadata, conversations(id)")
    .eq("tenant_id", tenantId)
    .filter("metadata->widget_session->id", "eq", sessionId)
    .limit(1);

  const customer = customers?.[0];
  if (!customer) {
    throw new Error("Session not found");
  }

  const conversationId = (customer.metadata as { widget_session?: { conversationId?: string } })?.widget_session?.conversationId ||
    customer.conversations?.[0]?.id;

  if (!conversationId) {
    throw new Error("Conversation not found");
  }

  // Store user message
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: msgError } = await (supabase as any)
    .from("messages")
    .insert({
      conversation_id: conversationId,
      direction: "inbound",
      sender_type: "customer",
      content_type: "text",
      content: message,
      original_content: message,
      original_language: language,
    })
    .select()
    .single();

  if (msgError) {
    throw new Error(`Failed to store message: ${msgError.message}`);
  }

  // Translate if needed
  let translatedMessage = message;
  if (language !== "ko") {
    const translation = await translationService.translate(message, language as "KO" | "EN" | "JA" | "ZH" | "VI" | "TH", "KO");
    translatedMessage = translation.text;
  }

  // Process with RAG pipeline
  const ragResult = await ragPipeline.process({
    tenantId,
    conversationId,
    query: translatedMessage,
  });

  // Translate response back if needed
  let responseText = ragResult.response;
  if (language !== "ko") {
    const translation = await translationService.translate(responseText, "KO", language as "KO" | "EN" | "JA" | "ZH" | "VI" | "TH");
    responseText = translation.text;
  }

  // Determine if response should be escalated
  const shouldEscalate = ragResult.shouldEscalate || ragResult.confidence < 0.6;

  // Store AI response
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("messages").insert({
    conversation_id: conversationId,
    direction: "outbound",
    sender_type: shouldEscalate ? "ai" : "ai",
    content_type: "text",
    content: responseText,
    ai_confidence: ragResult.confidence,
    metadata: {
      rag_sources: ragResult.retrievedDocuments,
      escalation_reason: shouldEscalate ? ragResult.escalationReason : undefined,
    },
  });

  // Create escalation if needed
  if (shouldEscalate) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("escalations").insert({
      conversation_id: conversationId,
      reason: ragResult.escalationReason || "Low confidence AI response",
      ai_confidence: ragResult.confidence,
      priority: "normal",
      status: "pending",
    });

    // Update conversation status
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("conversations")
      .update({ status: "escalated" })
      .eq("id", conversationId);
  }

  // Update session activity
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("customers").update({
    metadata: {
      ...(customer.metadata as object),
      widget_session: {
        ...((customer.metadata as { widget_session?: object })?.widget_session || {}),
        lastActivityAt: new Date().toISOString(),
      },
    },
  }).eq("id", customer.id);

  return {
    response: responseText,
    isAI: true,
    confidence: ragResult.confidence,
    suggestedActions: [],
    escalated: shouldEscalate,
  };
}

/**
 * Get widget configuration for a tenant
 */
export async function getWidgetConfig(tenantId: string): Promise<{
  enabled: boolean;
  config: Record<string, unknown>;
}> {
  const supabase = await createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant, error } = await (supabase as any)
    .from("tenants")
    .select("settings")
    .eq("id", tenantId)
    .single();

  if (error || !tenant) {
    throw new Error("Tenant not found");
  }

  const settings = (tenant as { settings: Record<string, unknown> }).settings;

  return {
    enabled: settings?.widget_enabled !== false,
    config: {
      primaryColor: settings?.widget_primary_color || "#2563eb",
      title: settings?.widget_title || "채팅 상담",
      subtitle: settings?.widget_subtitle || "무엇을 도와드릴까요?",
      welcomeMessage: settings?.widget_welcome_message || "안녕하세요! 무엇을 도와드릴까요?",
      placeholder: settings?.widget_placeholder || "메시지를 입력하세요...",
      showPoweredBy: settings?.widget_show_powered_by !== false,
      avatarUrl: settings?.widget_avatar_url,
      position: settings?.widget_position || "bottom-right",
      customStyles: settings?.widget_custom_styles || {},
    },
  };
}

/**
 * Generate widget embed code
 */
export function generateEmbedCode(
  tenantId: string,
  apiUrl: string,
  options: Record<string, unknown> = {}
): string {
  const config = {
    tenantId,
    apiUrl,
    ...options,
  };

  return `<!-- CS Automation Chat Widget -->
<script>
  (function() {
    var config = ${JSON.stringify(config, null, 2)};

    var script = document.createElement('script');
    script.src = '${apiUrl}/widget.js';
    script.async = true;
    script.onload = function() {
      window.CSAutomation.init(config);
    };
    document.head.appendChild(script);
  })();
</script>`;
}

export const widgetService = {
  createWidgetSession,
  processWidgetMessage,
  getWidgetConfig,
  generateEmbedCode,
};
