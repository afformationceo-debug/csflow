# 긴급 수정 사항 (2026-01-29)

## 개요
사용자가 보고한 두 가지 심각한 프로덕션 이슈를 해결했습니다.

---

## 문제 1: 에이전트 메시지 번역 표시 오류 ✅ 해결

### 증상
- **사용자 보고**: "메세지 작성하면 번역은 되는데 전송하면 한국어로 나갑니다"
- **실제 문제**: 에이전트가 한국어로 작성 → DeepL로 번역 → 고객 언어로 전송은 **정상 작동**
- **UI 문제**: 인박스에서 전송된 메시지를 표시할 때 **한국어 원문**이 메인으로 표시되고, 실제 전송된 **외국어**가 숨겨진 번역 섹션에만 표시됨

### 근본 원인
`/web/src/app/(dashboard)/inbox/page.tsx` 라인 1910-1928:
```typescript
// 잘못된 로직 (수정 전)
<p className="text-sm leading-relaxed">{msg.content}</p>  // 항상 한국어 표시
{showTranslation && msg.translatedContent && (
  <p>{msg.sender === "agent" ? msg.content : msg.translatedContent}</p>  // 한국어 또 표시
)}
```

### 해결 방법
메시지 표시 로직을 수정하여:
- **메인 말풍선**: 에이전트 메시지는 `translated_content` (실제 전송된 외국어) 표시
- **번역 토글 섹션**: 원문인 `content` (한국어) 표시

```typescript
// 수정 후
<p className="text-sm leading-relaxed">
  {msg.sender === "agent" && msg.translatedContent
    ? msg.translatedContent  // 에이전트: 외국어 표시 (실제 전송된 내용)
    : msg.content}            // 고객: 원문 표시
</p>
{showTranslation && msg.translatedContent && (
  <>
    <Globe className="h-2.5 w-2.5" />
    {msg.sender === "agent" ? "원문 (한국어)" : "번역 (한국어)"}
    <p>{msg.sender === "agent" ? msg.content : msg.translatedContent}</p>
  </>
)}
```

### 수정된 파일
- `/web/src/app/(dashboard)/inbox/page.tsx` (라인 1910-1932)

### 검증 결과
- ✅ 에이전트가 한국어로 메시지 작성
- ✅ DeepL API로 고객 언어(EN/JA/ZH 등)로 번역
- ✅ 번역된 외국어가 고객에게 전송됨 (기존에도 정상 작동)
- ✅ **인박스 UI에서 외국어가 메인으로 표시됨** (NEW - 수정됨)
- ✅ 번역 토글하면 한국어 원문 확인 가능 (NEW - 수정됨)

---

## 문제 2: 고객 언어 자동 감지 오류 ✅ 해결

### 증상
- **사용자 보고**: "고객이 영어로 문의를했는데 일본어로 자동 생성이 되는 문제"
- **영향 범위**:
  1. AI 자동응대가 잘못된 언어로 생성됨
  2. DeepL 자동번역이 잘못된 타겟 언어로 번역됨
  3. 에이전트 수동 답변도 잘못된 언어로 번역됨

### 근본 원인
`/web/src/app/api/webhooks/line/route.ts` 라인 136:
```typescript
const result = await serverCustomerService.findOrCreateCustomer({
  tenantId,
  channelAccountId: channelAccountData.id,
  channelUserId: message.channelUserId,
  channelUsername: userProfile.displayName || message.channelUsername,
  name: userProfile.displayName,
  profileImageUrl: userProfile.pictureUrl,
  language: "JA",  // ← 하드코딩! 모든 LINE 고객을 일본어로 설정
});
```

**문제점**:
1. 첫 메시지 수신 시 고객 생성할 때 `language: "JA"` 하드코딩
2. 실제 메시지 언어 감지는 라인 166에서 수행하지만, **고객 프로필을 업데이트하지 않음**
3. 결과: 영어로 문의한 고객도 DB에 `language: "JA"`로 저장됨
4. AI 응답 생성 시 `customer.language` 필드를 참조하므로 일본어로 응답 생성

### 해결 방법

#### 1단계: 첫 고객 생성 시 실제 언어 감지 (라인 126-148)
```typescript
// 수정 전
language: "JA", // Default for LINE users (mostly Japanese)

// 수정 후
let initialLanguage: SupportedLanguage = "EN"; // Default to English (more universal)
if (message.text) {
  try {
    initialLanguage = await translationService.detectLanguage(message.text);
    console.log(`[LINE] Initial language detection: ${initialLanguage}`);
  } catch (e) {
    console.error("[LINE] Initial language detection failed:", e);
  }
}
// ... then use initialLanguage
```

#### 2단계: 매 메시지마다 언어 재감지 및 업데이트 (라인 159-181)
```typescript
// 수정 전
if (messageText) {
  try {
    originalLanguage = await translationService.detectLanguage(messageText);
    // ... translate but don't update customer profile
  }
}

// 수정 후
if (messageText) {
  try {
    originalLanguage = await translationService.detectLanguage(messageText);
    console.log(`[LINE] Detected customer language: ${originalLanguage}`);

    // Update customer language if different from current
    if (customer.language !== originalLanguage) {
      try {
        await (supabase.from("customers") as any)
          .update({ language: originalLanguage })
          .eq("id", customer.id);
        customer.language = originalLanguage; // Update local copy
        console.log(`[LINE] Updated customer language to: ${originalLanguage}`);
      } catch (e) {
        console.error("[LINE] Failed to update customer language:", e);
      }
    }

    // Translate to Korean if not Korean
    if (originalLanguage !== "KO") {
      const translation = await translationService.translateForCS(
        messageText,
        "to_agent",
        originalLanguage
      );
      translatedText = translation.text;
    }
  } catch (e) {
    console.error("[LINE] Translation failed (continuing without):", e);
  }
}
```

### 수정된 파일
- `/web/src/app/api/webhooks/line/route.ts` (라인 126-181)

### 검증 결과
- ✅ 영어로 문의한 고객 → `customer.language = "EN"` 저장
- ✅ 일본어로 문의한 고객 → `customer.language = "JA"` 저장
- ✅ 한국어로 문의한 고객 → `customer.language = "KO"` 저장
- ✅ AI 자동응대가 고객 언어에 맞게 생성됨
- ✅ DeepL 번역이 올바른 타겟 언어로 수행됨
- ✅ 고객이 중간에 언어를 바꾸면 자동 업데이트됨

---

## 언어 감지 로직 상세

### Unicode 패턴 기반 감지
`/web/src/services/translation.ts` `detectLanguage()` 함수:

```typescript
const patterns: { pattern: RegExp; lang: SupportedLanguage }[] = [
  { pattern: /[\uAC00-\uD7AF]/, lang: "KO" },         // 한글
  { pattern: /[\u3040-\u309F\u30A0-\u30FF]/, lang: "JA" }, // 히라가나/가타카나
  { pattern: /[\u4E00-\u9FFF]/, lang: "ZH" },         // 한자 (중국어)
  { pattern: /[\u0E00-\u0E7F]/, lang: "TH" },         // 태국어
  { pattern: /[\u0600-\u06FF]/, lang: "AR" },         // 아랍어
  { pattern: /[\u0400-\u04FF]/, lang: "RU" },         // 러시아어/키릴 문자
];

// Default to English for Latin scripts
return "EN";
```

### 지원 언어 (14개)
- KO (한국어)
- EN (영어)
- JA (일본어)
- ZH (중국어 간체)
- ZH-TW (중국어 번체)
- VI (베트남어)
- TH (태국어)
- ID (인도네시아어)
- DE (독일어)
- FR (프랑스어)
- ES (스페인어)
- PT (포르투갈어)
- RU (러시아어)
- AR (아랍어)

---

## 영향 범위

### 수정된 컴포넌트
1. **인박스 UI** (`inbox/page.tsx`)
   - 에이전트 메시지 표시 로직
   - 번역 토글 레이블

2. **LINE Webhook** (`api/webhooks/line/route.ts`)
   - 고객 생성 시 언어 감지
   - 메시지 수신 시 언어 재감지 및 업데이트

### 데이터베이스 영향
- `customers.language` 필드가 이제 실시간으로 정확하게 업데이트됨
- 기존 고객 레코드는 다음 메시지 수신 시 자동 수정됨

### 하위 호환성
- ✅ 기존 메시지 데이터 영향 없음
- ✅ 기존 고객 프로필은 다음 메시지 시 자동 수정
- ✅ AI 응답 로직 변경 없음 (언어 필드만 정확해짐)

---

## 테스트 시나리오

### 시나리오 1: 영어 고객
1. 고객이 LINE으로 "What is the price?" 전송
2. 시스템이 언어 감지: `EN`
3. DB에 `customer.language = "EN"` 저장
4. 에이전트가 한국어로 "가격은 150만원입니다" 작성
5. DeepL로 영어 번역: "The price is 1.5 million won"
6. 고객에게 영어로 전송 ✅
7. 인박스 UI에 영어 메시지 표시, 토글하면 한국어 원문 확인 ✅

### 시나리오 2: 일본어 고객
1. 고객이 LINE으로 "価格はいくらですか？" 전송
2. 시스템이 언어 감지: `JA`
3. DB에 `customer.language = "JA"` 저장
4. AI 자동응대가 일본어로 응답 생성 ✅
5. 인박스에서 일본어 메시지 확인 가능 ✅

### 시나리오 3: 언어 전환
1. 고객이 처음에 일본어로 문의 → `customer.language = "JA"`
2. 나중에 영어로 문의 → 시스템이 감지하여 `customer.language = "EN"` 업데이트
3. 이후 모든 응답이 영어로 생성됨 ✅

---

## 향후 개선 사항

### 1. 언어 감지 정확도 향상
- DeepL API의 언어 감지 기능 활용 (현재는 Unicode 패턴만 사용)
- 짧은 메시지에 대한 언어 감지 개선

### 2. 언어 선호도 학습
- 고객이 여러 언어를 혼용하는 경우 선호 언어 추적
- 대화 히스토리 기반 언어 예측

### 3. 수동 언어 변경
- 에이전트가 고객 프로필에서 언어 수동 설정 가능하도록 UI 추가

---

## 문서 업데이트

이 수정 사항은 다음 문서에 반영됨:
- `CLAUDE.md` - Section 23 신규 추가
- `claude.ai.md` - Section 23 신규 추가
- `CRITICAL_FIXES_2026-01-29.md` (본 문서)

---

## 커밋 정보

```bash
# 커밋 메시지 (예정)
Fix critical translation display and language detection issues

1. Fix agent message display in inbox UI
   - Show translated content (foreign language) as main message
   - Show original Korean content in translation toggle
   - Update translation label to clarify direction

2. Fix customer language detection in LINE webhook
   - Detect language from first message instead of hardcoding "JA"
   - Update customer.language field on every message
   - Enable accurate AI response generation and translation

Files changed:
- web/src/app/(dashboard)/inbox/page.tsx
- web/src/app/api/webhooks/line/route.ts

Resolves: User reported critical production issues
- "메세지 작성하면 번역은 되는데 전송하면 한국어로 나갑니다"
- "고객이 영어로 문의를했는데 일본어로 자동 생성이 되는 문제"

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

---

## 문제 3: RAG 실행 로그 가시성 부족 ✅ 해결

### 증상
- **사용자 요청**: "ai가 추천답변에 대한 rag어디서 어떻게 했는지 뜨는 실시간 로그에 대한 기록을 보여지게 해주셔야합니다"
- **문제**: AI 제안 응답이 생성될 때 어떤 지식베이스 문서를 참조했는지, 신뢰도가 어떻게 계산되었는지 등의 내부 과정이 보이지 않음
- **영향 범위**: CS 담당자가 AI 응답의 근거를 파악하기 어려움

### 근본 원인
`/web/src/app/api/conversations/[id]/ai-suggest/route.ts`:
- 기존에는 단순한 GPT-4 호출만 사용
- RAG 파이프라인을 거치지 않아 지식베이스 참조 정보 없음
- 실행 과정에 대한 로깅이 전혀 없음

### 해결 방법

#### 1단계: AI Suggest API를 RAG 파이프라인으로 완전 재작성 (라인 1-140)
```typescript
import { ragPipeline } from "@/services/ai/rag-pipeline";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const logs: string[] = [];
  const startTime = Date.now();

  try {
    logs.push(`[${new Date().toISOString()}] AI 제안 생성 시작`);

    // 1. 대화 정보 조회
    logs.push("✓ 대화 정보 조회 중...");
    const { data: conversation } = await supabase
      .from("conversations")
      .select(`*, customer:customers(*)`)
      .eq("id", id)
      .single();

    logs.push(`✓ 대화 ID: ${id}`);
    logs.push(`✓ 고객: ${conversation.customer?.name || "Unknown"}`);
    logs.push(`✓ 고객 언어: ${conversation.customer?.language || "ko"}`);

    // 2. 최근 메시지 조회
    logs.push("✓ 최근 메시지 조회 중 (최대 10개)...");
    const { data: messages } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: false })
      .limit(10);

    logs.push(`✓ 조회된 메시지: ${messages.length}개`);

    // 3. RAG 파이프라인 실행
    logs.push("━━━━━━━━━━━━━━━━━━━━━━━━━━");
    logs.push("🔍 RAG 파이프라인 실행 중...");
    logs.push("━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const ragResult = await ragPipeline.process({
      query: lastInbound.translated_content || lastInbound.content,
      tenantId: conversation.tenant_id,
      conversationId: id,
      customerLanguage: customerLang,
      conversationHistory,
    });

    logs.push(`✓ RAG 처리 완료 (${Date.now() - startTime}ms)`);
    logs.push(`✓ 사용 모델: ${ragResult.model}`);
    logs.push(`✓ 신뢰도: ${Math.round((ragResult.confidence || 0) * 100)}%`);

    // 4. 참조 문서 로깅
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

    // 5. 에스컬레이션 경고
    if (ragResult.shouldEscalate) {
      logs.push(`⚠ 에스컬레이션 권장: ${ragResult.escalationReason}`);
    }

    logs.push("━━━━━━━━━━━━━━━━━━━━━━━━━━");
    logs.push(`✓ 총 처리 시간: ${Date.now() - startTime}ms`);

    // 6. 응답 반환 (로그 포함)
    return NextResponse.json({
      suggestion: {
        original: ragResult.translatedResponse || ragResult.response,
        korean: ragResult.response,
        confidence: ragResult.confidence,
        shouldEscalate: ragResult.shouldEscalate,
        escalationReason: ragResult.escalationReason,
      },
      logs,
      sources: ragResult.sources || [],
    });
  } catch (error) {
    logs.push(`✗ 오류 발생: ${error instanceof Error ? error.message : "Unknown error"}`);
    return NextResponse.json({ error: "Failed to generate suggestion", logs }, { status: 500 });
  }
}
```

#### 2단계: 인박스 UI에 로그 표시 추가 (`/web/src/app/(dashboard)/inbox/page.tsx`)

**상태 추가** (라인 610-615):
```typescript
const [aiSuggestion, setAiSuggestion] = useState<{ original: string; korean: string } | null>(null);
const [isAiGenerating, setIsAiGenerating] = useState(false);
const [ragLogs, setRagLogs] = useState<string[]>([]);
const [ragSources, setRagSources] = useState<any[]>([]);
const [showRagLogs, setShowRagLogs] = useState(false);
```

**API 호출 시 로그 캡처** (라인 1089-1117):
```typescript
fetch(`/api/conversations/${selectedConversation.id}/ai-suggest`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
})
  .then(res => res.json())
  .then(data => {
    if (data.suggestion) {
      setAiSuggestion(data.suggestion);
    }
    if (data.logs) {
      setRagLogs(data.logs);  // 로그 저장
    }
    if (data.sources) {
      setRagSources(data.sources);  // 소스 저장
    }
  })
```

**로그 패널 UI** (라인 2195-2225):
```typescript
{/* RAG Execution Logs */}
{ragLogs.length > 0 && (
  <details
    className="mt-2 pt-2 border-t border-violet-100 dark:border-violet-900"
    open={showRagLogs}
    onToggle={(e) => setShowRagLogs((e.target as HTMLDetailsElement).open)}
  >
    <summary className="cursor-pointer text-[10px] font-medium text-violet-600 dark:text-violet-400 flex items-center gap-1 hover:text-violet-700 dark:hover:text-violet-300 transition-colors">
      🔍 RAG 실행 로그 ({ragLogs.length}개)
      {ragSources.length > 0 && (
        <span className="ml-1 text-violet-500/70">· {ragSources.length}개 문서 참조</span>
      )}
    </summary>
    <div className="mt-2 space-y-0.5 max-h-48 overflow-y-auto">
      {ragLogs.map((log, i) => (
        <div
          key={i}
          className="text-[9px] leading-relaxed font-mono text-muted-foreground/80 whitespace-pre-wrap break-all"
        >
          {log}
        </div>
      ))}
    </div>
  </details>
)}
```

**대화 전환 시 로그 초기화** (라인 1121-1126):
```typescript
useEffect(() => {
  setAiSuggestion(null);
  setIsAiGenerating(false);
  setRagLogs([]);
  setRagSources([]);
}, [selectedConversation?.id]);
```

### 수정된 파일
- `/web/src/app/api/conversations/[id]/ai-suggest/route.ts` (완전 재작성, 140줄)
- `/web/src/app/(dashboard)/inbox/page.tsx` (로그 상태 및 UI 추가, 5곳 수정)

### 검증 결과
- ✅ AI 제안 생성 시 RAG 파이프라인 실행
- ✅ 실시간 로그에 대화 조회, 메시지 로딩, RAG 실행, 참조 문서, 신뢰도, 처리 시간 표시
- ✅ 참조 문서 목록 및 관련도 점수 표시
- ✅ 에스컬레이션 권장 여부 표시
- ✅ 접히는 로그 패널로 UI 정리
- ✅ 대화 전환 시 로그 자동 초기화

### 로그 예시
```
[2026-01-29T12:34:56.789Z] AI 제안 생성 시작
✓ 대화 정보 조회 중...
✓ 대화 ID: abc-123-def
✓ 고객: 田中太郎
✓ 고객 언어: JA
✓ 최근 메시지 조회 중 (최대 10개)...
✓ 조회된 메시지: 5개
✓ 마지막 고객 메시지: "ラシック手術の費用はいくらですか？..."
━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 RAG 파이프라인 실행 중...
━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ RAG 처리 완료 (1234ms)
✓ 사용 모델: gpt-4
✓ 신뢰도: 92%
✓ 참조 문서: 3개
  1. 라식 수술 가격표 (관련도: 95%)
     → 2024년 라식 수술 양안 기준 가격: 150만원~200만원. 개인별 시력 상태에...
  2. 라식/라섹 비교 안내 (관련도: 87%)
     → 라식과 라섹의 차이점 및 적합한 환자군 안내...
  3. 수술 후 관리 가이드 (관련도: 72%)
     → 수술 후 회복 기간 및 주의사항...
━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ 총 처리 시간: 1234ms
```

---

## 결론

세 가지 심각한 프로덕션 이슈를 근본 원인부터 해결했습니다:
1. ✅ 에이전트 메시지 표시 오류 → UI 로직 수정
2. ✅ 고객 언어 자동 감지 오류 → Webhook 언어 감지 로직 수정
3. ✅ RAG 실행 로그 가시성 부족 → RAG 파이프라인 + 로그 UI 구현

모든 수정 사항은 하위 호환성을 유지하며, 기존 데이터를 자동으로 수정합니다.
