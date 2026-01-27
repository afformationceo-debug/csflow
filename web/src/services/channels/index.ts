import { ChannelType } from "@/lib/supabase/types";
import { ChannelAdapter, UnifiedInboundMessage, UnifiedOutboundMessage, ChannelSendResult } from "./types";
import { lineAdapter } from "./line";
import { kakaoAdapter } from "./kakao";
import { facebookAdapter } from "./facebook";
import { instagramAdapter } from "./instagram";
import { whatsappAdapter } from "./whatsapp";
import { wechatAdapter } from "./wechat";

export * from "./types";
export { lineAdapter } from "./line";
export { kakaoAdapter } from "./kakao";
export { facebookAdapter } from "./facebook";
export { instagramAdapter } from "./instagram";
export { whatsappAdapter } from "./whatsapp";
export { wechatAdapter } from "./wechat";

// Channel adapter registry
const adapters: Map<ChannelType, ChannelAdapter> = new Map([
  ["line", lineAdapter],
  ["kakao", kakaoAdapter],
  ["facebook", facebookAdapter],
  ["instagram", instagramAdapter],
  ["whatsapp", whatsappAdapter],
  ["wechat", wechatAdapter],
]);

/**
 * Get adapter for a specific channel type
 */
export function getChannelAdapter(channelType: ChannelType): ChannelAdapter | undefined {
  return adapters.get(channelType);
}

/**
 * Parse webhook payload for any channel type
 */
export async function parseChannelWebhook(
  channelType: ChannelType,
  payload: unknown
): Promise<UnifiedInboundMessage[]> {
  const adapter = adapters.get(channelType);
  if (!adapter) {
    throw new Error(`No adapter found for channel type: ${channelType}`);
  }
  return adapter.parseWebhook(payload);
}

/**
 * Send message to any channel
 */
export async function sendChannelMessage(
  channelType: ChannelType,
  channelAccountId: string,
  message: UnifiedOutboundMessage
): Promise<ChannelSendResult> {
  const adapter = adapters.get(channelType);
  if (!adapter) {
    return {
      success: false,
      error: `No adapter found for channel type: ${channelType}`,
    };
  }
  return adapter.sendMessage(channelAccountId, message);
}

/**
 * Validate webhook signature for any channel
 */
export function validateChannelWebhook(
  channelType: ChannelType,
  payload: string,
  signature: string,
  secret: string
): boolean {
  const adapter = adapters.get(channelType);
  if (!adapter) {
    return false;
  }
  return adapter.validateSignature(payload, signature, secret);
}

/**
 * Get user profile from channel
 */
export async function getChannelUserProfile(
  channelType: ChannelType,
  channelAccountId: string,
  channelUserId: string
): Promise<{
  displayName?: string;
  pictureUrl?: string;
  statusMessage?: string;
}> {
  const adapter = adapters.get(channelType);
  if (!adapter?.getUserProfile) {
    return {};
  }
  return adapter.getUserProfile(channelAccountId, channelUserId);
}
