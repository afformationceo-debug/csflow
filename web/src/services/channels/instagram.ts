import crypto from "crypto";
import {
  ChannelAdapter,
  UnifiedInboundMessage,
  UnifiedOutboundMessage,
  ChannelSendResult,
} from "./types";
import { MessageContentType } from "@/lib/supabase/types";

// Instagram Messaging API Types
interface InstagramWebhookEntry {
  id: string;
  time: number;
  messaging: InstagramMessagingEvent[];
}

interface InstagramMessagingEvent {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: {
    mid: string;
    text?: string;
    attachments?: {
      type: "image" | "video" | "audio" | "file" | "share" | "story_mention" | "story_reply";
      payload: {
        url?: string;
        reel_video_id?: string;
        title?: string;
      };
    }[];
    quick_reply?: {
      payload: string;
    };
    reply_to?: {
      mid: string;
      story?: {
        url: string;
        id: string;
      };
    };
    is_echo?: boolean;
    is_deleted?: boolean;
    is_unsupported?: boolean;
  };
  postback?: {
    mid: string;
    title: string;
    payload: string;
  };
  referral?: {
    ref: string;
    source: string;
    type: string;
    product_id?: string;
  };
  read?: {
    watermark: number;
  };
  reaction?: {
    mid: string;
    action: "react" | "unreact";
    reaction?: string;
    emoji?: string;
  };
}

interface InstagramWebhookBody {
  object: "instagram";
  entry: InstagramWebhookEntry[];
}

interface InstagramSendMessagePayload {
  recipient: { id: string };
  message: InstagramMessage;
}

interface InstagramMessage {
  text?: string;
  attachment?: {
    type: "image" | "video" | "audio" | "file" | "template";
    payload: {
      url?: string;
      is_reusable?: boolean;
      template_type?: string;
      elements?: unknown[];
    };
  };
  quick_replies?: {
    content_type: "text";
    title: string;
    payload: string;
  }[];
}

interface InstagramUserProfile {
  id: string;
  username?: string;
  name?: string;
  profile_picture_url?: string;
  follower_count?: number;
  is_verified_user?: boolean;
  is_user_follow_business?: boolean;
  is_business_follow_user?: boolean;
}

/**
 * Instagram Messaging API Adapter
 * Based on Trusflow implementation patterns
 */
export class InstagramAdapter implements ChannelAdapter {
  channelType = "instagram" as const;
  private graphApiVersion = "v18.0";
  private baseUrl = `https://graph.facebook.com/${this.graphApiVersion}`;

  /**
   * Parse Instagram webhook events to unified format
   */
  async parseWebhook(payload: InstagramWebhookBody): Promise<UnifiedInboundMessage[]> {
    const messages: UnifiedInboundMessage[] = [];

    if (payload.object !== "instagram") {
      return messages;
    }

    for (const entry of payload.entry) {
      const igAccountId = entry.id;

      for (const event of entry.messaging || []) {
        // Skip echo messages (messages sent by the business)
        if (event.message?.is_echo) {
          continue;
        }

        // Skip deleted or unsupported messages
        if (event.message?.is_deleted || event.message?.is_unsupported) {
          continue;
        }

        // Skip non-message events (read receipts, reactions, etc.)
        if (!event.message && !event.postback) {
          continue;
        }

        const senderId = event.sender.id;
        const timestamp = new Date(event.timestamp);

        // Handle postback (button click)
        if (event.postback) {
          messages.push({
            channelType: "instagram",
            channelAccountId: igAccountId,
            channelUserId: senderId,
            messageId: event.postback.mid,
            contentType: "text",
            text: event.postback.payload,
            timestamp,
            rawPayload: event,
          });
          continue;
        }

        // Handle message
        const message = event.message;
        if (!message) continue;

        // Handle quick reply
        if (message.quick_reply) {
          messages.push({
            channelType: "instagram",
            channelAccountId: igAccountId,
            channelUserId: senderId,
            messageId: message.mid,
            contentType: "text",
            text: message.quick_reply.payload,
            timestamp,
            rawPayload: event,
          });
          continue;
        }

        // Handle story reply
        if (message.reply_to?.story) {
          messages.push({
            channelType: "instagram",
            channelAccountId: igAccountId,
            channelUserId: senderId,
            messageId: message.mid,
            contentType: "text",
            text: message.text || "[Story Reply]",
            timestamp,
            rawPayload: event,
          });
          continue;
        }

        // Handle text message
        if (message.text && !message.attachments) {
          messages.push({
            channelType: "instagram",
            channelAccountId: igAccountId,
            channelUserId: senderId,
            messageId: message.mid,
            contentType: "text",
            text: message.text,
            timestamp,
            rawPayload: event,
          });
          continue;
        }

        // Handle attachments
        if (message.attachments) {
          for (const attachment of message.attachments) {
            const unifiedMessage = this.parseAttachment(
              attachment,
              igAccountId,
              senderId,
              message.mid,
              timestamp,
              event
            );
            if (unifiedMessage) {
              messages.push(unifiedMessage);
            }
          }
        }
      }
    }

    return messages;
  }

  /**
   * Parse attachment to unified message format
   */
  private parseAttachment(
    attachment: NonNullable<InstagramMessagingEvent["message"]>["attachments"][0],
    igAccountId: string,
    senderId: string,
    messageId: string,
    timestamp: Date,
    rawPayload: unknown
  ): UnifiedInboundMessage | null {
    let contentType: MessageContentType;
    let mediaUrl: string | undefined;
    let text: string | undefined;

    switch (attachment.type) {
      case "image":
        contentType = "image";
        mediaUrl = attachment.payload.url;
        break;

      case "video":
        contentType = "video";
        mediaUrl = attachment.payload.url;
        break;

      case "audio":
        contentType = "audio";
        mediaUrl = attachment.payload.url;
        break;

      case "file":
        contentType = "file";
        mediaUrl = attachment.payload.url;
        break;

      case "share":
        // Shared post/reel
        contentType = "text";
        text = `[Shared Content: ${attachment.payload.url || attachment.payload.reel_video_id || "Media"}]`;
        break;

      case "story_mention":
        // Story mention
        contentType = "text";
        text = `[Story Mention: ${attachment.payload.url || "Media"}]`;
        mediaUrl = attachment.payload.url;
        break;

      case "story_reply":
        // Story reply
        contentType = "text";
        text = `[Story Reply: ${attachment.payload.url || "Media"}]`;
        mediaUrl = attachment.payload.url;
        break;

      default:
        return null;
    }

    return {
      channelType: "instagram",
      channelAccountId: igAccountId,
      channelUserId: senderId,
      messageId: `${messageId}_${attachment.type}`,
      contentType,
      text,
      mediaUrl,
      timestamp,
      rawPayload,
    };
  }

  /**
   * Send message via Instagram
   */
  async sendMessage(
    channelAccountId: string,
    message: UnifiedOutboundMessage
  ): Promise<ChannelSendResult> {
    const accessToken = await this.getAccessToken(channelAccountId);

    const igMessage = this.convertToInstagramMessage(message);
    const payload: InstagramSendMessagePayload = {
      recipient: { id: message.channelUserId },
      message: igMessage,
    };

    try {
      const response = await fetch(
        `${this.baseUrl}/${channelAccountId}/messages?access_token=${accessToken}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: `Instagram API error: ${error.error?.message || response.status}`,
        };
      }

      const result = await response.json();
      return {
        success: true,
        messageId: result.message_id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Validate Instagram webhook signature
   */
  validateSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    // Instagram uses the same signature format as Facebook: sha256=<signature>
    const expectedSignature = signature.replace("sha256=", "");
    const hash = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(hash),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Get user profile from Instagram
   */
  async getUserProfile(
    channelAccountId: string,
    channelUserId: string
  ): Promise<{
    displayName?: string;
    pictureUrl?: string;
    statusMessage?: string;
  }> {
    const accessToken = await this.getAccessToken(channelAccountId);

    try {
      // Instagram requires different fields
      const response = await fetch(
        `${this.baseUrl}/${channelUserId}?fields=username,name,profile_picture_url&access_token=${accessToken}`
      );

      if (!response.ok) {
        return {};
      }

      const data: InstagramUserProfile = await response.json();

      return {
        displayName: data.name || data.username,
        pictureUrl: data.profile_picture_url,
      };
    } catch {
      return {};
    }
  }

  /**
   * Convert unified message to Instagram message format
   */
  private convertToInstagramMessage(message: UnifiedOutboundMessage): InstagramMessage {
    const igMessage: InstagramMessage = {};

    // Text message
    if (message.contentType === "text" && message.text) {
      igMessage.text = message.text;
    }

    // Image message
    if (message.contentType === "image" && message.mediaUrl) {
      igMessage.attachment = {
        type: "image",
        payload: {
          url: message.mediaUrl,
          is_reusable: true,
        },
      };
    }

    // Video message
    if (message.contentType === "video" && message.mediaUrl) {
      igMessage.attachment = {
        type: "video",
        payload: {
          url: message.mediaUrl,
          is_reusable: true,
        },
      };
    }

    // Audio message
    if (message.contentType === "audio" && message.mediaUrl) {
      igMessage.attachment = {
        type: "audio",
        payload: {
          url: message.mediaUrl,
          is_reusable: true,
        },
      };
    }

    // Quick replies (Instagram supports up to 13)
    if (message.quickReplies && message.quickReplies.length > 0) {
      igMessage.quick_replies = message.quickReplies.slice(0, 13).map((reply) => ({
        content_type: "text" as const,
        title: reply.label,
        payload: reply.value,
      }));
    }

    // Template message (Generic template)
    if (message.template) {
      igMessage.attachment = this.convertTemplate(message.template);
    }

    return igMessage;
  }

  /**
   * Convert template to Instagram format
   * Note: Instagram has limited template support compared to Facebook
   */
  private convertTemplate(
    template: NonNullable<UnifiedOutboundMessage["template"]>
  ): InstagramMessage["attachment"] {
    switch (template.type) {
      case "buttons":
      case "carousel":
        // Instagram supports generic template
        return {
          type: "template",
          payload: {
            template_type: "generic",
            elements: [
              {
                title: template.title,
                subtitle: template.text,
                image_url: template.thumbnailUrl,
                buttons: template.actions?.slice(0, 3).map((action) => {
                  if (action.type === "uri") {
                    return {
                      type: "web_url",
                      url: action.uri,
                      title: action.label,
                    };
                  } else {
                    return {
                      type: "postback",
                      title: action.label,
                      payload: action.data || action.text || action.label,
                    };
                  }
                }),
              },
            ],
          },
        };

      case "image":
        return {
          type: "image",
          payload: {
            url: template.thumbnailUrl,
            is_reusable: true,
          },
        };

      default:
        return undefined;
    }
  }

  /**
   * Send typing indicator (if supported)
   */
  async sendTypingIndicator(
    channelAccountId: string,
    channelUserId: string
  ): Promise<void> {
    // Instagram doesn't currently support typing indicators via API
    console.log(`Typing indicator not supported for Instagram: ${channelAccountId}, ${channelUserId}`);
  }

  /**
   * Get access token for channel
   */
  private async getAccessToken(channelAccountId: string): Promise<string> {
    try {
      const { createServiceClient } = await import("@/lib/supabase/server");
      const supabase = await createServiceClient();

      const { data: channelAccount } = await (supabase
        .from("channel_accounts") as unknown as {
          select: (cols: string) => {
            eq: (col: string, val: string) => {
              single: () => Promise<{ data: { credentials?: Record<string, unknown> } | null }>;
            };
          };
        })
        .select("credentials")
        .eq("account_id", channelAccountId)
        .single();

      if (channelAccount && channelAccount.credentials) {
        const credentials = channelAccount.credentials as { access_token?: string; page_access_token?: string };
        if (credentials.access_token) {
          return credentials.access_token;
        }
        if (credentials.page_access_token) {
          return credentials.page_access_token;
        }
      }
    } catch (error) {
      console.error("Failed to get channel credentials from DB:", error);
    }

    // Fallback to environment variable
    return process.env.INSTAGRAM_ACCESS_TOKEN || "";
  }

  /**
   * Get app secret for signature verification
   */
  async getAppSecret(channelAccountId: string): Promise<string> {
    try {
      const { createServiceClient } = await import("@/lib/supabase/server");
      const supabase = await createServiceClient();

      const { data: channelAccount } = await (supabase
        .from("channel_accounts") as unknown as {
          select: (cols: string) => {
            eq: (col: string, val: string) => {
              single: () => Promise<{ data: { credentials?: Record<string, unknown> } | null }>;
            };
          };
        })
        .select("credentials")
        .eq("account_id", channelAccountId)
        .single();

      if (channelAccount && channelAccount.credentials) {
        const credentials = channelAccount.credentials as { app_secret?: string };
        if (credentials.app_secret) {
          return credentials.app_secret;
        }
      }
    } catch (error) {
      console.error("Failed to get app secret from DB:", error);
    }

    // Instagram uses the same app secret as Facebook
    return process.env.FACEBOOK_APP_SECRET || "";
  }

  /**
   * Verify webhook subscription (GET request)
   */
  verifyWebhook(
    mode: string,
    token: string,
    challenge: string,
    verifyToken: string
  ): string | null {
    if (mode === "subscribe" && token === verifyToken) {
      return challenge;
    }
    return null;
  }

  /**
   * Get Instagram Business Account ID from Page
   */
  async getInstagramBusinessAccountId(
    pageId: string,
    accessToken: string
  ): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/${pageId}?fields=instagram_business_account&access_token=${accessToken}`
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.instagram_business_account?.id || null;
    } catch {
      return null;
    }
  }
}

// Export singleton instance
export const instagramAdapter = new InstagramAdapter();
