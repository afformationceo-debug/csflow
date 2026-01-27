import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { wechatAdapter, UnifiedInboundMessage } from "@/services/channels";
import { serverCustomerService } from "@/services/customers";
import { serverConversationService } from "@/services/conversations";
import { serverMessageService } from "@/services/messages";
import { translationService, SupportedLanguage } from "@/services/translation";
import { ragPipeline } from "@/services/ai";
import { serverEscalationService } from "@/services/escalations";
import { enqueueJob } from "@/lib/upstash/qstash";

export const dynamic = "force-dynamic";

/**
 * WeChat Webhook Handler
 *
 * Handles both:
 * 1. GET - Webhook verification (echostr challenge)
 * 2. POST - Incoming messages and events
 */

/**
 * Webhook verification (GET request)
 * WeChat sends: signature, timestamp, nonce, echostr
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const signature = searchParams.get("signature") || "";
  const timestamp = searchParams.get("timestamp") || "";
  const nonce = searchParams.get("nonce") || "";
  const echostr = searchParams.get("echostr") || "";

  // Get token from environment or first channel account
  const token = process.env.WECHAT_VERIFY_TOKEN;

  if (!token) {
    console.error("WeChat verify token not configured");
    return new NextResponse("Configuration error", { status: 500 });
  }

  // Validate signature
  const payload = `${timestamp},${nonce}`;
  const isValid = wechatAdapter.validateSignature(payload, signature, token);

  if (isValid) {
    // Return echostr to complete verification
    return new NextResponse(echostr, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new NextResponse("Invalid signature", { status: 401 });
}

/**
 * Handle incoming messages (POST request)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify signature
    const searchParams = request.nextUrl.searchParams;
    const signature = searchParams.get("signature") || "";
    const timestamp = searchParams.get("timestamp") || "";
    const nonce = searchParams.get("nonce") || "";

    const token = process.env.WECHAT_VERIFY_TOKEN;

    if (!token) {
      console.error("WeChat verify token not configured");
      return new NextResponse("Configuration error", { status: 500 });
    }

    const payload = `${timestamp},${nonce}`;
    if (!wechatAdapter.validateSignature(payload, signature, token)) {
      console.error("Invalid WeChat webhook signature");
      return new NextResponse("Invalid signature", { status: 401 });
    }

    // Get raw XML body
    const rawBody = await request.text();

    // Parse webhook to unified format
    const messages = await wechatAdapter.parseWebhook(rawBody);

    if (messages.length === 0) {
      // Return success for events we don't process
      return new NextResponse("success", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // Process each message
    for (const message of messages) {
      await processInboundMessage(message);
    }

    // WeChat expects "success" or empty string for acknowledgment
    return new NextResponse("success", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (error) {
    console.error("WeChat webhook error:", error);
    // Still return success to prevent WeChat from retrying
    return new NextResponse("success", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

/**
 * Process a single inbound message
 */
async function processInboundMessage(message: UnifiedInboundMessage) {
  const supabase = await createServiceClient();

  // 1. Find channel account and tenant
  const { data: channelAccount } = await supabase
    .from("channel_accounts")
    .select("*, tenant:tenants(*)")
    .eq("channel_type", "wechat")
    .eq("account_id", message.channelAccountId)
    .single();

  if (!channelAccount) {
    console.error(`WeChat channel account not found: ${message.channelAccountId}`);
    return;
  }

  const channelAccountData = channelAccount as unknown as {
    id: string;
    tenant_id: string;
    tenant: { ai_config?: { enabled?: boolean } };
  };

  const tenantId = channelAccountData.tenant_id;
  const tenant = channelAccountData.tenant;

  // 2. Get user profile
  let userProfile: { displayName?: string; pictureUrl?: string } = {};
  try {
    userProfile = await wechatAdapter.getUserProfile!(
      message.channelAccountId,
      message.channelUserId
    );
  } catch (e) {
    console.error("Failed to get WeChat user profile:", e);
  }

  // 3. Find or create customer
  const { customer, customerChannel } =
    await serverCustomerService.findOrCreateCustomer({
      tenantId,
      channelAccountId: channelAccountData.id,
      channelUserId: message.channelUserId,
      channelUsername: userProfile.displayName || message.channelUsername,
      name: userProfile.displayName,
      profileImageUrl: userProfile.pictureUrl,
      language: "ZH", // Default for WeChat users (Chinese)
    });

  // 4. Get or create conversation
  const conversation = await serverConversationService.getOrCreateConversation(
    customer.id,
    tenantId
  );

  // 5. Detect language and translate message
  let messageText = message.text || "";
  let originalLanguage: SupportedLanguage = "ZH";
  let translatedText: string | undefined;

  if (messageText) {
    originalLanguage = await translationService.detectLanguage(messageText);

    // Translate to Korean if not Korean
    if (originalLanguage !== "KO") {
      const translation = await translationService.translateForCS(
        messageText,
        "to_agent",
        originalLanguage
      );
      translatedText = translation.text;
    }
  }

  // 6. Save inbound message
  const savedMessage = await serverMessageService.createInboundMessage({
    conversationId: conversation.id,
    customerChannelId: customerChannel.id,
    content: messageText,
    contentType: message.contentType,
    mediaUrl: message.mediaUrl,
    originalLanguage: originalLanguage,
    externalId: message.messageId,
    metadata: {
      location: message.location,
    },
  });

  // Update translated content if available
  if (translatedText) {
    await serverMessageService.updateTranslation(
      savedMessage.id,
      translatedText,
      "KO"
    );
  }

  // 7. Check if AI is enabled for this conversation and tenant
  const aiConfig = (tenant as { ai_config?: { enabled?: boolean } }).ai_config;
  const aiEnabled = conversation.ai_enabled && aiConfig?.enabled;

  if (!aiEnabled || !messageText) {
    // Mark as waiting for agent
    await (supabase
      .from("conversations") as unknown as { update: (data: unknown) => { eq: (col: string, val: string) => unknown } })
      .update({ status: "waiting" })
      .eq("id", conversation.id);
    return;
  }

  // 8. Process through RAG pipeline
  const queryText = translatedText || messageText;
  const ragResult = await ragPipeline.process({
    query: queryText,
    tenantId,
    conversationId: conversation.id,
    customerLanguage: originalLanguage,
  });

  // 9. Handle escalation or send AI response
  if (ragResult.shouldEscalate) {
    // Create escalation
    await serverEscalationService.createEscalation({
      conversationId: conversation.id,
      messageId: savedMessage.id,
      reason: ragResult.escalationReason || "AI 신뢰도 미달",
      aiConfidence: ragResult.confidence,
    });

    // Update conversation status
    await (supabase
      .from("conversations") as unknown as { update: (data: unknown) => { eq: (col: string, val: string) => unknown } })
      .update({ status: "escalated" })
      .eq("id", conversation.id);
  } else if (ragResult.response) {
    // Save AI response
    const aiMessage = await serverMessageService.createAIMessage({
      conversationId: conversation.id,
      content: ragResult.response,
      originalLanguage: "KO",
      translatedContent: ragResult.translatedResponse,
      translatedLanguage: originalLanguage,
      aiConfidence: ragResult.confidence,
      aiModel: ragResult.model,
    });

    // Send response to WeChat
    const responseText = ragResult.translatedResponse || ragResult.response;

    await enqueueJob({
      type: "send_message",
      data: {
        messageId: aiMessage.id,
        channelType: "wechat",
        channelAccountId: channelAccountData.id,
        channelUserId: message.channelUserId,
        content: responseText,
      },
    });
  }
}
