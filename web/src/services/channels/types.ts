import { ChannelType, MessageContentType } from "@/lib/supabase/types";

/**
 * Unified message format for all channels
 */
export interface UnifiedInboundMessage {
  // Channel identification
  channelType: ChannelType;
  channelAccountId: string;

  // User identification
  channelUserId: string;
  channelUsername?: string;
  userProfileUrl?: string;

  // Message content
  messageId: string;
  contentType: MessageContentType;
  text?: string;
  mediaUrl?: string;
  mediaType?: string;

  // Location (if applicable)
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };

  // Sticker (for LINE, KakaoTalk)
  sticker?: {
    packageId: string;
    stickerId: string;
  };

  // Timestamp
  timestamp: Date;

  // Original payload for debugging
  rawPayload: unknown;
}

export interface UnifiedOutboundMessage {
  channelType: ChannelType;
  channelUserId: string;
  contentType: MessageContentType;
  text?: string;
  mediaUrl?: string;

  // Quick replies (buttons)
  quickReplies?: {
    label: string;
    action: "message" | "url";
    value: string;
  }[];

  // Rich message templates
  template?: {
    type: "carousel" | "buttons" | "confirm" | "image";
    title?: string;
    text?: string;
    thumbnailUrl?: string;
    actions?: {
      type: "message" | "uri" | "postback";
      label: string;
      data?: string;
      uri?: string;
      text?: string;
    }[];
  };
}

export interface ChannelSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Channel adapter interface
 */
export interface ChannelAdapter {
  channelType: ChannelType;

  // Parse incoming webhook to unified format
  parseWebhook(payload: unknown): Promise<UnifiedInboundMessage[]>;

  // Send message to channel
  sendMessage(
    channelAccountId: string,
    message: UnifiedOutboundMessage
  ): Promise<ChannelSendResult>;

  // Validate webhook signature
  validateSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean;

  // Get user profile
  getUserProfile?(
    channelAccountId: string,
    channelUserId: string
  ): Promise<{
    displayName?: string;
    pictureUrl?: string;
    statusMessage?: string;
  }>;
}

/**
 * Webhook event types
 */
export interface WebhookEvent {
  channelType: ChannelType;
  channelAccountId: string;
  events: UnifiedInboundMessage[];
  rawPayload: unknown;
}
