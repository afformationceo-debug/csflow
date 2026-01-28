import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { ragPipeline } from "@/services/ai/rag-pipeline";
import type { SupportedLanguage } from "@/services/translation";

export const dynamic = "force-dynamic";

/**
 * POST /api/conversations/[id]/ai-suggest
 * Generate AI recommended response for a conversation using RAG pipeline
 * Returns: suggestion + detailed RAG logs for debugging
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const logs: string[] = [];
  const startTime = Date.now();

  try {
    logs.push(`[${new Date().toISOString()}] AI 제안 생성 시작`);

    const { id } = await params;
    const supabase = await createServiceClient();

    // Fetch the conversation with customer info
    logs.push("✓ 대화 정보 조회 중...");
    const { data: conversation } = await (supabase as any)
      .from("conversations")
      .select(`
        *,
        customer:customers(*)
      `)
      .eq("id", id)
      .single();

    if (!conversation) {
      logs.push("✗ 대화를 찾을 수 없습니다");
      return NextResponse.json({ error: "Conversation not found", logs }, { status: 404 });
    }

    logs.push(`✓ 대화 ID: ${id}`);
    logs.push(`✓ 고객: ${conversation.customer?.name || "Unknown"}`);
    logs.push(`✓ 고객 언어: ${conversation.customer?.language || "ko"}`);

    // Fetch recent messages for context (last 10)
    logs.push("✓ 최근 메시지 조회 중 (최대 10개)...");
    const { data: messages } = await (supabase as any)
      .from("messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: false })
      .limit(10);

    const recentMessages = (messages || []).reverse();
    logs.push(`✓ 조회된 메시지: ${recentMessages.length}개`);

    const customerLang = (conversation.customer?.language || "ko") as SupportedLanguage;
    const lastInbound = recentMessages.filter((m: any) => m.direction === "inbound").pop();

    if (!lastInbound) {
      logs.push("✗ 고객 메시지가 없습니다");
      return NextResponse.json({ suggestion: null, logs });
    }

    logs.push(`✓ 마지막 고객 메시지: "${lastInbound.content.substring(0, 50)}..."`);

    const tenantId = conversation.tenant_id;

    // Build conversation history for RAG
    const conversationHistory = recentMessages.map((m: any) => ({
      role: m.direction === "inbound" ? "user" : "assistant",
      content: m.content,
    }));

    logs.push("━━━━━━━━━━━━━━━━━━━━━━━━━━");
    logs.push("🔍 RAG 파이프라인 실행 중...");
    logs.push("━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Use RAG pipeline
    const ragResult = await ragPipeline.process({
      query: lastInbound.translated_content || lastInbound.content,
      tenantId,
      conversationId: id,
      customerLanguage: customerLang,
      conversationHistory,
    });

    logs.push(`✓ RAG 처리 완료 (${Date.now() - startTime}ms)`);
    logs.push(`✓ 사용 모델: ${ragResult.model}`);
    logs.push(`✓ 신뢰도: ${Math.round((ragResult.confidence || 0) * 100)}%`);

    if (ragResult.sources && ragResult.sources.length > 0) {
      logs.push(`✓ 참조 문서: ${ragResult.sources.length}개`);
      ragResult.sources.forEach((src, idx) => {
        logs.push(`  ${idx + 1}. ${src.name} (관련도: ${Math.round((src.relevanceScore || 0) * 100)}%)`);
        if (src.description) {
          logs.push(`     → ${src.description.substring(0, 80)}...`);
        }
      });
    } else {
      logs.push("⚠ 참조 문서 없음 (컨텍스트 기반 응답)");
    }

    if (ragResult.shouldEscalate) {
      logs.push(`⚠ 에스컬레이션 권장: ${ragResult.escalationReason}`);
    }

    logs.push("━━━━━━━━━━━━━━━━━━━━━━━━━━");
    logs.push(`✓ 총 처리 시간: ${Date.now() - startTime}ms`);

    return NextResponse.json({
      suggestion: {
        // FIX: ragResult.response is KOREAN, translatedResponse is CUSTOMER LANGUAGE
        original: ragResult.translatedResponse || ragResult.response,  // Customer language (e.g., English)
        korean: ragResult.response,  // Korean (AI's original response)
        confidence: ragResult.confidence,
        shouldEscalate: ragResult.shouldEscalate,
        escalationReason: ragResult.escalationReason,
      },
      logs,
      sources: ragResult.sources || [],
    });
  } catch (error) {
    logs.push(`✗ 오류 발생: ${error instanceof Error ? error.message : "Unknown error"}`);
    console.error("AI suggest error:", error);
    return NextResponse.json({
      error: "Failed to generate suggestion",
      logs
    }, { status: 500 });
  }
}

function getTemplateSuggestion(lang: string, _content: string): string {
  const templates: Record<string, string> = {
    ja: "お問い合わせありがとうございます。詳しくご案内させていただきます。",
    en: "Thank you for your inquiry. Let me provide you with more details.",
    zh: "感謝您的詢問。讓我為您提供更多詳細資訊。",
    "zh-hans": "感谢您的咨询。让我为您提供更多详细信息。",
    th: "ขอบคุณสำหรับการสอบถาม ให้ข้อมูลเพิ่มเติมค่ะ",
    vi: "Cảm ơn bạn đã liên hệ. Để tôi cung cấp thêm thông tin chi tiết.",
    ko: "문의 감사합니다. 자세한 안내 도와드리겠습니다.",
    mn: "Лавлагаа авсанд баярлалаа. Дэлгэрэнгүй мэдээлэл өгье.",
  };
  return templates[lang.toLowerCase()] || templates.ko;
}
