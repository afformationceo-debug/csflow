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

## 결론

두 가지 심각한 프로덕션 이슈를 근본 원인부터 해결했습니다:
1. ✅ 에이전트 메시지 표시 오류 → UI 로직 수정
2. ✅ 고객 언어 자동 감지 오류 → Webhook 언어 감지 로직 수정

모든 수정 사항은 하위 호환성을 유지하며, 기존 데이터를 자동으로 수정합니다.
