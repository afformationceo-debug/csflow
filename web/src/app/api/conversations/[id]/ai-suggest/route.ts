import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/conversations/[id]/ai-suggest
 * Generate AI recommended response for a conversation
 * Returns both customer-language text and Korean meaning
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServiceClient();

    // Fetch the conversation with customer info
    const { data: conversation } = await (supabase as any)
      .from("conversations")
      .select(`
        *,
        customer:customers(*)
      `)
      .eq("id", id)
      .single();

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Fetch recent messages for context (last 10)
    const { data: messages } = await (supabase as any)
      .from("messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: false })
      .limit(10);

    const recentMessages = (messages || []).reverse();
    const customerLang = conversation.customer?.language || "ko";
    const lastInbound = recentMessages.filter((m: any) => m.direction === "inbound").pop();

    if (!lastInbound) {
      return NextResponse.json({ suggestion: null });
    }

    // Get tenant info for context
    const tenantId = conversation.tenant_id;
    let tenantInfo = "";
    if (tenantId) {
      const { data: tenant } = await (supabase as any)
        .from("tenants")
        .select("name, display_name, specialty")
        .eq("id", tenantId)
        .single();
      if (tenant) {
        tenantInfo = `병원: ${tenant.display_name || tenant.name} (${tenant.specialty || "종합"})`;
      }
    }

    // Build conversation context
    const contextMessages = recentMessages.map((m: any) => {
      const role = m.direction === "inbound" ? "고객" : (m.sender_type === "ai" ? "AI" : "상담사");
      return `${role}: ${m.content}`;
    }).join("\n");

    // Language mapping for prompt
    const langNames: Record<string, string> = {
      ja: "일본어", en: "영어", zh: "중국어(번체)", "zh-hans": "중국어(간체)",
      th: "태국어", vi: "베트남어", ko: "한국어", mn: "몽골어",
    };
    const targetLangName = langNames[customerLang.toLowerCase()] || customerLang;

    // Use OpenAI to generate a suggestion
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      // Fallback: return a template response
      return NextResponse.json({
        suggestion: {
          original: getTemplateSuggestion(customerLang, lastInbound.content),
          korean: "안녕하세요, 문의 감사합니다. 자세한 안내 도와드리겠습니다.",
        },
      });
    }

    const systemPrompt = `You are a professional medical tourism customer service AI for a Korean hospital.
${tenantInfo}
Generate a helpful, friendly response to the customer's latest message.
You must respond in two parts:
1. "original": The response in ${targetLangName} (the customer's language)
2. "korean": The same response translated to Korean

Rules:
- Be polite, professional and helpful
- If asking about price, give a general range or suggest a consultation
- If asking about procedures, provide brief accurate info
- Keep responses concise (1-3 sentences)
- Match the customer's language exactly
- Return valid JSON only: {"original": "...", "korean": "..."}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `대화 맥락:\n${contextMessages}\n\n고객의 최신 메시지에 대한 추천 응답을 생성해주세요.` },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      return NextResponse.json({
        suggestion: {
          original: getTemplateSuggestion(customerLang, lastInbound.content),
          korean: "안녕하세요, 문의 감사합니다. 자세한 안내 도와드리겠습니다.",
        },
      });
    }

    const aiData = await response.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";

    try {
      // Parse JSON response
      const cleaned = aiContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);
      return NextResponse.json({
        suggestion: {
          original: parsed.original || "",
          korean: parsed.korean || "",
        },
      });
    } catch {
      // If JSON parsing fails, use the raw text
      return NextResponse.json({
        suggestion: {
          original: aiContent,
          korean: aiContent,
        },
      });
    }
  } catch (error) {
    console.error("AI suggest error:", error);
    return NextResponse.json({ error: "Failed to generate suggestion" }, { status: 500 });
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
