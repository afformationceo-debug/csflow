import crypto from "crypto";
import {
  ChannelAdapter,
  UnifiedInboundMessage,
  UnifiedOutboundMessage,
  ChannelSendResult,
} from "./types";
import { MessageContentType } from "@/lib/supabase/types";

// WhatsApp Cloud API Types
interface WhatsAppWebhookEntry {
  id: string;
  changes: {
    value: {
      messaging_product: "whatsapp";
      metadata: {
        display_phone_number: string;
        phone_number_id: string;
      };
      contacts?: {
        profile: {
          name: string;
        };
        wa_id: string;
      }[];
      messages?: WhatsAppMessage[];
      statuses?: WhatsAppStatus[];
    };
    field: "messages";
  }[];
}

interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: "text" | "image" | "video" | "audio" | "document" | "location" | "contacts" | "sticker" | "interactive" | "button" | "reaction" | "order" | "system" | "unknown";
  text?: {
    body: string;
  };
  image?: {
    caption?: string;
    mime_type: string;
    sha256: string;
    id: string;
  };
  video?: {
    caption?: string;
    mime_type: string;
    sha256: string;
    id: string;
  };
  audio?: {
    mime_type: string;
    sha256: string;
    id: string;
    voice?: boolean;
  };
  document?: {
    caption?: string;
    filename: string;
    mime_type: string;
    sha256: string;
    id: string;
  };
  sticker?: {
    mime_type: string;
    sha256: string;
    id: string;
    animated?: boolean;
  };
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  contacts?: {
    addresses?: unknown[];
    emails?: unknown[];
    name: {
      formatted_name: string;
      first_name?: string;
      last_name?: string;
    };
    phones?: {
      phone: string;
      type: string;
      wa_id?: string;
    }[];
  }[];
  interactive?: {
    type: "button_reply" | "list_reply";
    button_reply?: {
      id: string;
      title: string;
    };
    list_reply?: {
      id: string;
      title: string;
      description?: string;
    };
  };
  button?: {
    text: string;
    payload: string;
  };
  reaction?: {
    message_id: string;
    emoji: string;
  };
  context?: {
    from: string;
    id: string;
    referred_product?: {
      catalog_id: string;
      product_retailer_id: string;
    };
  };
}

interface WhatsAppStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
  errors?: {
    code: number;
    title: string;
    message?: string;
    error_data?: {
      details: string;
    };
  }[];
}

interface WhatsAppWebhookBody {
  object: "whatsapp_business_account";
  entry: WhatsAppWebhookEntry[];
}

interface WhatsAppSendMessagePayload {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "text" | "image" | "video" | "audio" | "document" | "sticker" | "location" | "contacts" | "interactive" | "template";
  text?: {
    preview_url?: boolean;
    body: string;
  };
  image?: {
    id?: string;
    link?: string;
    caption?: string;
  };
  video?: {
    id?: string;
    link?: string;
    caption?: string;
  };
  audio?: {
    id?: string;
    link?: string;
  };
  document?: {
    id?: string;
    link?: string;
    caption?: string;
    filename?: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  interactive?: {
    type: "button" | "list" | "product" | "product_list";
    header?: {
      type: "text" | "image" | "video" | "document";
      text?: string;
      image?: { link: string };
      video?: { link: string };
      document?: { link: string };
    };
    body: {
      text: string;
    };
    footer?: {
      text: string;
    };
    action: {
      buttons?: {
        type: "reply";
        reply: {
          id: string;
          title: string;
        };
      }[];
      button?: string;
      sections?: {
        title: string;
        rows: {
          id: string;
          title: string;
          description?: string;
        }[];
      }[];
    };
  };
  template?: {
    name: string;
    language: {
      code: string;
    };
    components?: {
      type: "header" | "body" | "button";
      parameters?: {
        type: "text" | "image" | "video" | "document";
        text?: string;
        image?: { link: string };
        video?: { link: string };
        document?: { link: string };
      }[];
      sub_type?: "quick_reply" | "url";
      index?: number;
    }[];
  };
  context?: {
    message_id: string;
  };
}

/**
 * WhatsApp Cloud API Adapter
 * Based on Trusflow implementation patterns
 */
export class WhatsAppAdapter implements ChannelAdapter {
  channelType = "whatsapp" as const;
  private graphApiVersion = "v18.0";
  private baseUrl = `https://graph.facebook.com/${this.graphApiVersion}`;

  /**
   * Parse WhatsApp webhook events to unified format
   */
  async parseWebhook(payload: WhatsAppWebhookBody): Promise<UnifiedInboundMessage[]> {
    const messages: UnifiedInboundMessage[] = [];

    if (payload.object !== "whatsapp_business_account") {
      return messages;
    }

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field !== "messages") continue;

        const value = change.value;
        const phoneNumberId = value.metadata.phone_number_id;
        const contacts = value.contacts || [];
        const waMessages = value.messages || [];

        for (const message of waMessages) {
          const contact = contacts.find((c) => c.wa_id === message.from);
          const senderName = contact?.profile?.name;
          const timestamp = new Date(parseInt(message.timestamp) * 1000);

          const unifiedMessage = this.parseMessage(
            message,
            phoneNumberId,
            senderName,
            timestamp
          );

          if (unifiedMessage) {
            messages.push(unifiedMessage);
          }
        }
      }
    }

    return messages;
  }

  /**
   * Parse individual message to unified format
   */
  private parseMessage(
    message: WhatsAppMessage,
    phoneNumberId: string,
    senderName: string | undefined,
    timestamp: Date
  ): UnifiedInboundMessage | null {
    let contentType: MessageContentType = "text";
    let text: string | undefined;
    let mediaUrl: string | undefined;
    let location: UnifiedInboundMessage["location"];
    let sticker: UnifiedInboundMessage["sticker"];

    switch (message.type) {
      case "text":
        contentType = "text";
        text = message.text?.body;
        break;

      case "image":
        contentType = "image";
        text = message.image?.caption;
        // Media URL needs to be fetched separately using the media ID
        mediaUrl = message.image?.id ? `whatsapp://media/${message.image.id}` : undefined;
        break;

      case "video":
        contentType = "video";
        text = message.video?.caption;
        mediaUrl = message.video?.id ? `whatsapp://media/${message.video.id}` : undefined;
        break;

      case "audio":
        contentType = "audio";
        mediaUrl = message.audio?.id ? `whatsapp://media/${message.audio.id}` : undefined;
        break;

      case "document":
        contentType = "file";
        text = message.document?.caption || message.document?.filename;
        mediaUrl = message.document?.id ? `whatsapp://media/${message.document.id}` : undefined;
        break;

      case "sticker":
        contentType = "sticker";
        sticker = {
          packageId: "whatsapp",
          stickerId: message.sticker?.id || "",
        };
        break;

      case "location":
        contentType = "location";
        if (message.location) {
          location = {
            latitude: message.location.latitude,
            longitude: message.location.longitude,
            address: message.location.address || message.location.name,
          };
        }
        break;

      case "interactive":
        contentType = "text";
        if (message.interactive?.button_reply) {
          text = message.interactive.button_reply.id;
        } else if (message.interactive?.list_reply) {
          text = message.interactive.list_reply.id;
        }
        break;

      case "button":
        contentType = "text";
        text = message.button?.payload || message.button?.text;
        break;

      case "contacts":
        contentType = "text";
        const contactInfo = message.contacts?.[0];
        if (contactInfo) {
          text = `[Contact: ${contactInfo.name.formatted_name}${
            contactInfo.phones?.[0]?.phone ? ` - ${contactInfo.phones[0].phone}` : ""
          }]`;
        }
        break;

      case "reaction":
        // Skip reactions for now
        return null;

      case "system":
      case "unknown":
        return null;

      default:
        return null;
    }

    return {
      channelType: "whatsapp",
      channelAccountId: phoneNumberId,
      channelUserId: message.from,
      channelUsername: senderName,
      messageId: message.id,
      contentType,
      text,
      mediaUrl,
      location,
      sticker,
      timestamp,
      rawPayload: message,
    };
  }

  /**
   * Send message via WhatsApp
   */
  async sendMessage(
    channelAccountId: string,
    message: UnifiedOutboundMessage
  ): Promise<ChannelSendResult> {
    const accessToken = await this.getAccessToken(channelAccountId);

    const waPayload = this.convertToWhatsAppMessage(message);

    try {
      const response = await fetch(
        `${this.baseUrl}/${channelAccountId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(waPayload),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: `WhatsApp API error: ${error.error?.message || response.status}`,
        };
      }

      const result = await response.json();
      return {
        success: true,
        messageId: result.messages?.[0]?.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Validate WhatsApp webhook signature
   */
  validateSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    // WhatsApp uses the same signature format as Facebook: sha256=<signature>
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
   * Get user profile from WhatsApp
   * Note: WhatsApp doesn't provide profile API, contact info comes from webhook
   */
  async getUserProfile(
    _channelAccountId: string,
    _channelUserId: string
  ): Promise<{
    displayName?: string;
    pictureUrl?: string;
    statusMessage?: string;
  }> {
    // WhatsApp doesn't provide a profile API
    // Profile info is only available in the webhook contact field
    return {};
  }

  /**
   * Convert unified message to WhatsApp message format
   */
  private convertToWhatsAppMessage(
    message: UnifiedOutboundMessage
  ): WhatsAppSendMessagePayload {
    const basePayload: WhatsAppSendMessagePayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: message.channelUserId,
      type: "text",
    };

    // Text message
    if (message.contentType === "text" && message.text) {
      // Check if we should use interactive buttons
      if (message.quickReplies && message.quickReplies.length > 0) {
        return {
          ...basePayload,
          type: "interactive",
          interactive: {
            type: "button",
            body: {
              text: message.text,
            },
            action: {
              buttons: message.quickReplies.slice(0, 3).map((reply, index) => ({
                type: "reply" as const,
                reply: {
                  id: `btn_${index}`,
                  title: reply.label.substring(0, 20), // WhatsApp limit
                },
              })),
            },
          },
        };
      }

      return {
        ...basePayload,
        type: "text",
        text: {
          preview_url: true,
          body: message.text,
        },
      };
    }

    // Image message
    if (message.contentType === "image" && message.mediaUrl) {
      return {
        ...basePayload,
        type: "image",
        image: {
          link: message.mediaUrl,
        },
      };
    }

    // Video message
    if (message.contentType === "video" && message.mediaUrl) {
      return {
        ...basePayload,
        type: "video",
        video: {
          link: message.mediaUrl,
        },
      };
    }

    // Audio message
    if (message.contentType === "audio" && message.mediaUrl) {
      return {
        ...basePayload,
        type: "audio",
        audio: {
          link: message.mediaUrl,
        },
      };
    }

    // File/Document message
    if (message.contentType === "file" && message.mediaUrl) {
      return {
        ...basePayload,
        type: "document",
        document: {
          link: message.mediaUrl,
        },
      };
    }

    // Location message
    if (message.contentType === "location" && message.template?.thumbnailUrl) {
      // Using template as a workaround for location data
      return {
        ...basePayload,
        type: "location",
        location: {
          latitude: 0,
          longitude: 0,
          name: message.template.title,
          address: message.template.text,
        },
      };
    }

    // Template message
    if (message.template) {
      return this.convertTemplate(message, basePayload);
    }

    // Default to text
    return {
      ...basePayload,
      type: "text",
      text: {
        body: message.text || "",
      },
    };
  }

  /**
   * Convert template to WhatsApp format
   */
  private convertTemplate(
    message: UnifiedOutboundMessage,
    basePayload: WhatsAppSendMessagePayload
  ): WhatsAppSendMessagePayload {
    const template = message.template!;

    switch (template.type) {
      case "buttons":
        return {
          ...basePayload,
          type: "interactive",
          interactive: {
            type: "button",
            header: template.thumbnailUrl
              ? {
                  type: "image",
                  image: { link: template.thumbnailUrl },
                }
              : template.title
                ? {
                    type: "text",
                    text: template.title,
                  }
                : undefined,
            body: {
              text: template.text || "",
            },
            action: {
              buttons: template.actions?.slice(0, 3).map((action, index) => ({
                type: "reply" as const,
                reply: {
                  id: action.data || `btn_${index}`,
                  title: action.label.substring(0, 20),
                },
              })) || [],
            },
          },
        };

      case "carousel":
        // WhatsApp doesn't support carousel directly, use list instead
        return {
          ...basePayload,
          type: "interactive",
          interactive: {
            type: "list",
            body: {
              text: template.text || template.title || "Options",
            },
            action: {
              button: "View Options",
              sections: [
                {
                  title: template.title || "Options",
                  rows: template.actions?.map((action, index) => ({
                    id: action.data || `item_${index}`,
                    title: action.label.substring(0, 24),
                    description: action.text?.substring(0, 72),
                  })) || [],
                },
              ],
            },
          },
        };

      case "confirm":
        return {
          ...basePayload,
          type: "interactive",
          interactive: {
            type: "button",
            body: {
              text: template.text || "",
            },
            action: {
              buttons: template.actions?.slice(0, 2).map((action, index) => ({
                type: "reply" as const,
                reply: {
                  id: action.data || `confirm_${index}`,
                  title: action.label.substring(0, 20),
                },
              })) || [],
            },
          },
        };

      case "image":
        return {
          ...basePayload,
          type: "image",
          image: {
            link: template.thumbnailUrl || "",
            caption: template.text,
          },
        };

      default:
        return {
          ...basePayload,
          type: "text",
          text: {
            body: template.text || "",
          },
        };
    }
  }

  /**
   * Send template message (for outbound messages outside 24hr window)
   */
  async sendTemplateMessage(
    channelAccountId: string,
    recipientPhone: string,
    templateName: string,
    languageCode: string,
    components?: WhatsAppSendMessagePayload["template"]["components"]
  ): Promise<ChannelSendResult> {
    const accessToken = await this.getAccessToken(channelAccountId);

    const payload: WhatsAppSendMessagePayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientPhone,
      type: "template",
      template: {
        name: templateName,
        language: {
          code: languageCode,
        },
        components,
      },
    };

    try {
      const response = await fetch(
        `${this.baseUrl}/${channelAccountId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: `WhatsApp API error: ${error.error?.message || response.status}`,
        };
      }

      const result = await response.json();
      return {
        success: true,
        messageId: result.messages?.[0]?.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get media URL from WhatsApp media ID
   */
  async getMediaUrl(
    channelAccountId: string,
    mediaId: string
  ): Promise<string | null> {
    const accessToken = await this.getAccessToken(channelAccountId);

    try {
      // First, get the media URL
      const response = await fetch(
        `${this.baseUrl}/${mediaId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.url || null;
    } catch {
      return null;
    }
  }

  /**
   * Download media content
   */
  async downloadMedia(
    channelAccountId: string,
    mediaId: string
  ): Promise<Buffer | null> {
    const mediaUrl = await this.getMediaUrl(channelAccountId, mediaId);
    if (!mediaUrl) return null;

    const accessToken = await this.getAccessToken(channelAccountId);

    try {
      const response = await fetch(mediaUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

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
   * Mark message as read
   */
  async markAsRead(
    channelAccountId: string,
    messageId: string
  ): Promise<void> {
    const accessToken = await this.getAccessToken(channelAccountId);

    try {
      await fetch(
        `${this.baseUrl}/${channelAccountId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            status: "read",
            message_id: messageId,
          }),
        }
      );
    } catch (error) {
      console.error("Failed to mark message as read:", error);
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
        const credentials = channelAccount.credentials as { access_token?: string; system_user_access_token?: string };
        if (credentials.system_user_access_token) {
          return credentials.system_user_access_token;
        }
        if (credentials.access_token) {
          return credentials.access_token;
        }
      }
    } catch (error) {
      console.error("Failed to get channel credentials from DB:", error);
    }

    // Fallback to environment variable
    return process.env.WHATSAPP_ACCESS_TOKEN || "";
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

    // WhatsApp uses the same app secret as Facebook
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
   * Check if within 24-hour messaging window
   */
  isWithinMessagingWindow(lastMessageTimestamp: Date): boolean {
    const now = new Date();
    const diff = now.getTime() - lastMessageTimestamp.getTime();
    const hoursDiff = diff / (1000 * 60 * 60);
    return hoursDiff < 24;
  }
}

// Export singleton instance
export const whatsappAdapter = new WhatsAppAdapter();
