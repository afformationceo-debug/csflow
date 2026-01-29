import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { translationService, SupportedLanguage } from "@/services/translation";
import { enqueueJob } from "@/lib/upstash/qstash";
import { sendChannelMessage } from "@/services/channels";
import { ChannelType } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/messages?action=translate&text=...&targetLang=...
 * Real-time translation preview via DeepL
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get("action");

  if (action === "translate") {
    const text = searchParams.get("text") || "";
    const targetLang = (searchParams.get("targetLang") || "EN") as SupportedLanguage;

    if (!text.trim()) {
      return NextResponse.json({ translated: "" });
    }

    try {
      const translation = await translationService.translateForCS(
        text,
        "to_customer",
        targetLang
      );
      return NextResponse.json({
        translated: translation.text,
        sourceLang: "KO",
        targetLang,
      });
    } catch (err) {
      console.error("Translation preview error:", err);
      return NextResponse.json({ translated: "", error: "Translation failed" });
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

/**
 * POST /api/messages
 * Agent-initiated outbound message with optional DeepL translation.
 *
 * Body:
 *   - conversationId: string (required)
 *   - content: string (required)
 *   - contentType?: string (default: "text")
 *   - mediaUrl?: string
 *   - translateToCustomerLanguage?: boolean (default: true)
 *   - isInternalNote?: boolean (default: false) — saves as internal note, not sent to customer
 *   - targetLanguage?: string — override customer language for translation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      conversationId,
      content,
      contentType,
      mediaUrl,
      translateToCustomerLanguage = true,
      isInternalNote = false,
      targetLanguage,
      senderType = "agent",
      aiMetadata,
    } = body;

    // Validate required fields
    if (!conversationId || !content) {
      return NextResponse.json(
        { error: "conversationId and content are required" },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // ── Internal Note: save without sending to channel ──
    if (isInternalNote) {
      const noteData: Record<string, unknown> = {
        conversation_id: conversationId,
        direction: "outbound",
        sender_type: "internal_note",
        content_type: "text",
        content: content,
        original_language: "KO",
        status: "sent",
        metadata: { internal: true },
      };

      const { data: note, error: noteError } = await (supabase
        .from("messages") as any)
        .insert(noteData)
        .select()
        .single();

      if (noteError) {
        console.error("Failed to save internal note:", noteError);
        return NextResponse.json(
          { error: "Failed to save internal note" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, message: note });
    }

    // ── Regular outbound message ──

    // 1. Look up the conversation with customer and channel info
    const { data: conversation, error: convError } = await (supabase
      .from("conversations") as any)
      .select(
        `
        *,
        customer:customers(
          *,
          customer_channels(
            *,
            channel_account:channel_accounts(*)
          )
        )
      `
      )
      .eq("id", conversationId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const customer = (conversation as any).customer;
    // customer_channels is nested under customer
    const customerChannels = customer?.customer_channels || [];
    const customerChannel = customerChannels[0];

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found for this conversation" },
        { status: 404 }
      );
    }

    // 2. Determine target language (prefer explicit targetLanguage, fallback to customer language)
    const customerLanguage: SupportedLanguage =
      (targetLanguage as SupportedLanguage) || (customer.language as SupportedLanguage) || "EN";

    // 3. Translate if requested and customer language is not Korean
    let translatedContent: string | undefined;
    let translatedLanguage: string | undefined;

    console.log("[Messages API] Translation context:", {
      customerLanguage,
      translateToCustomerLanguage,
      contentLength: content.length,
      contentFull: content,
    });

    if (translateToCustomerLanguage && customerLanguage !== "KO") {
      try {
        const translation = await translationService.translateForCS(
          content,
          "to_customer",
          customerLanguage
        );
        translatedContent = translation.text;
        translatedLanguage = customerLanguage;

        console.log("[Messages API] Translation result:", {
          originalLength: content.length,
          originalFull: content,
          translatedLength: translatedContent.length,
          translatedFull: translatedContent,
          targetLang: translatedLanguage,
          detectedSourceLang: translation.detectedSourceLang,
        });
      } catch (translationError) {
        console.error("Translation failed, sending original:", translationError);
        // Continue without translation - agent message will be sent in original language
      }
    } else {
      console.log("[Messages API] Skipping translation:", {
        reason: customerLanguage === "KO" ? "Customer language is Korean" : "Translation disabled",
      });
    }

    // 4. Save the agent/AI message to the database
    const metadata: Record<string, unknown> = {};
    if (aiMetadata) {
      metadata.ai_confidence = aiMetadata.confidence;
      metadata.ai_sources = aiMetadata.sources;
      metadata.ai_logs = aiMetadata.logs;
    }

    // For outbound messages (agent/AI → customer):
    // - content: customer language (e.g., English) — shown in main bubble
    // - translated_content: Korean original — shown in "원문 (한국어)" section
    const insertData: Record<string, unknown> = {
      conversation_id: conversationId,
      direction: "outbound",
      sender_type: senderType,
      content_type: contentType || "text",
      content: translatedContent || content, // Customer language (or Korean if no translation)
      original_language: "KO",
      translated_content: translatedContent ? content : undefined, // Korean original (only if translated)
      translated_language: translatedContent ? "KO" : undefined,
      status: "pending",
      metadata,
    };

    if (mediaUrl) {
      insertData.media_url = mediaUrl;
    }

    const { data: message, error: msgError } = await (supabase
      .from("messages") as any)
      .insert(insertData)
      .select()
      .single();

    if (msgError) {
      console.error("Failed to save agent message:", msgError);
      return NextResponse.json(
        { error: "Failed to save message" },
        { status: 500 }
      );
    }

    // 5. Update conversation last_message_at and status
    await (supabase
      .from("conversations") as any)
      .update({
        last_message_at: new Date().toISOString(),
        status: "open",
      })
      .eq("id", conversationId);

    // 6. Enqueue job to send the message through the appropriate channel
    if (customerChannel?.channel_account) {
      const channelAccount = (customerChannel as any).channel_account;
      const channelType = channelAccount.channel_type;
      const channelAccountId = channelAccount.id;
      const channelUserId = (customerChannel as any).channel_user_id;

      // Send the translated content if available, otherwise the original
      const outboundContent = translatedContent || content;

      const enqueued = await enqueueJob({
        type: "send_message",
        data: {
          messageId: message.id,
          channelType,
          channelAccountId,
          channelUserId,
          content: outboundContent,
          contentType: contentType || "text",
          mediaUrl: mediaUrl || undefined,
        },
      });

      // If QStash not configured, send directly
      if (!enqueued) {
        console.log("[Messages] QStash not available, sending directly");
        try {
          const sendResult = await sendChannelMessage(channelType as ChannelType, channelAccountId, {
            channelType: channelType as ChannelType,
            channelUserId,
            contentType: (contentType || "text") as "text" | "image",
            text: outboundContent,
            mediaUrl: mediaUrl || undefined,
          });
          if (sendResult.success) {
            // Update message status to sent
            await (supabase.from("messages") as any)
              .update({ status: "sent", external_id: sendResult.messageId })
              .eq("id", message.id);
          } else {
            console.error("[Messages] Direct send failed:", sendResult.error);
            await (supabase.from("messages") as any)
              .update({ status: "failed" })
              .eq("id", message.id);
          }
        } catch (sendErr) {
          console.error("[Messages] Direct send error:", sendErr);
        }
      }
    } else {
      console.warn(
        `No channel info found for conversation ${conversationId}, message saved but not sent`
      );
    }

    return NextResponse.json({
      success: true,
      message,
    });
  } catch (error) {
    console.error("POST /api/messages error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
