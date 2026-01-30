import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { kakaoAdapter, UnifiedInboundMessage } from "@/services/channels";
import { serverCustomerService } from "@/services/customers";
import { serverConversationService } from "@/services/conversations";
import { serverMessageService } from "@/services/messages";
import { translationService, SupportedLanguage } from "@/services/translation";
import { ragPipeline } from "@/services/ai/rag-pipeline";
import { serverEscalationService } from "@/services/escalations";

// Disable body parsing for signature verification
export const dynamic = "force-dynamic";

/**
 * KakaoTalk Webhook Handler (Kakao i Open Builder Skill)
 * Receives messages from Kakao and processes them through the CS automation pipeline
 * Returns Kakao skill response format
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    // Validate API key (Kakao uses REST API key validation)
    const apiKey = request.headers.get("authorization")?.replace("KakaoAK ", "") || "";
    const expectedApiKey = process.env.KAKAO_REST_API_KEY || "";

    // Simple validation - in production, use proper signature verification
    if (expectedApiKey && apiKey !== expectedApiKey) {
      // Try signature validation as fallback
      const signature = request.headers.get("x-kakao-signature") || "";
      if (!kakaoAdapter.validateSignature(rawBody, signature, expectedApiKey)) {
        console.error("Invalid Kakao webhook authorization");
        // Return valid Kakao response even on auth failure (Kakao requirement)
        return NextResponse.json({
          version: "2.0",
          template: {
            outputs: [
              {
                simpleText: {
                  text: "인증에 실패했습니다. 잠시 후 다시 시도해주세요.",
                },
              },
            ],
          },
        });
      }
    }

    const payload = JSON.parse(rawBody);

    // Parse webhook to unified format
    const messages = await kakaoAdapter.parseWebhook(payload);

    if (messages.length === 0) {
      return NextResponse.json({
        version: "2.0",
        template: {
          outputs: [
            {
              simpleText: {
                text: "메시지를 받았습니다.",
              },
            },
          ],
        },
      });
    }

    // Process first message and return response
    // Kakao expects synchronous response
    const message = messages[0];
    const result = await processInboundMessage(message);

    // Return Kakao skill response
    if (result.response) {
      return NextResponse.json(
        kakaoAdapter.createSkillResponse({
          channelType: "kakao",
          channelUserId: message.channelUserId,
          contentType: "text",
          text: result.response,
          quickReplies: result.quickReplies,
        })
      );
    }

    // Default response when no AI response
    return NextResponse.json({
      version: "2.0",
      template: {
        outputs: [
          {
            simpleText: {
              text: result.waitingMessage || "담당자가 곧 답변드리겠습니다. 잠시만 기다려주세요.",
            },
          },
        ],
      },
    });
  } catch (error) {
    console.error("Kakao webhook error:", error);

    // Return valid Kakao response even on error
    return NextResponse.json({
      version: "2.0",
      template: {
        outputs: [
          {
            simpleText: {
              text: "죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
            },
          },
        ],
      },
    });
  }
}

interface ProcessResult {
  response?: string;
  waitingMessage?: string;
  quickReplies?: {
    label: string;
    action: "message" | "url";
    value: string;
  }[];
}

/**
 * Process a single inbound message
 * Returns response for Kakao skill
 */
async function processInboundMessage(
  message: UnifiedInboundMessage
): Promise<ProcessResult> {
  const supabase = await createServiceClient();

  // 1. Find channel account and tenant
  // For Kakao, we might need to match by bot ID or use a default account
  const { data: channelAccounts } = await supabase
    .from("channel_accounts")
    .select("*, tenant:tenants(*)")
    .eq("channel_type", "kakao");

  // Find matching account or use first one
  const channelAccount = (channelAccounts as unknown as Array<{
    id: string;
    tenant_id: string;
    account_id: string;
    tenant: { ai_config?: { enabled?: boolean } };
  }> | null)?.find(
    (acc) => acc.account_id === message.channelAccountId
  ) || (channelAccounts as unknown as Array<{
    id: string;
    tenant_id: string;
    account_id: string;
    tenant: { ai_config?: { enabled?: boolean } };
  }> | null)?.[0];

  if (!channelAccount) {
    console.error(`Kakao channel account not found`);
    return { waitingMessage: "서비스 설정 중입니다. 잠시 후 다시 문의해주세요." };
  }

  const tenantId = channelAccount.tenant_id;
  const tenant = channelAccount.tenant;

  // 2. Find or create customer
  const { customer, customerChannel } =
    await serverCustomerService.findOrCreateCustomer({
      tenantId,
      channelAccountId: channelAccount.id,
      channelUserId: message.channelUserId,
      channelUsername: message.channelUsername,
      name: undefined, // Kakao doesn't expose user name
      profileImageUrl: undefined,
      language: "KO", // Default for Kakao users (Korean)
    });

  // 3. Get or create conversation
  const conversation = await serverConversationService.getOrCreateConversation(
    customer.id,
    tenantId
  );

  // 4. Detect language and translate message if needed
  let messageText = message.text || "";
  let originalLanguage: SupportedLanguage = "KO";
  let translatedText: string | undefined;

  if (messageText) {
    originalLanguage = await translationService.detectLanguage(messageText);

    // Translate to Korean if not Korean
    if (originalLanguage !== "KO") {
      const translation = await translationService.translateForCS(
        messageText,
        "to_agent",
        originalLanguage
      );
      translatedText = translation.text;
    }
  }

  // 5. Save inbound message
  const savedMessage = await serverMessageService.createInboundMessage({
    conversationId: conversation.id,
    customerChannelId: customerChannel.id,
    content: messageText,
    contentType: message.contentType,
    mediaUrl: message.mediaUrl,
    originalLanguage: originalLanguage,
    externalId: message.messageId,
    metadata: {
      sticker: message.sticker,
      location: message.location,
    },
  });

  // Update translated content if available
  if (translatedText) {
    await serverMessageService.updateTranslation(
      savedMessage.id,
      translatedText,
      "KO"
    );
  }

  // 6. Check if AI is enabled for this conversation and tenant
  const aiConfig = tenant.ai_config;
  const aiEnabled = conversation.ai_enabled && aiConfig?.enabled;

  if (!aiEnabled || !messageText) {
    // Mark as waiting for agent
    await (supabase
      .from("conversations") as unknown as {
        update: (data: unknown) => { eq: (col: string, val: string) => unknown };
      })
      .update({ status: "waiting" })
      .eq("id", conversation.id);

    return {
      waitingMessage: "담당자 연결 중입니다. 잠시만 기다려주세요.",
    };
  }

  // 7. Process through RAG pipeline
  const queryText = translatedText || messageText;
  const ragResult = await ragPipeline.process({
    query: queryText,
    tenantId,
    conversationId: conversation.id,
    customerLanguage: originalLanguage,
  });

  // 8. Handle escalation or return AI response
  if (ragResult.shouldEscalate) {
    // Create escalation
    await serverEscalationService.createEscalation({
      conversationId: conversation.id,
      messageId: savedMessage.id,
      reason: ragResult.escalationReason || "AI 신뢰도 미달",
      aiConfidence: ragResult.confidence,
    });

    // Update conversation status
    await (supabase
      .from("conversations") as unknown as {
        update: (data: unknown) => { eq: (col: string, val: string) => unknown };
      })
      .update({ status: "escalated" })
      .eq("id", conversation.id);

    return {
      waitingMessage:
        "상세한 상담이 필요합니다. 전문 상담사가 곧 연락드리겠습니다.",
    };
  }

  if (ragResult.response) {
    // Save AI response
    await serverMessageService.createAIMessage({
      conversationId: conversation.id,
      content: ragResult.response,
      originalLanguage: "KO",
      translatedContent: ragResult.translatedResponse,
      translatedLanguage: originalLanguage,
      aiConfidence: ragResult.confidence,
      aiModel: ragResult.model,
    });

    // Return response in customer's language
    const responseText = ragResult.translatedResponse || ragResult.response;

    return {
      response: responseText,
      quickReplies:
        ragResult.confidence > 0.9
          ? undefined
          : [
              {
                label: "상담사 연결",
                action: "message" as const,
                value: "상담사 연결해주세요",
              },
            ],
    };
  }

  return {
    waitingMessage: "잠시 후 답변드리겠습니다.",
  };
}

/**
 * Kakao webhook verification (GET request)
 */
export async function GET() {
  return NextResponse.json({ status: "Kakao webhook endpoint active" });
}
