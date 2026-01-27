import crypto from "crypto";
import {
  ChannelAdapter,
  UnifiedInboundMessage,
  UnifiedOutboundMessage,
  ChannelSendResult,
} from "./types";
import { MessageContentType } from "@/lib/supabase/types";

// LINE API Types
interface LineWebhookEvent {
  type: string;
  replyToken?: string;
  timestamp: number;
  source: {
    type: string;
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  message?: {
    id: string;
    type: string;
    text?: string;
    contentProvider?: {
      type: string;
      originalContentUrl?: string;
      previewImageUrl?: string;
    };
    packageId?: string;
    stickerId?: string;
    location?: {
      title?: string;
      address?: string;
      latitude: number;
      longitude: number;
    };
  };
  postback?: {
    data: string;
    params?: Record<string, string>;
  };
}

interface LineWebhookBody {
  destination: string;
  events: LineWebhookEvent[];
}

/**
 * LINE Messaging API Adapter
 */
export class LineAdapter implements ChannelAdapter {
  channelType = "line" as const;
  private baseUrl = "https://api.line.me/v2/bot";

  /**
   * Parse LINE webhook events to unified format
   */
  async parseWebhook(payload: LineWebhookBody): Promise<UnifiedInboundMessage[]> {
    const messages: UnifiedInboundMessage[] = [];

    for (const event of payload.events) {
      if (event.type !== "message" || !event.source.userId) {
        continue;
      }

      const message = event.message;
      if (!message) continue;

      let contentType: MessageContentType = "text";
      let text: string | undefined;
      let mediaUrl: string | undefined;

      switch (message.type) {
        case "text":
          contentType = "text";
          text = message.text;
          break;

        case "image":
          contentType = "image";
          mediaUrl =
            message.contentProvider?.type === "external"
              ? message.contentProvider.originalContentUrl
              : undefined;
          break;

        case "video":
          contentType = "video";
          mediaUrl =
            message.contentProvider?.type === "external"
              ? message.contentProvider.originalContentUrl
              : undefined;
          break;

        case "audio":
          contentType = "audio";
          break;

        case "file":
          contentType = "file";
          break;

        case "location":
          contentType = "location";
          break;

        case "sticker":
          contentType = "sticker";
          break;

        default:
          continue;
      }

      const unifiedMessage: UnifiedInboundMessage = {
        channelType: "line",
        channelAccountId: payload.destination,
        channelUserId: event.source.userId,
        messageId: message.id,
        contentType,
        text,
        mediaUrl,
        timestamp: new Date(event.timestamp),
        rawPayload: event,
      };

      // Add location if present
      if (message.location) {
        unifiedMessage.location = {
          latitude: message.location.latitude,
          longitude: message.location.longitude,
          address: message.location.address,
        };
      }

      // Add sticker if present
      if (message.packageId && message.stickerId) {
        unifiedMessage.sticker = {
          packageId: message.packageId,
          stickerId: message.stickerId,
        };
      }

      messages.push(unifiedMessage);
    }

    return messages;
  }

  /**
   * Send message via LINE
   */
  async sendMessage(
    channelAccountId: string,
    message: UnifiedOutboundMessage
  ): Promise<ChannelSendResult> {
    // Get access token from channel credentials
    const accessToken = await this.getAccessToken(channelAccountId);

    const lineMessage = this.convertToLineMessage(message);

    try {
      const response = await fetch(`${this.baseUrl}/message/push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          to: message.channelUserId,
          messages: [lineMessage],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          error: `LINE API error: ${response.status} - ${error}`,
        };
      }

      // LINE doesn't return message ID on push
      return {
        success: true,
        messageId: `line_${Date.now()}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Validate LINE webhook signature
   */
  validateSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    const hash = crypto
      .createHmac("SHA256", secret)
      .update(payload)
      .digest("base64");

    return hash === signature;
  }

  /**
   * Get user profile from LINE
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
        `${this.baseUrl}/profile/${channelUserId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        return {};
      }

      const data = await response.json();

      return {
        displayName: data.displayName,
        pictureUrl: data.pictureUrl,
        statusMessage: data.statusMessage,
      };
    } catch {
      return {};
    }
  }

  /**
   * Get media content from LINE (for images, files, etc.)
   */
  async getMessageContent(
    channelAccountId: string,
    messageId: string
  ): Promise<Buffer | null> {
    const accessToken = await this.getAccessToken(channelAccountId);

    try {
      const response = await fetch(
        `https://api-data.line.me/v2/bot/message/${messageId}/content`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch {
      return null;
    }
  }

  /**
   * Convert unified message to LINE message format
   */
  private convertToLineMessage(message: UnifiedOutboundMessage): unknown {
    // Text message
    if (message.contentType === "text" && message.text) {
      const lineMessage: {
        type: string;
        text: string;
        quickReply?: {
          items: {
            type: string;
            action: {
              type: string;
              label: string;
              text?: string;
              uri?: string;
            };
          }[];
        };
      } = {
        type: "text",
        text: message.text,
      };

      // Add quick replies
      if (message.quickReplies && message.quickReplies.length > 0) {
        lineMessage.quickReply = {
          items: message.quickReplies.map((reply) => ({
            type: "action",
            action:
              reply.action === "url"
                ? {
                    type: "uri",
                    label: reply.label,
                    uri: reply.value,
                  }
                : {
                    type: "message",
                    label: reply.label,
                    text: reply.value,
                  },
          })),
        };
      }

      return lineMessage;
    }

    // Image message
    if (message.contentType === "image" && message.mediaUrl) {
      return {
        type: "image",
        originalContentUrl: message.mediaUrl,
        previewImageUrl: message.mediaUrl,
      };
    }

    // Template message
    if (message.template) {
      return this.convertTemplate(message.template);
    }

    // Default to text
    return {
      type: "text",
      text: message.text || "",
    };
  }

  /**
   * Convert template to LINE format
   */
  private convertTemplate(template: UnifiedOutboundMessage["template"]): unknown {
    if (!template) return null;

    switch (template.type) {
      case "buttons":
        return {
          type: "template",
          altText: template.title || "메시지",
          template: {
            type: "buttons",
            thumbnailImageUrl: template.thumbnailUrl,
            title: template.title,
            text: template.text,
            actions: template.actions?.map((action) => {
              if (action.type === "uri") {
                return {
                  type: "uri",
                  label: action.label,
                  uri: action.uri,
                };
              } else if (action.type === "postback") {
                return {
                  type: "postback",
                  label: action.label,
                  data: action.data,
                  displayText: action.text,
                };
              } else {
                return {
                  type: "message",
                  label: action.label,
                  text: action.text || action.label,
                };
              }
            }),
          },
        };

      case "confirm":
        return {
          type: "template",
          altText: template.text || "확인",
          template: {
            type: "confirm",
            text: template.text,
            actions: template.actions?.slice(0, 2).map((action) => ({
              type: "message",
              label: action.label,
              text: action.text || action.label,
            })),
          },
        };

      case "carousel":
        // Carousel requires more complex structure
        return {
          type: "template",
          altText: template.title || "캐러셀",
          template: {
            type: "carousel",
            columns: [
              {
                thumbnailImageUrl: template.thumbnailUrl,
                title: template.title,
                text: template.text,
                actions: template.actions?.slice(0, 3).map((action) => ({
                  type: action.type === "uri" ? "uri" : "message",
                  label: action.label,
                  uri: action.uri,
                  text: action.text,
                })),
              },
            ],
          },
        };

      default:
        return {
          type: "text",
          text: template.text || "",
        };
    }
  }

  /**
   * Get access token for channel
   * Retrieves from database based on channelAccountId
   */
  private async getAccessToken(channelAccountId: string): Promise<string> {
    // Try to get from database first
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
        const credentials = channelAccount.credentials as { access_token?: string };
        if (credentials.access_token) {
          return credentials.access_token;
        }
      }
    } catch (error) {
      console.error("Failed to get channel credentials from DB:", error);
    }

    // Fallback to environment variable
    return process.env.LINE_CHANNEL_ACCESS_TOKEN || "";
  }

  /**
   * Get channel secret for signature verification
   */
  async getChannelSecret(channelAccountId: string): Promise<string> {
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
        const credentials = channelAccount.credentials as { channel_secret?: string };
        if (credentials.channel_secret) {
          return credentials.channel_secret;
        }
      }
    } catch (error) {
      console.error("Failed to get channel secret from DB:", error);
    }

    return process.env.LINE_CHANNEL_SECRET || "";
  }
}

// Export singleton instance
export const lineAdapter = new LineAdapter();
