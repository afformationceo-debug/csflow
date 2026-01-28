import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Procedure keywords for auto-detection (Korean + other languages)
const PROCEDURE_KEYWORDS: Record<string, string[]> = {
  "라식": ["라식", "lasik", "ラシック", "レーシック", "近视手术"],
  "라섹": ["라섹", "lasek", "prk", "ラセック"],
  "스마일라식": ["스마일", "smile", "スマイル"],
  "백내장": ["백내장", "cataract", "白内障", "白內障"],
  "렌즈삽입술": ["렌즈삽입", "icl", "렌즈삽입술", "iol", "眼内レンズ", "人工晶体"],
  "눈성형": ["눈성형", "쌍꺼풀", "double eyelid", "二重", "双眼皮"],
  "코성형": ["코성형", "rhinoplasty", "鼻整形", "隆鼻"],
  "리프팅": ["리프팅", "lifting", "リフティング", "提升"],
  "보톡스": ["보톡스", "botox", "ボトックス", "肉毒素"],
  "필러": ["필러", "filler", "フィラー", "填充"],
  "치아교정": ["교정", "orthodontic", "矯正", "正畸"],
  "임플란트": ["임플란트", "implant", "インプラント", "种植牙"],
  "화이트닝": ["화이트닝", "whitening", "ホワイトニング", "美白"],
  "피부관리": ["피부관리", "skin care", "スキンケア", "护肤"],
  "지방흡입": ["지방흡입", "liposuction", "脂肪吸引", "吸脂"],
  "가슴성형": ["가슴성형", "breast", "豊胸", "隆胸"],
  "모발이식": ["모발이식", "hair transplant", "植毛", "植发"],
  "비절개": ["비절개", "non-incisional", "非切開"],
  "자연유착": ["자연유착", "natural adhesion"],
  "절개": ["절개법", "incisional", "切開"],
};

// Concern keywords for auto-detection
const CONCERN_KEYWORDS: Record<string, string[]> = {
  "비용/가격": ["가격", "비용", "얼마", "price", "cost", "how much", "値段", "いくら", "費用", "价格", "多少钱"],
  "통증": ["아프", "통증", "pain", "hurt", "痛い", "痛み", "疼", "痛"],
  "부작용": ["부작용", "side effect", "risk", "위험", "副作用", "リスク", "风险"],
  "회복기간": ["회복", "recovery", "다운타임", "downtime", "回復", "恢复"],
  "흉터": ["흉터", "scar", "傷跡", "瘢痕", "疤痕"],
  "자연스러움": ["자연스러", "natural", "自然", "자연"],
  "재수술": ["재수술", "revision", "再手術", "修复"],
  "유지기간": ["유지", "duration", "last", "how long", "持続", "维持"],
  "마취": ["마취", "anesthesia", "sedation", "麻酔", "麻醉"],
  "입원": ["입원", "hospital stay", "入院", "住院"],
  "보험적용": ["보험", "insurance", "保険", "保险"],
  "해외환자": ["해외", "외국", "foreign", "international", "海外", "외국인"],
  "언어소통": ["통역", "번역", "interpreter", "translator", "通訳", "翻译"],
  "숙소/교통": ["숙소", "호텔", "교통", "hotel", "transport", "ホテル", "交通", "住宿"],
};

/**
 * POST /api/customers/[id]/analyze
 * Analyze conversation messages to extract interests and concerns
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: customerId } = await params;
    const body = await request.json();
    const { conversationId } = body;

    if (!conversationId) {
      return NextResponse.json({ error: "conversationId required" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // Get messages for the conversation
    const { data: messages, error: msgError } = await (supabase as any)
      .from("messages")
      .select("content, sender_type, translated_content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(100);

    if (msgError) {
      return NextResponse.json({ error: msgError.message }, { status: 500 });
    }

    // Combine all message text for analysis
    const allText = (messages || [])
      .map((m: any) => `${m.content || ""} ${m.translated_content || ""}`)
      .join(" ")
      .toLowerCase();

    // Detect interests
    const detectedInterests: string[] = [];
    for (const [procedure, keywords] of Object.entries(PROCEDURE_KEYWORDS)) {
      if (keywords.some(kw => allText.includes(kw.toLowerCase()))) {
        detectedInterests.push(procedure);
      }
    }

    // Detect concerns
    const detectedConcerns: string[] = [];
    for (const [concern, keywords] of Object.entries(CONCERN_KEYWORDS)) {
      if (keywords.some(kw => allText.includes(kw.toLowerCase()))) {
        detectedConcerns.push(concern);
      }
    }

    // Save to customer metadata
    const { data: customer } = await (supabase as any)
      .from("customers")
      .select("metadata")
      .eq("id", customerId)
      .single();

    const existingMeta = customer?.metadata || {};
    const updatedMeta = {
      ...existingMeta,
      interests: detectedInterests,
      concerns: detectedConcerns,
      analyzed_at: new Date().toISOString(),
    };

    await (supabase as any)
      .from("customers")
      .update({ metadata: updatedMeta, updated_at: new Date().toISOString() })
      .eq("id", customerId);

    return NextResponse.json({
      interests: detectedInterests,
      concerns: detectedConcerns,
    });
  } catch (error) {
    console.error("POST /api/customers/[id]/analyze error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
