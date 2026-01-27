import crypto from "crypto";
import {
  ChannelAdapter,
  UnifiedInboundMessage,
  UnifiedOutboundMessage,
  ChannelSendResult,
} from "./types";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * WeChat Official Account / Service Account Adapter
 *
 * WeChat API documentation:
 * - https://developers.weixin.qq.com/doc/offiaccount/en/Getting_Started/Overview.html
 * - Messages: https://developers.weixin.qq.com/doc/offiaccount/en/Message_Management/Receiving_standard_messages.html
 *
 * Required credentials in channel_accounts.credentials:
 * - appId: WeChat App ID
 * - appSecret: WeChat App Secret
 * - token: Verification token for webhook
 * - encodingAESKey: Message encryption key (optional, for encrypted mode)
 */

interface WeChatMessage {
  ToUserName: string;      // Developer WeChat ID
  FromUserName: string;    // User OpenID
  CreateTime: number;      // Unix timestamp
  MsgType: string;         // text, image, voice, video, shortvideo, location, link, event
  MsgId?: string;          // Message ID (not present for events)
  Content?: string;        // Text content
  PicUrl?: string;         // Image URL
  MediaId?: string;        // Media ID for voice/video/image
  Format?: string;         // Voice format (amr, speex)
  Recognition?: string;    // Voice recognition result
  ThumbMediaId?: string;   // Video thumbnail media ID
  Location_X?: number;     // Latitude
  Location_Y?: number;     // Longitude
  Scale?: number;          // Map zoom level
  Label?: string;          // Location label
  Title?: string;          // Link title
  Description?: string;    // Link description
  Url?: string;            // Link URL
  Event?: string;          // Event type (subscribe, unsubscribe, SCAN, LOCATION, CLICK, VIEW)
  EventKey?: string;       // Event key
  Ticket?: string;         // QR code ticket
}

interface WeChatCredentials {
  appId: string;
  appSecret: string;
  token: string;
  encodingAESKey?: string;
  accessToken?: string;
  accessTokenExpiresAt?: number;
}

// Access token cache
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

/**
 * Get WeChat access token (with caching)
 */
async function getAccessToken(credentials: WeChatCredentials): Promise<string> {
  const cacheKey = credentials.appId;
  const cached = tokenCache.get(cacheKey);

  // Return cached token if still valid (with 5 min buffer)
  if (cached && cached.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cached.token;
  }

  // Fetch new access token
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${credentials.appId}&secret=${credentials.appSecret}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.errcode) {
    throw new Error(`WeChat API error: ${data.errcode} - ${data.errmsg}`);
  }

  const token = data.access_token;
  const expiresAt = Date.now() + (data.expires_in - 300) * 1000; // 5 min buffer

  tokenCache.set(cacheKey, { token, expiresAt });

  return token;
}

/**
 * Parse XML message to object
 */
function parseXmlMessage(xml: string): WeChatMessage {
  const result: Record<string, string | number> = {};

  // Simple XML parser for WeChat messages
  const matches = xml.matchAll(/<(\w+)><!\[CDATA\[(.*?)\]\]><\/\1>|<(\w+)>(\d+)<\/\3>/g);

  for (const match of matches) {
    if (match[1]) {
      // CDATA field
      result[match[1]] = match[2];
    } else if (match[3]) {
      // Numeric field
      result[match[3]] = parseInt(match[4], 10);
    }
  }

  return result as unknown as WeChatMessage;
}

/**
 * Build XML response message
 */
function buildXmlResponse(
  toUser: string,
  fromUser: string,
  content: string,
  msgType: string = "text"
): string {
  const timestamp = Math.floor(Date.now() / 1000);

  if (msgType === "text") {
    return `<xml>
  <ToUserName><![CDATA[${toUser}]]></ToUserName>
  <FromUserName><![CDATA[${fromUser}]]></FromUserName>
  <CreateTime>${timestamp}</CreateTime>
  <MsgType><![CDATA[text]]></MsgType>
  <Content><![CDATA[${content}]]></Content>
</xml>`;
  }

  // For other message types, return empty (will use customer service API instead)
  return "";
}

export const wechatAdapter: ChannelAdapter = {
  channelType: "wechat",

  /**
   * Parse WeChat webhook payload to unified format
   */
  async parseWebhook(payload: unknown): Promise<UnifiedInboundMessage[]> {
    const messages: UnifiedInboundMessage[] = [];

    // payload should be XML string
    if (typeof payload !== "string") {
      console.error("WeChat payload is not a string");
      return messages;
    }

    const msg = parseXmlMessage(payload);

    // Skip events for now (subscribe, unsubscribe, etc.)
    if (msg.MsgType === "event") {
      console.log(`WeChat event: ${msg.Event}`);
      return messages;
    }

    // Skip if no MsgId (required for regular messages)
    if (!msg.MsgId) {
      return messages;
    }

    const baseMessage: Partial<UnifiedInboundMessage> = {
      channelType: "wechat",
      channelAccountId: msg.ToUserName,
      channelUserId: msg.FromUserName,
      messageId: msg.MsgId.toString(),
      timestamp: new Date(msg.CreateTime * 1000),
      rawPayload: msg,
    };

    switch (msg.MsgType) {
      case "text":
        messages.push({
          ...baseMessage,
          contentType: "text",
          text: msg.Content,
        } as UnifiedInboundMessage);
        break;

      case "image":
        messages.push({
          ...baseMessage,
          contentType: "image",
          mediaUrl: msg.PicUrl,
        } as UnifiedInboundMessage);
        break;

      case "voice":
        messages.push({
          ...baseMessage,
          contentType: "audio",
          text: msg.Recognition, // Voice recognition result if available
          mediaType: msg.Format,
        } as UnifiedInboundMessage);
        break;

      case "video":
      case "shortvideo":
        messages.push({
          ...baseMessage,
          contentType: "video",
        } as UnifiedInboundMessage);
        break;

      case "location":
        messages.push({
          ...baseMessage,
          contentType: "location",
          location: {
            latitude: msg.Location_X || 0,
            longitude: msg.Location_Y || 0,
            address: msg.Label,
          },
        } as UnifiedInboundMessage);
        break;

      case "link":
        messages.push({
          ...baseMessage,
          contentType: "text",
          text: `[Link] ${msg.Title}\n${msg.Description}\n${msg.Url}`,
        } as UnifiedInboundMessage);
        break;

      default:
        console.log(`Unsupported WeChat message type: ${msg.MsgType}`);
    }

    return messages;
  },

  /**
   * Send message to WeChat user
   */
  async sendMessage(
    channelAccountId: string,
    message: UnifiedOutboundMessage
  ): Promise<ChannelSendResult> {
    try {
      const supabase = await createServiceClient();

      // Get channel account credentials
      const { data: channelAccountData } = await supabase
        .from("channel_accounts")
        .select("credentials")
        .eq("account_id", channelAccountId)
        .eq("channel_type", "wechat")
        .single();

      // Type cast for channel account
      const channelAccount = channelAccountData as { credentials: Record<string, unknown> } | null;

      if (!channelAccount?.credentials) {
        return { success: false, error: "Channel account not found" };
      }

      const credentials = channelAccount.credentials as unknown as WeChatCredentials;
      const accessToken = await getAccessToken(credentials);

      // Use Customer Service Message API (for messages within 48 hours)
      const url = `https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token=${accessToken}`;

      let messagePayload: Record<string, unknown>;

      switch (message.contentType) {
        case "text":
          messagePayload = {
            touser: message.channelUserId,
            msgtype: "text",
            text: {
              content: message.text,
            },
          };
          break;

        case "image":
          // Need to upload media first to get media_id
          // For now, send as text link
          messagePayload = {
            touser: message.channelUserId,
            msgtype: "text",
            text: {
              content: `[Image] ${message.mediaUrl}`,
            },
          };
          break;

        default:
          messagePayload = {
            touser: message.channelUserId,
            msgtype: "text",
            text: {
              content: message.text || "",
            },
          };
      }

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(messagePayload),
      });

      const result = await response.json();

      if (result.errcode && result.errcode !== 0) {
        // Error code 45015: out of 48-hour window, need to use template message
        if (result.errcode === 45015) {
          return {
            success: false,
            error: "Customer service message window expired. Use template message instead.",
          };
        }
        return {
          success: false,
          error: `WeChat API error: ${result.errcode} - ${result.errmsg}`,
        };
      }

      return { success: true, messageId: result.msgid?.toString() };
    } catch (error) {
      console.error("Failed to send WeChat message:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  /**
   * Validate WeChat webhook signature
   *
   * WeChat sends: signature, timestamp, nonce in query params
   * Signature = SHA1(sort([token, timestamp, nonce]).join(""))
   */
  validateSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    try {
      // For WeChat, payload contains "timestamp,nonce" format
      const [timestamp, nonce] = payload.split(",");

      // Sort alphabetically and join
      const arr = [secret, timestamp, nonce].sort();
      const str = arr.join("");

      // SHA1 hash
      const hash = crypto.createHash("sha1").update(str).digest("hex");

      return hash === signature;
    } catch (error) {
      console.error("WeChat signature validation error:", error);
      return false;
    }
  },

  /**
   * Get WeChat user profile
   *
   * Note: Only works for users who have interacted with the official account
   */
  async getUserProfile(
    channelAccountId: string,
    channelUserId: string
  ): Promise<{
    displayName?: string;
    pictureUrl?: string;
    statusMessage?: string;
  }> {
    try {
      const supabase = await createServiceClient();

      const { data: channelAccountData } = await supabase
        .from("channel_accounts")
        .select("credentials")
        .eq("account_id", channelAccountId)
        .eq("channel_type", "wechat")
        .single();

      // Type cast for channel account
      const channelAccount = channelAccountData as { credentials: Record<string, unknown> } | null;

      if (!channelAccount?.credentials) {
        return {};
      }

      const credentials = channelAccount.credentials as unknown as WeChatCredentials;
      const accessToken = await getAccessToken(credentials);

      const url = `https://api.weixin.qq.com/cgi-bin/user/info?access_token=${accessToken}&openid=${channelUserId}&lang=zh_CN`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.errcode) {
        console.error(`WeChat user info error: ${data.errcode} - ${data.errmsg}`);
        return {};
      }

      return {
        displayName: data.nickname,
        pictureUrl: data.headimgurl,
      };
    } catch (error) {
      console.error("Failed to get WeChat user profile:", error);
      return {};
    }
  },
};

/**
 * Upload media to WeChat server
 * Returns media_id for use in messages
 */
export async function uploadMedia(
  credentials: WeChatCredentials,
  type: "image" | "voice" | "video" | "thumb",
  mediaUrl: string
): Promise<string | null> {
  try {
    const accessToken = await getAccessToken(credentials);

    // Download the media file
    const mediaResponse = await fetch(mediaUrl);
    const mediaBuffer = await mediaResponse.arrayBuffer();

    // Create form data
    const formData = new FormData();
    formData.append("media", new Blob([mediaBuffer]), "media");

    const url = `https://api.weixin.qq.com/cgi-bin/media/upload?access_token=${accessToken}&type=${type}`;

    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (result.errcode) {
      console.error(`WeChat media upload error: ${result.errcode} - ${result.errmsg}`);
      return null;
    }

    return result.media_id;
  } catch (error) {
    console.error("Failed to upload media to WeChat:", error);
    return null;
  }
}

/**
 * Send template message (for messages outside 48-hour window)
 *
 * Template messages require:
 * 1. Pre-approved template in WeChat admin
 * 2. User must have interacted with official account
 */
export async function sendTemplateMessage(
  credentials: WeChatCredentials,
  openId: string,
  templateId: string,
  data: Record<string, { value: string; color?: string }>,
  url?: string,
  miniProgram?: { appid: string; pagepath: string }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const accessToken = await getAccessToken(credentials);

    const apiUrl = `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${accessToken}`;

    const payload: Record<string, unknown> = {
      touser: openId,
      template_id: templateId,
      data,
    };

    if (url) {
      payload.url = url;
    }

    if (miniProgram) {
      payload.miniprogram = miniProgram;
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (result.errcode && result.errcode !== 0) {
      return {
        success: false,
        error: `WeChat API error: ${result.errcode} - ${result.errmsg}`,
      };
    }

    return { success: true, messageId: result.msgid?.toString() };
  } catch (error) {
    console.error("Failed to send WeChat template message:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generate WeChat verification response for webhook setup
 */
export function generateVerificationResponse(echostr: string): string {
  return echostr;
}

/**
 * Build passive reply XML for immediate response
 * (Used when responding directly in webhook handler)
 */
export { buildXmlResponse };
