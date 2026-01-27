import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { lineAdapter, UnifiedInboundMessage } from "@/services/channels";
import { serverCustomerService } from "@/services/customers";
import { serverConversationService } from "@/services/conversations";
import { serverMessageService } from "@/services/messages";
import { translationService, SupportedLanguage } from "@/services/translation";
import { ragPipeline } from "@/services/ai";
import { serverEscalationService } from "@/services/escalations";
import { enqueueJob } from "@/lib/upstash/qstash";

// Disable body parsing for signature verification
export const dynamic = "force-dynamic";

/**
 * LINE Webhook Handler
 * Receives messages from LINE and processes them through the CS automation pipeline
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get("x-line-signature") || "";
    const channelSecret = process.env.LINE_CHANNEL_SECRET || "";

    // Verify signature
    if (!lineAdapter.validateSignature(rawBody, signature, channelSecret)) {
      console.error("Invalid LINE webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);

    // Parse webhook to unified format
    const messages = await lineAdapter.parseWebhook(payload);

    if (messages.length === 0) {
      return NextResponse.json({ success: true });
    }

    // Process each message
    for (const message of messages) {
      await processInboundMessage(message);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("LINE webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
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
    .eq("channel_type", "line")
    .eq("account_id", message.channelAccountId)
    .single();

  if (!channelAccount) {
    console.error(`Channel account not found: ${message.channelAccountId}`);
    return;
  }

  const channelAccountData = channelAccount as unknown as {
    id: string;
    tenant_id: string;
    tenant: { ai_config?: { enabled?: boolean } };
  };

  const tenantId = channelAccountData.tenant_id;
  const tenant = channelAccountData.tenant;

  // 2. Find or create customer
  let userProfile: { displayName?: string; pictureUrl?: string } = {};
  try {
    userProfile = await lineAdapter.getUserProfile(
      message.channelAccountId,
      message.channelUserId
    );
  } catch (e) {
    console.error("Failed to get LINE user profile:", e);
  }

  const { customer, customerChannel, isNew } =
    await serverCustomerService.findOrCreateCustomer({
      tenantId,
      channelAccountId: channelAccountData.id,
      channelUserId: message.channelUserId,
      channelUsername: userProfile.displayName || message.channelUsername,
      name: userProfile.displayName,
      profileImageUrl: userProfile.pictureUrl,
      language: "JA", // Default for LINE users (mostly Japanese)
    });

  // 3. Get or create conversation
  const conversation = await serverConversationService.getOrCreateConversation(
    customer.id,
    tenantId
  );

  // 4. Detect language and translate message
  let messageText = message.text || "";
  let originalLanguage: SupportedLanguage = "JA";
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

  // 5. Save inbound message
  const savedMessage = await serverMessageService.createInboundMessage({
    conversationId: conversation.id,
    customerChannelId: customerChannel.id,
    content: messageText,
    contentType: message.contentType,
    mediaUrl: message.mediaUrl,
    originalLanguage: originalLanguage,
    externalId: message.messageId,
    metadata: {
      sticker: message.sticker,
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

  // 6. Check if AI is enabled for this conversation and tenant
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

  // 7. Process through RAG pipeline
  const queryText = translatedText || messageText;
  const ragResult = await ragPipeline.process({
    query: queryText,
    tenantId,
    conversationId: conversation.id,
    customerLanguage: originalLanguage,
  });

  // 8. Handle escalation or send AI response
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

    // Send response to LINE
    const responseText = ragResult.translatedResponse || ragResult.response;

    await enqueueJob({
      type: "send_message",
      data: {
        messageId: aiMessage.id,
        channelType: "line",
        channelAccountId: channelAccountData.id,
        channelUserId: message.channelUserId,
        content: responseText,
      },
    });
  }
}

/**
 * LINE webhook verification (GET request)
 */
export async function GET() {
  return NextResponse.json({ status: "LINE webhook endpoint active" });
}
