import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  facebookAdapter,
  instagramAdapter,
  whatsappAdapter,
  UnifiedInboundMessage,
  ChannelAdapter,
} from "@/services/channels";
import { serverCustomerService } from "@/services/customers";
import { serverConversationService } from "@/services/conversations";
import { serverMessageService } from "@/services/messages";
import { translationService, SupportedLanguage } from "@/services/translation";
import { ragPipeline } from "@/services/ai/rag-pipeline";
import { serverEscalationService } from "@/services/escalations";
import { enqueueJob } from "@/lib/upstash/qstash";
import { ChannelType } from "@/lib/supabase/types";
import { analyzeImage } from "@/services/ai/image-analysis";
import { transcribeVoiceFromUrl } from "@/services/ai/voice-processing";

// Disable body parsing for signature verification
export const dynamic = "force-dynamic";

// Verify tokens for webhook subscription (set in each Meta App Dashboard)
// Supports per-platform verify tokens since FB/IG/WhatsApp may be separate apps
const VERIFY_TOKENS = [
  process.env.META_WEBHOOK_VERIFY_TOKEN,
  process.env.FB_WEBHOOK_VERIFY_TOKEN,
  process.env.IG_WEBHOOK_VERIFY_TOKEN,
  process.env.WHATSAPP_VERIFY_TOKEN,
].filter(Boolean) as string[];

// Fallback if no tokens configured
if (VERIFY_TOKENS.length === 0) {
  VERIFY_TOKENS.push("cs_automation_verify_token");
}

/**
 * Meta Unified Webhook Handler
 * Handles webhooks from Facebook Messenger, Instagram DM, and WhatsApp
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get("x-hub-signature-256") || "";

    // Try all available app secrets for signature verification
    // (FB and IG may be separate Meta apps with different secrets)
    const appSecrets = [
      process.env.FACEBOOK_APP_SECRET,
      process.env.INSTAGRAM_APP_SECRET,
    ].filter(Boolean) as string[];

    if (appSecrets.length > 0 && signature) {
      const isValid = appSecrets.some((secret) =>
        facebookAdapter.validateSignature(rawBody, signature, secret)
      );
      if (!isValid) {
        console.error("Invalid Meta webhook signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody);

    // Determine which platform the webhook is from
    const { platform, adapter, channelType } = detectPlatform(payload);

    if (!platform || !adapter) {
      console.error("Unknown webhook platform:", payload.object);
      return NextResponse.json({ error: "Unknown platform" }, { status: 400 });
    }

    // Parse webhook to unified format
    const messages = await adapter.parseWebhook(payload);

    if (messages.length === 0) {
      return NextResponse.json({ success: true });
    }

    // Process each message
    for (const message of messages) {
      await processInboundMessage(message, channelType, adapter);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Meta webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Webhook verification for subscription (GET request)
 * Required for initial webhook setup in Meta App Dashboard
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && VERIFY_TOKENS.includes(token)) {
    console.log("Meta webhook verified successfully");
    return new NextResponse(challenge, { status: 200 });
  }

  console.error("Meta webhook verification failed");
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

/**
 * Detect which Meta platform the webhook is from
 */
function detectPlatform(payload: { object: string }): {
  platform: "facebook" | "instagram" | "whatsapp" | null;
  adapter: ChannelAdapter | null;
  channelType: ChannelType | null;
} {
  switch (payload.object) {
    case "page":
      return {
        platform: "facebook",
        adapter: facebookAdapter,
        channelType: "facebook",
      };
    case "instagram":
      return {
        platform: "instagram",
        adapter: instagramAdapter,
        channelType: "instagram",
      };
    case "whatsapp_business_account":
      return {
        platform: "whatsapp",
        adapter: whatsappAdapter,
        channelType: "whatsapp",
      };
    default:
      return { platform: null, adapter: null, channelType: null };
  }
}

/**
 * Process a single inbound message
 */
async function processInboundMessage(
  message: UnifiedInboundMessage,
  channelType: ChannelType,
  adapter: ChannelAdapter
) {
  const supabase = await createServiceClient();

  // 1. Find channel account and tenant
  const { data: channelAccount } = await supabase
    .from("channel_accounts")
    .select("*, tenant:tenants(*)")
    .eq("channel_type", channelType)
    .eq("account_id", message.channelAccountId)
    .single();

  if (!channelAccount) {
    console.error(`Channel account not found: ${channelType}/${message.channelAccountId}`);
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
    if (adapter.getUserProfile) {
      userProfile = await adapter.getUserProfile(
        message.channelAccountId,
        message.channelUserId
      );
    }
  } catch (e) {
    console.error(`Failed to get ${channelType} user profile:`, e);
  }

  // Determine default language based on channel type
  const defaultLanguage: SupportedLanguage = getDefaultLanguage(channelType);

  const { customer, customerChannel } =
    await serverCustomerService.findOrCreateCustomer({
      tenantId,
      channelAccountId: channelAccountData.id,
      channelUserId: message.channelUserId,
      channelUsername: userProfile.displayName || message.channelUsername,
      name: userProfile.displayName || message.channelUsername,
      profileImageUrl: userProfile.pictureUrl || message.userProfileUrl,
      language: defaultLanguage,
    });

  // 3. Get or create conversation
  const conversation = await serverConversationService.getOrCreateConversation(
    customer.id,
    tenantId
  );

  // 4. Detect language and translate message
  let messageText = message.text || "";
  let originalLanguage: SupportedLanguage = defaultLanguage;
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
      channelType,
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

  // 5.5 Process image or audio messages
  if (message.contentType === "image" && message.mediaUrl) {
    try {
      const analysis = await analyzeImage(message.mediaUrl, {
        tenantId,
        context: messageText,
        language: originalLanguage === "KO" ? "ko" : originalLanguage?.toLowerCase(),
      });
      // Use image description as the message text for RAG
      messageText = analysis.suggestedResponse || analysis.description;
      // Store analysis in message metadata
      await (supabase.from("messages") as any)
        .update({
          content: messageText,
          metadata: {
            ...(savedMessage.metadata as Record<string, unknown> || {}),
            image_analysis: {
              category: analysis.category,
              tags: analysis.tags,
              medical_relevance: analysis.medicalRelevance,
              confidence: analysis.confidence,
            },
          },
        })
        .eq("id", savedMessage.id);
    } catch (e) {
      console.error("Image analysis failed:", e);
    }
  }

  if (message.contentType === "audio" && message.mediaUrl) {
    try {
      const transcription = await transcribeVoiceFromUrl(message.mediaUrl, {
        language: originalLanguage?.toLowerCase(),
      });
      // Use transcribed text for RAG
      messageText = transcription.text;
      // Store transcription in message
      await (supabase.from("messages") as any)
        .update({
          content: transcription.text,
          metadata: {
            ...(savedMessage.metadata as Record<string, unknown> || {}),
            voice_transcription: {
              duration: transcription.duration,
              confidence: transcription.confidence,
              language: transcription.language,
              segments: transcription.segments,
            },
          },
        })
        .eq("id", savedMessage.id);

      // Also translate transcription to Korean if needed
      if (transcription.language !== "ko") {
        const translation = await translationService.translateForCS(
          transcription.text,
          "to_agent"
        );
        translatedText = translation.text;
        await serverMessageService.updateTranslation(
          savedMessage.id,
          translation.text,
          "KO"
        );
      }
    } catch (e) {
      console.error("Voice transcription failed:", e);
    }
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
    // Create escalation with AI recommendations
    await serverEscalationService.createEscalation({
      conversationId: conversation.id,
      messageId: savedMessage.id,
      reason: ragResult.escalationReason || "AI 신뢰도 미달",
      aiConfidence: ragResult.confidence,
      recommendedAction: ragResult.recommendedAction,
      missingInfo: ragResult.missingInfo,
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

    // Send response to the appropriate channel
    const responseText = ragResult.translatedResponse || ragResult.response;

    await enqueueJob({
      type: "send_message",
      data: {
        messageId: aiMessage.id,
        channelType,
        channelAccountId: channelAccountData.id,
        channelUserId: message.channelUserId,
        content: responseText,
      },
    });

    // Mark message as seen (for supported channels)
    if (channelType === "whatsapp") {
      try {
        await whatsappAdapter.markAsRead(
          message.channelAccountId,
          message.messageId
        );
      } catch (e) {
        console.error("Failed to mark WhatsApp message as read:", e);
      }
    }
  }
}

/**
 * Get default language based on channel type
 */
function getDefaultLanguage(channelType: ChannelType): SupportedLanguage {
  // Default language assumptions based on common usage patterns
  // These can be overridden by language detection
  switch (channelType) {
    case "whatsapp":
      return "EN"; // WhatsApp is commonly used internationally
    case "facebook":
      return "EN"; // Facebook Messenger is commonly used internationally
    case "instagram":
      return "EN"; // Instagram is commonly used internationally
    case "line":
      return "JA"; // LINE is commonly used in Japan
    case "kakao":
      return "KO"; // KakaoTalk is commonly used in Korea
    default:
      return "EN";
  }
}
