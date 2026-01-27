import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { translationService, SupportedLanguage } from "@/services/translation";
import { enqueueJob } from "@/lib/upstash/qstash";

export const dynamic = "force-dynamic";

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
    } = body;

    // Validate required fields
    if (!conversationId || !content) {
      return NextResponse.json(
        { error: "conversationId and content are required" },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // 1. Look up the conversation with customer and channel info
    const { data: conversation, error: convError } = await (supabase
      .from("conversations") as any)
      .select(
        `
        *,
        customer:customers(*),
        customer_channel:customer_channels(
          *,
          channel_account:channel_accounts(*)
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
    const customerChannel = (conversation as any).customer_channel;

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found for this conversation" },
        { status: 404 }
      );
    }

    // 2. Determine customer language
    const customerLanguage: SupportedLanguage =
      (customer.language as SupportedLanguage) || "EN";

    // 3. Translate if requested and customer language is not Korean
    let translatedContent: string | undefined;
    let translatedLanguage: string | undefined;

    if (translateToCustomerLanguage && customerLanguage !== "KO") {
      try {
        const translation = await translationService.translateForCS(
          content,
          "to_customer",
          customerLanguage
        );
        translatedContent = translation.text;
        translatedLanguage = customerLanguage;
      } catch (translationError) {
        console.error("Translation failed, sending original:", translationError);
        // Continue without translation - agent message will be sent in original language
      }
    }

    // 4. Save the agent message to the database
    const insertData: Record<string, unknown> = {
      conversation_id: conversationId,
      direction: "outbound",
      sender_type: "agent",
      content_type: contentType || "text",
      content: content,
      original_language: "KO",
      status: "pending",
      metadata: {},
    };

    if (mediaUrl) {
      insertData.media_url = mediaUrl;
    }

    if (translatedContent) {
      insertData.translated_content = translatedContent;
      insertData.translated_language = translatedLanguage;
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

      await enqueueJob({
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
