import crypto from "crypto";
import {
  ChannelAdapter,
  UnifiedInboundMessage,
  UnifiedOutboundMessage,
  ChannelSendResult,
} from "./types";
import { MessageContentType } from "@/lib/supabase/types";

// Facebook Messenger API Types
interface FacebookWebhookEntry {
  id: string;
  time: number;
  messaging: FacebookMessagingEvent[];
}

interface FacebookMessagingEvent {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: {
    mid: string;
    text?: string;
    attachments?: {
      type: "image" | "video" | "audio" | "file" | "location" | "fallback";
      payload: {
        url?: string;
        coordinates?: {
          lat: number;
          long: number;
        };
        sticker_id?: number;
      };
    }[];
    quick_reply?: {
      payload: string;
    };
    reply_to?: {
      mid: string;
    };
  };
  postback?: {
    title: string;
    payload: string;
    referral?: {
      ref: string;
      source: string;
      type: string;
    };
  };
  referral?: {
    ref: string;
    source: string;
    type: string;
  };
  read?: {
    watermark: number;
  };
  delivery?: {
    mids: string[];
    watermark: number;
  };
}

interface FacebookWebhookBody {
  object: "page";
  entry: FacebookWebhookEntry[];
}

interface FacebookSendMessagePayload {
  recipient: { id: string };
  message: FacebookMessage;
  messaging_type: "RESPONSE" | "UPDATE" | "MESSAGE_TAG";
  tag?: string;
}

interface FacebookMessage {
  text?: string;
  attachment?: {
    type: "image" | "video" | "audio" | "file" | "template";
    payload: unknown;
  };
  quick_replies?: {
    content_type: "text" | "user_phone_number" | "user_email";
    title?: string;
    payload?: string;
    image_url?: string;
  }[];
}

interface FacebookUserProfile {
  id: string;
  first_name?: string;
  last_name?: string;
  profile_pic?: string;
  locale?: string;
  timezone?: number;
}

/**
 * Facebook Messenger API Adapter
 * Based on Trusflow implementation patterns
 */
export class FacebookAdapter implements ChannelAdapter {
  channelType = "facebook" as const;
  private graphApiVersion = "v18.0";
  private baseUrl = `https://graph.facebook.com/${this.graphApiVersion}`;

  /**
   * Parse Facebook webhook events to unified format
   */
  async parseWebhook(payload: FacebookWebhookBody): Promise<UnifiedInboundMessage[]> {
    const messages: UnifiedInboundMessage[] = [];

    if (payload.object !== "page") {
      return messages;
    }

    for (const entry of payload.entry) {
      const pageId = entry.id;

      for (const event of entry.messaging || []) {
        // Skip non-message events (read receipts, deliveries, etc.)
        if (!event.message && !event.postback) {
          continue;
        }

        const senderId = event.sender.id;
        const timestamp = new Date(event.timestamp);

        // Handle postback (button click)
        if (event.postback) {
          messages.push({
            channelType: "facebook",
            channelAccountId: pageId,
            channelUserId: senderId,
            messageId: `postback_${event.timestamp}`,
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
            channelType: "facebook",
            channelAccountId: pageId,
            channelUserId: senderId,
            messageId: message.mid,
            contentType: "text",
            text: message.quick_reply.payload,
            timestamp,
            rawPayload: event,
          });
          continue;
        }

        // Handle text message
        if (message.text && !message.attachments) {
          messages.push({
            channelType: "facebook",
            channelAccountId: pageId,
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
              pageId,
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
    attachment: NonNullable<FacebookMessagingEvent["message"]>["attachments"][0],
    pageId: string,
    senderId: string,
    messageId: string,
    timestamp: Date,
    rawPayload: unknown
  ): UnifiedInboundMessage | null {
    let contentType: MessageContentType;
    let mediaUrl: string | undefined;
    let location: UnifiedInboundMessage["location"];
    let sticker: UnifiedInboundMessage["sticker"];

    switch (attachment.type) {
      case "image":
        contentType = "image";
        mediaUrl = attachment.payload.url;
        // Check if it's a sticker
        if (attachment.payload.sticker_id) {
          contentType = "sticker";
          sticker = {
            packageId: "facebook",
            stickerId: String(attachment.payload.sticker_id),
          };
        }
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

      case "location":
        contentType = "location";
        if (attachment.payload.coordinates) {
          location = {
            latitude: attachment.payload.coordinates.lat,
            longitude: attachment.payload.coordinates.long,
          };
        }
        break;

      case "fallback":
        // Fallback attachments (e.g., URL shares)
        return null;

      default:
        return null;
    }

    return {
      channelType: "facebook",
      channelAccountId: pageId,
      channelUserId: senderId,
      messageId: `${messageId}_${attachment.type}`,
      contentType,
      mediaUrl,
      location,
      sticker,
      timestamp,
      rawPayload,
    };
  }

  /**
   * Send message via Facebook Messenger
   */
  async sendMessage(
    channelAccountId: string,
    message: UnifiedOutboundMessage
  ): Promise<ChannelSendResult> {
    const accessToken = await this.getAccessToken(channelAccountId);

    const fbMessage = this.convertToFacebookMessage(message);
    const payload: FacebookSendMessagePayload = {
      recipient: { id: message.channelUserId },
      message: fbMessage,
      messaging_type: "RESPONSE",
    };

    try {
      const response = await fetch(
        `${this.baseUrl}/me/messages?access_token=${accessToken}`,
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
          error: `Facebook API error: ${error.error?.message || response.status}`,
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
   * Validate Facebook webhook signature
   */
  validateSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    // Facebook signature format: sha256=<signature>
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
   * Get user profile from Facebook
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
      const response = await fetch(
        `${this.baseUrl}/${channelUserId}?fields=first_name,last_name,profile_pic&access_token=${accessToken}`
      );

      if (!response.ok) {
        return {};
      }

      const data: FacebookUserProfile = await response.json();

      return {
        displayName: [data.first_name, data.last_name].filter(Boolean).join(" "),
        pictureUrl: data.profile_pic,
      };
    } catch {
      return {};
    }
  }

  /**
   * Convert unified message to Facebook message format
   */
  private convertToFacebookMessage(message: UnifiedOutboundMessage): FacebookMessage {
    const fbMessage: FacebookMessage = {};

    // Text message
    if (message.contentType === "text" && message.text) {
      fbMessage.text = message.text;
    }

    // Image message
    if (message.contentType === "image" && message.mediaUrl) {
      fbMessage.attachment = {
        type: "image",
        payload: {
          url: message.mediaUrl,
          is_reusable: true,
        },
      };
    }

    // Video message
    if (message.contentType === "video" && message.mediaUrl) {
      fbMessage.attachment = {
        type: "video",
        payload: {
          url: message.mediaUrl,
          is_reusable: true,
        },
      };
    }

    // File message
    if (message.contentType === "file" && message.mediaUrl) {
      fbMessage.attachment = {
        type: "file",
        payload: {
          url: message.mediaUrl,
          is_reusable: true,
        },
      };
    }

    // Quick replies
    if (message.quickReplies && message.quickReplies.length > 0) {
      fbMessage.quick_replies = message.quickReplies.map((reply) => ({
        content_type: "text" as const,
        title: reply.label,
        payload: reply.value,
      }));
    }

    // Template message
    if (message.template) {
      fbMessage.attachment = this.convertTemplate(message.template);
    }

    return fbMessage;
  }

  /**
   * Convert template to Facebook format
   */
  private convertTemplate(
    template: NonNullable<UnifiedOutboundMessage["template"]>
  ): FacebookMessage["attachment"] {
    switch (template.type) {
      case "buttons":
        return {
          type: "template",
          payload: {
            template_type: "button",
            text: template.text || template.title,
            buttons: template.actions?.slice(0, 3).map((action) => {
              if (action.type === "uri") {
                return {
                  type: "web_url",
                  url: action.uri,
                  title: action.label,
                };
              } else if (action.type === "postback") {
                return {
                  type: "postback",
                  title: action.label,
                  payload: action.data || action.label,
                };
              } else {
                return {
                  type: "postback",
                  title: action.label,
                  payload: action.text || action.label,
                };
              }
            }),
          },
        };

      case "carousel":
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

      case "confirm":
        return {
          type: "template",
          payload: {
            template_type: "button",
            text: template.text,
            buttons: template.actions?.slice(0, 2).map((action) => ({
              type: "postback",
              title: action.label,
              payload: action.data || action.text || action.label,
            })),
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
   * Send typing indicator
   */
  async sendTypingIndicator(
    channelAccountId: string,
    channelUserId: string,
    action: "typing_on" | "typing_off" = "typing_on"
  ): Promise<void> {
    const accessToken = await this.getAccessToken(channelAccountId);

    try {
      await fetch(
        `${this.baseUrl}/me/messages?access_token=${accessToken}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recipient: { id: channelUserId },
            sender_action: action,
          }),
        }
      );
    } catch (error) {
      console.error("Failed to send typing indicator:", error);
    }
  }

  /**
   * Mark message as seen
   */
  async markSeen(
    channelAccountId: string,
    channelUserId: string
  ): Promise<void> {
    const accessToken = await this.getAccessToken(channelAccountId);

    try {
      await fetch(
        `${this.baseUrl}/me/messages?access_token=${accessToken}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recipient: { id: channelUserId },
            sender_action: "mark_seen",
          }),
        }
      );
    } catch (error) {
      console.error("Failed to mark as seen:", error);
    }
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
        if (credentials.page_access_token) {
          return credentials.page_access_token;
        }
        if (credentials.access_token) {
          return credentials.access_token;
        }
      }
    } catch (error) {
      console.error("Failed to get channel credentials from DB:", error);
    }

    // Fallback to environment variable
    return process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "";
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
}

// Export singleton instance
export const facebookAdapter = new FacebookAdapter();
