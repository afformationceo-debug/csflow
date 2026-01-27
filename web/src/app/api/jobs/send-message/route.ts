import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendChannelMessage } from "@/services/channels";
import { serverMessageService } from "@/services/messages";
import { ChannelType } from "@/lib/supabase/types";

// Only import verifySignatureAppRouter if signing keys are available
const hasQStashKeys = !!(
  process.env.QSTASH_CURRENT_SIGNING_KEY &&
  process.env.QSTASH_NEXT_SIGNING_KEY
);

interface SendMessagePayload {
  type: "send_message";
  data: {
    messageId: string;
    channelType: ChannelType;
    channelAccountId: string;
    channelUserId: string;
    content: string;
    contentType?: "text" | "image";
    mediaUrl?: string;
  };
}

/**
 * Job handler for sending messages to channels
 * Triggered by QStash
 */
async function handler(request: NextRequest) {
  try {
    const payload: SendMessagePayload = await request.json();
    const { data } = payload;

    const supabase = await createServiceClient();

    // Get channel account credentials
    const { data: channelAccount } = await supabase
      .from("channel_accounts")
      .select("*")
      .eq("id", data.channelAccountId)
      .single();

    if (!channelAccount) {
      console.error(`Channel account not found: ${data.channelAccountId}`);
      return NextResponse.json(
        { error: "Channel account not found" },
        { status: 404 }
      );
    }

    // Update message status to processing
    await serverMessageService.updateMessageStatus(data.messageId, "processing");

    // Send message via channel adapter
    const result = await sendChannelMessage(data.channelType, data.channelAccountId, {
      channelType: data.channelType,
      channelUserId: data.channelUserId,
      contentType: data.contentType || "text",
      text: data.content,
      mediaUrl: data.mediaUrl,
    });

    if (result.success) {
      // Update message status to sent
      await serverMessageService.updateMessageStatus(
        data.messageId,
        "sent",
        result.messageId
      );

      return NextResponse.json({
        success: true,
        messageId: result.messageId,
      });
    } else {
      // Update message status to failed
      await serverMessageService.updateMessageStatus(data.messageId, "failed");

      console.error(`Failed to send message: ${result.error}`);
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Send message job error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Wrap with QStash signature verification if keys are available
// Otherwise, use the handler directly (for development)
export async function POST(request: NextRequest) {
  if (hasQStashKeys) {
    // Dynamically import and verify signature
    const { verifySignatureAppRouter } = await import("@upstash/qstash/nextjs");
    const verifiedHandler = verifySignatureAppRouter(handler);
    return verifiedHandler(request);
  }
  // In development without QStash keys, just run the handler
  return handler(request);
}
