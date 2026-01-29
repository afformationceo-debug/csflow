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
import { sendChannelMessage } from "@/services/channels";
import { analyzeImage } from "@/services/ai/image-analysis";
import { transcribeVoiceFromUrl } from "@/services/ai/voice-processing";

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
  // LINE webhook destination is a Bot User ID (U + hex), not Channel ID.
  // Try exact match first, then fallback to channel_type lookup with credentials match.
  let { data: channelAccount } = await supabase
    .from("channel_accounts")
    .select("*, tenant:tenants(*)")
    .eq("channel_type", "line")
    .eq("account_id", message.channelAccountId)
    .single();

  // Fallback: if destination doesn't match account_id, find any active LINE channel
  // and update account_id with the correct Bot User ID for future lookups
  if (!channelAccount) {
    const { data: fallbackAccount } = await supabase
      .from("channel_accounts")
      .select("*, tenant:tenants(*)")
      .eq("channel_type", "line")
      .eq("is_active", true)
      .limit(1)
      .single();

    if (fallbackAccount) {
      channelAccount = fallbackAccount;
      // Update account_id to the Bot User ID for faster future lookups
      await (supabase
        .from("channel_accounts") as any)
        .update({ account_id: message.channelAccountId })
        .eq("id", (fallbackAccount as unknown as { id: string }).id);
      console.log(
        `Updated LINE channel account_id to Bot User ID: ${message.channelAccountId}`
      );
    }
  }

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

  console.log(`[LINE] Processing message from user=${message.channelUserId}, tenant=${tenantId}`);

  // 2. Find or create customer
  let userProfile: { displayName?: string; pictureUrl?: string } = {};
  try {
    userProfile = await lineAdapter.getUserProfile(
      channelAccountData.id,
      message.channelUserId
    );
  } catch (e) {
    console.error("Failed to get LINE user profile:", e);
  }

  let customer: any;
  let customerChannel: any;
  try {
    // Detect initial language from message if available
    let initialLanguage: SupportedLanguage = "EN"; // Default to English (more universal than Japanese)
    if (message.text) {
      try {
        initialLanguage = await translationService.detectLanguage(message.text);
        console.log(`[LINE] Initial language detection: ${initialLanguage}`);
      } catch (e) {
        console.error("[LINE] Initial language detection failed:", e);
      }
    }

    const result = await serverCustomerService.findOrCreateCustomer({
      tenantId,
      channelAccountId: channelAccountData.id,
      channelUserId: message.channelUserId,
      channelUsername: userProfile.displayName || message.channelUsername,
      name: userProfile.displayName,
      profileImageUrl: userProfile.pictureUrl,
      language: initialLanguage,
    });
    customer = result.customer;
    customerChannel = result.customerChannel;
    console.log(`[LINE] Customer ${result.isNew ? "created" : "found"}: ${customer.id}, language: ${customer.language}`);
  } catch (e) {
    console.error("[LINE] findOrCreateCustomer failed:", e);
    return;
  }

  // 3. Get or create conversation
  let conversation: any;
  try {
    conversation = await serverConversationService.getOrCreateConversation(
      customer.id,
      tenantId
    );
    console.log(`[LINE] Conversation: ${conversation.id}`);
  } catch (e) {
    console.error("[LINE] getOrCreateConversation failed:", e);
    return;
  }

  // 4. Detect language and translate message
  let messageText = message.text || "";
  let originalLanguage: SupportedLanguage = "JA";
  let translatedText: string | undefined;

  if (messageText) {
    try {
      originalLanguage = await translationService.detectLanguage(messageText);
      console.log(`[LINE] Detected customer language: ${originalLanguage}`);

      // Update customer language if different from current
      if (customer.language !== originalLanguage) {
        try {
          await (supabase.from("customers") as any)
            .update({ language: originalLanguage })
            .eq("id", customer.id);
          customer.language = originalLanguage; // Update local copy
          console.log(`[LINE] Updated customer language to: ${originalLanguage}`);
        } catch (e) {
          console.error("[LINE] Failed to update customer language:", e);
        }
      }

      // Translate to Korean if not Korean
      if (originalLanguage !== "KO") {
        const translation = await translationService.translateForCS(
          messageText,
          "to_agent",
          originalLanguage
        );
        translatedText = translation.text;
      }
    } catch (e) {
      console.error("[LINE] Translation failed (continuing without):", e);
    }
  }

  // 5. Save inbound message
  let savedMessage: any;
  try {
    savedMessage = await serverMessageService.createInboundMessage({
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
    console.log(`[LINE] Message saved: ${savedMessage.id}`);
  } catch (e) {
    console.error("[LINE] createInboundMessage failed:", e);
    return;
  }

  // Update conversation with latest message info (safety net for missing DB trigger)
  try {
    await (supabase.from("conversations") as any)
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: (messageText || "").slice(0, 100),
        status: "active",
      })
      .eq("id", conversation.id);
  } catch (e) {
    console.error("[LINE] Update conversation last_message failed:", e);
  }

  // Update translated content if available
  if (translatedText) {
    try {
      await serverMessageService.updateTranslation(
        savedMessage.id,
        translatedText,
        "KO"
      );
    } catch (e) {
      console.error("[LINE] updateTranslation failed:", e);
    }
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

  // 6.5. Check conversation status - skip AI if already escalated or waiting for agent
  if (conversation.status === "escalated" || conversation.status === "waiting") {
    console.log(`[LINE] Conversation ${conversation.id} is ${conversation.status}, skipping AI response`);
    return;
  }

  // 6.6. IDEMPOTENCY CHECK - Prevent duplicate webhook processing using distributed lock
  const { acquireLock, releaseLock } = await import("@/lib/upstash/redis");
  const lockKey = `webhook:line:processing:${conversation.id}:${savedMessage.id}`;
  const lockAcquired = await acquireLock(lockKey, 300); // 5 minute lock

  if (!lockAcquired) {
    console.log(`[LINE] Message ${savedMessage.id} is already being processed by another webhook, skipping`);
    return;
  }

  console.log(`[LINE] Lock acquired for message ${savedMessage.id}, processing...`);

  try {
    // 6.7. Check if AI already responded to this customer message - prevent duplicate responses
    // Get messages newer than or equal to the current customer message
    const { data: recentMessages } = await (supabase as any)
      .from("messages")
      .select("id, sender_type, created_at, direction")
      .eq("conversation_id", conversation.id)
      .gte("created_at", savedMessage.created_at)
      .order("created_at", { ascending: true });

    if (recentMessages && recentMessages.length > 0) {
      // Check if there's already an AI response after this customer message
      const hasAIResponse = recentMessages.some((msg: any) =>
        msg.id !== savedMessage.id && msg.sender_type === "ai"
      );
      if (hasAIResponse) {
        console.log(`[LINE] AI already responded to this message, skipping duplicate response`);
        await releaseLock(lockKey);
        return;
      }
    }

    // 7. Process through RAG pipeline
    const queryText = translatedText || messageText;
    console.log(`[LINE] Processing RAG query: "${queryText.slice(0, 50)}..."`);
    const ragResult = await ragPipeline.process({
      query: queryText,
      tenantId,
      conversationId: conversation.id,
      customerLanguage: originalLanguage,
    });

    console.log(`[LINE] RAG result: confidence=${ragResult.confidence}, escalate=${ragResult.shouldEscalate}`);

    // 8. CRITICAL FIX: Check escalation FIRST before sending any AI response
    if (ragResult.shouldEscalate) {
      console.log(`[LINE] Escalation required (reason: ${ragResult.escalationReason}), NOT sending AI response`);

      // Check if escalation already exists for this conversation to prevent duplicates
      const { data: existingEscalations } = await (supabase as any)
        .from("escalations")
        .select("id")
        .eq("conversation_id", conversation.id)
        .in("status", ["open", "pending", "assigned", "in_progress"])
        .limit(1);

      if (!existingEscalations || existingEscalations.length === 0) {
        // Create escalation with AI recommendations
        await serverEscalationService.createEscalation({
          conversationId: conversation.id,
          messageId: savedMessage.id,
          reason: ragResult.escalationReason || "AI 신뢰도 미달",
          aiConfidence: ragResult.confidence,
          recommendedAction: ragResult.recommendedAction,
          missingInfo: ragResult.missingInfo,
          detectedQuestions: ragResult.detectedQuestions,
        });
        console.log(`[LINE] Escalation created for conversation ${conversation.id}`);
      } else {
        console.log(`[LINE] Escalation already exists for conversation ${conversation.id}, skipping`);
      }

      // Update conversation status
      await (supabase
        .from("conversations") as unknown as { update: (data: unknown) => { eq: (col: string, val: string) => unknown } })
        .update({ status: "escalated" })
        .eq("id", conversation.id);

      // Release lock and RETURN - DO NOT send AI response
      await releaseLock(lockKey);
      return;
    }

    // 9. Only send AI response if NOT escalating
    if (ragResult.response) {
      console.log(`[LINE] Confidence ${(ragResult.confidence * 100).toFixed(1)}% above threshold, sending AI response`);

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

      // Try QStash first, fallback to direct send
      const enqueued = await enqueueJob({
        type: "send_message",
        data: {
          messageId: aiMessage.id,
          channelType: "line",
          channelAccountId: channelAccountData.id,
          channelUserId: message.channelUserId,
          content: responseText,
        },
      });

      // If QStash not configured, send directly
      if (!enqueued) {
        console.log("[LINE] QStash not available, sending directly");
        try {
          const sendResult = await sendChannelMessage("line", channelAccountData.id, {
            channelType: "line",
            channelUserId: message.channelUserId,
            contentType: "text",
            text: responseText,
          });
          if (sendResult.success) {
            await serverMessageService.updateMessageStatus(aiMessage.id, "sent", sendResult.messageId);
            console.log("[LINE] AI response sent directly");
          } else {
            console.error("[LINE] Direct send failed:", sendResult.error);
            await serverMessageService.updateMessageStatus(aiMessage.id, "failed");
          }
        } catch (sendErr) {
          console.error("[LINE] Direct send error:", sendErr);
          await serverMessageService.updateMessageStatus(aiMessage.id, "failed");
        }
      }
    }

    // Release lock after successful processing
    await releaseLock(lockKey);
  } catch (e) {
    console.error("[LINE] RAG pipeline failed:", e);
    // Release lock on error
    await releaseLock(lockKey);
    // Mark conversation as waiting for agent if RAG fails
    await (supabase
      .from("conversations") as unknown as { update: (data: unknown) => { eq: (col: string, val: string) => unknown } })
      .update({ status: "waiting" })
      .eq("id", conversation.id);
  }
}

/**
 * LINE webhook verification (GET request)
 */
export async function GET() {
  return NextResponse.json({ status: "LINE webhook endpoint active" });
}
