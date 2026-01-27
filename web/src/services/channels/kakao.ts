import crypto from "crypto";
import {
  ChannelAdapter,
  UnifiedInboundMessage,
  UnifiedOutboundMessage,
  ChannelSendResult,
} from "./types";
import { MessageContentType } from "@/lib/supabase/types";

/**
 * KakaoTalk Channel API Types
 * Based on Kakao i Open Builder and Kakao Channel API
 */

// Webhook event from Kakao
interface KakaoWebhookBody {
  bot?: {
    id: string;
    name: string;
  };
  intent?: {
    id: string;
    name: string;
  };
  action?: {
    id: string;
    name: string;
    params?: Record<string, string>;
    detailParams?: Record<string, { origin: string; value: string }>;
    clientExtra?: Record<string, unknown>;
  };
  userRequest: {
    block?: {
      id: string;
      name: string;
    };
    user: {
      id: string;
      type: "botUserKey" | "plusfriendUserKey";
      properties?: {
        plusfriendUserKey?: string;
        appUserId?: string;
        isFriend?: boolean;
      };
    };
    utterance: string;
    lang?: string;
    timezone?: string;
    params?: Record<string, string>;
  };
  contexts?: Array<{
    name: string;
    lifeSpan: number;
    params?: Record<string, string>;
  }>;
}

// Kakao message for webhook callback (for async responses)
interface KakaoCallbackRequest {
  callbackUrl: string;
  body: {
    version: "2.0";
    template: KakaoTemplate;
  };
}

// Kakao template types
interface KakaoTemplate {
  outputs: KakaoOutput[];
  quickReplies?: KakaoQuickReply[];
}

interface KakaoOutput {
  simpleText?: {
    text: string;
  };
  simpleImage?: {
    imageUrl: string;
    altText: string;
  };
  basicCard?: {
    title?: string;
    description?: string;
    thumbnail?: {
      imageUrl: string;
      fixedRatio?: boolean;
      width?: number;
      height?: number;
    };
    buttons?: KakaoButton[];
  };
  carousel?: {
    type: "basicCard" | "commerceCard";
    items: Array<{
      title: string;
      description?: string;
      thumbnail: {
        imageUrl: string;
      };
      buttons?: KakaoButton[];
    }>;
  };
}

interface KakaoButton {
  label: string;
  action: "webLink" | "message" | "phone" | "block" | "share";
  webLinkUrl?: string;
  messageText?: string;
  phoneNumber?: string;
  blockId?: string;
}

interface KakaoQuickReply {
  label: string;
  action: "message" | "block";
  messageText?: string;
  blockId?: string;
}

// Kakao Talk Channel Message API (for proactive messages)
interface KakaoChannelMessageRequest {
  senderKey: string;
  templateCode: string;
  recipientNo: string;
  message: string;
  buttons?: Array<{
    name: string;
    linkType: "WL" | "AL" | "BK" | "MD";
    linkMo?: string;
    linkPc?: string;
  }>;
}

/**
 * KakaoTalk Channel Adapter
 * Supports both Kakao i Open Builder (chatbot) and Kakao Channel API (notifications)
 */
export class KakaoAdapter implements ChannelAdapter {
  channelType = "kakao" as const;

  // Kakao i Open Builder endpoint
  private skillBaseUrl = "https://bot-api.kakao.com/v2";

  // Kakao Channel API endpoint (for Alimtalk/Friendtalk)
  private channelApiBaseUrl = "https://kapi.kakao.com/v2/api/talk";

  // Biz Message API (for business messages)
  private bizMessageUrl = "https://bizmessage.kakao.com/v2";

  /**
   * Parse Kakao webhook events to unified format
   */
  async parseWebhook(payload: KakaoWebhookBody): Promise<UnifiedInboundMessage[]> {
    const messages: UnifiedInboundMessage[] = [];

    const userRequest = payload.userRequest;
    if (!userRequest || !userRequest.user) {
      return messages;
    }

    // Extract user ID
    const userId = userRequest.user.properties?.plusfriendUserKey
      || userRequest.user.id;

    // Parse utterance (user message)
    const utterance = userRequest.utterance;

    // Determine content type - Kakao mainly sends text through Open Builder
    // Images/files come through different mechanisms
    let contentType: MessageContentType = "text";
    let text: string | undefined = utterance;
    let mediaUrl: string | undefined;

    // Check for image URL in params
    if (payload.action?.params?.image) {
      contentType = "image";
      mediaUrl = payload.action.params.image;
      text = undefined;
    }

    // Check for file in params
    if (payload.action?.params?.file) {
      contentType = "file";
      mediaUrl = payload.action.params.file;
      text = undefined;
    }

    // Check for location in params
    if (payload.action?.params?.location) {
      contentType = "location";
      text = undefined;
    }

    const unifiedMessage: UnifiedInboundMessage = {
      channelType: "kakao",
      channelAccountId: payload.bot?.id || "default",
      channelUserId: userId,
      messageId: `kakao_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      contentType,
      text,
      mediaUrl,
      timestamp: new Date(),
      rawPayload: payload,
    };

    // Add location if present
    if (payload.action?.detailParams?.location) {
      const locationData = payload.action.detailParams.location;
      try {
        const parsed = JSON.parse(locationData.value);
        unifiedMessage.location = {
          latitude: parsed.lat || parsed.latitude,
          longitude: parsed.lng || parsed.longitude,
          address: parsed.address,
        };
      } catch {
        // Location parsing failed, skip
      }
    }

    messages.push(unifiedMessage);
    return messages;
  }

  /**
   * Send message via Kakao
   * Uses different methods based on context:
   * - Skill response: Returns template for synchronous response
   * - Callback: Sends async message via callback URL
   * - Channel message: Sends via Kakao Channel API (Alimtalk/Friendtalk)
   */
  async sendMessage(
    channelAccountId: string,
    message: UnifiedOutboundMessage
  ): Promise<ChannelSendResult> {
    try {
      // Get channel credentials
      const credentials = await this.getChannelCredentials(channelAccountId);

      if (!credentials) {
        return {
          success: false,
          error: "Channel credentials not found",
        };
      }

      // Build Kakao template
      const template = this.convertToKakaoTemplate(message);

      // If callback URL is available, send async response
      if (credentials.callbackUrl) {
        return await this.sendCallbackMessage(credentials.callbackUrl, template);
      }

      // For proactive messages, use Kakao Channel API
      if (credentials.senderKey && credentials.templateCode) {
        return await this.sendChannelMessage(
          credentials,
          message.channelUserId,
          message.text || ""
        );
      }

      // Return success for skill response (template will be used in webhook response)
      return {
        success: true,
        messageId: `kakao_${Date.now()}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Send async message via callback URL
   */
  private async sendCallbackMessage(
    callbackUrl: string,
    template: KakaoTemplate
  ): Promise<ChannelSendResult> {
    try {
      const response = await fetch(callbackUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          version: "2.0",
          template,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          error: `Kakao callback error: ${response.status} - ${error}`,
        };
      }

      return {
        success: true,
        messageId: `kakao_callback_${Date.now()}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Callback failed",
      };
    }
  }

  /**
   * Send message via Kakao Channel API (Alimtalk/Friendtalk)
   */
  private async sendChannelMessage(
    credentials: KakaoCredentials,
    recipientId: string,
    message: string
  ): Promise<ChannelSendResult> {
    try {
      const response = await fetch(`${this.bizMessageUrl}/messages/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${credentials.apiKey}`,
        },
        body: JSON.stringify({
          senderKey: credentials.senderKey,
          templateCode: credentials.templateCode,
          recipientNo: recipientId,
          message,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          error: `Kakao Channel API error: ${response.status} - ${error}`,
        };
      }

      const result = await response.json();
      return {
        success: true,
        messageId: result.msgId || `kakao_channel_${Date.now()}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Channel message failed",
      };
    }
  }

  /**
   * Validate Kakao webhook signature
   * Kakao uses API key validation instead of signature
   */
  validateSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    // Kakao i Open Builder uses REST API key validation
    // The signature header should match the registered API key
    if (signature === secret) {
      return true;
    }

    // Alternative: HMAC validation if configured
    const hash = crypto
      .createHmac("SHA256", secret)
      .update(payload)
      .digest("base64");

    return hash === signature;
  }

  /**
   * Get user profile from Kakao
   * Note: Kakao has limited profile access due to privacy policies
   */
  async getUserProfile(
    channelAccountId: string,
    channelUserId: string
  ): Promise<{
    displayName?: string;
    pictureUrl?: string;
    statusMessage?: string;
  }> {
    // Kakao doesn't expose user profile through chatbot API
    // Profile information is limited to what user explicitly provides
    // or through OAuth consent flow
    return {
      displayName: undefined,
      pictureUrl: undefined,
      statusMessage: undefined,
    };
  }

  /**
   * Convert unified message to Kakao template format
   */
  private convertToKakaoTemplate(message: UnifiedOutboundMessage): KakaoTemplate {
    const outputs: KakaoOutput[] = [];
    const quickReplies: KakaoQuickReply[] = [];

    // Text message
    if (message.contentType === "text" && message.text) {
      outputs.push({
        simpleText: {
          text: message.text,
        },
      });
    }

    // Image message
    if (message.contentType === "image" && message.mediaUrl) {
      outputs.push({
        simpleImage: {
          imageUrl: message.mediaUrl,
          altText: "이미지",
        },
      });
    }

    // Template message (buttons/carousel)
    if (message.template) {
      const templateOutput = this.convertTemplate(message.template);
      if (templateOutput) {
        outputs.push(templateOutput);
      }
    }

    // Quick replies
    if (message.quickReplies && message.quickReplies.length > 0) {
      for (const reply of message.quickReplies) {
        quickReplies.push({
          label: reply.label,
          action: reply.action === "url" ? "block" : "message",
          messageText: reply.action === "message" ? reply.value : undefined,
        });
      }
    }

    // Default to simple text if no outputs
    if (outputs.length === 0) {
      outputs.push({
        simpleText: {
          text: message.text || "메시지를 확인해주세요.",
        },
      });
    }

    return {
      outputs,
      quickReplies: quickReplies.length > 0 ? quickReplies : undefined,
    };
  }

  /**
   * Convert unified template to Kakao format
   */
  private convertTemplate(
    template: UnifiedOutboundMessage["template"]
  ): KakaoOutput | null {
    if (!template) return null;

    switch (template.type) {
      case "buttons":
        return {
          basicCard: {
            title: template.title,
            description: template.text,
            thumbnail: template.thumbnailUrl
              ? { imageUrl: template.thumbnailUrl }
              : undefined,
            buttons: template.actions?.map((action) => this.convertAction(action)),
          },
        };

      case "carousel":
        return {
          carousel: {
            type: "basicCard",
            items: [
              {
                title: template.title || "",
                description: template.text,
                thumbnail: {
                  imageUrl: template.thumbnailUrl || "",
                },
                buttons: template.actions?.slice(0, 3).map((action) =>
                  this.convertAction(action)
                ),
              },
            ],
          },
        };

      case "confirm":
        return {
          basicCard: {
            description: template.text,
            buttons: template.actions?.slice(0, 2).map((action) =>
              this.convertAction(action)
            ),
          },
        };

      default:
        return {
          simpleText: {
            text: template.text || "",
          },
        };
    }
  }

  /**
   * Convert action to Kakao button format
   */
  private convertAction(
    action: NonNullable<UnifiedOutboundMessage["template"]>["actions"] extends
      | (infer T)[]
      | undefined
      ? T
      : never
  ): KakaoButton {
    switch (action.type) {
      case "uri":
        return {
          label: action.label,
          action: "webLink",
          webLinkUrl: action.uri,
        };

      case "postback":
        return {
          label: action.label,
          action: "message",
          messageText: action.text || action.data,
        };

      case "message":
      default:
        return {
          label: action.label,
          action: "message",
          messageText: action.text || action.label,
        };
    }
  }

  /**
   * Create skill response for Kakao i Open Builder
   * This is used in webhook handler to return immediate response
   */
  createSkillResponse(message: UnifiedOutboundMessage): {
    version: "2.0";
    template: KakaoTemplate;
  } {
    return {
      version: "2.0",
      template: this.convertToKakaoTemplate(message),
    };
  }

  /**
   * Get channel credentials
   */
  private async getChannelCredentials(
    channelAccountId: string
  ): Promise<KakaoCredentials | null> {
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
        return channelAccount.credentials as unknown as KakaoCredentials;
      }
    } catch (error) {
      console.error("Failed to get Kakao credentials from DB:", error);
    }

    // Fallback to environment variables
    return {
      apiKey: process.env.KAKAO_REST_API_KEY || "",
      senderKey: process.env.KAKAO_SENDER_KEY,
      templateCode: process.env.KAKAO_TEMPLATE_CODE,
    };
  }
}

interface KakaoCredentials {
  apiKey: string;
  senderKey?: string;
  templateCode?: string;
  callbackUrl?: string;
}

// Export singleton instance
export const kakaoAdapter = new KakaoAdapter();
