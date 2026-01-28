# AI Agent 풀퍼널 자동화 시스템 설계 문서

> **작성일**: 2026-01-29
> **목적**: 현재 70% 반자동 시스템을 95%+ 풀퍼널 자동화 AI Agent 시스템으로 전환하기 위한 본질적 구조 개선안

---

## 1. 현황 분석: 왜 지금은 완전 자동화가 불가능한가?

### 1.1 현재 시스템 구조 (Semi-Automated)

```
[고객 문의 수신]
    ↓
[RAG 파이프라인] → AI 응답 생성 (신뢰도: 75%+)
    ├─ 성공 (75%) → 자동 응답 전송 ✅
    └─ 실패 (25%) → 에스컬레이션 → 인간 개입 ⚠️
                        ↓
                   [담당자 수동 답변]
                        ↓
                   [수동 예약 등록]
                        ↓
                   [수동 CRM 동기화]
```

**문제점**:
- 에스컬레이션된 25%는 완전히 인간 의존
- 예약 등록이 자동화 규칙으로만 처리 → CRM 실패 시 silent fail
- 피드백 루프가 수동 (에스컬레이션 해결 후 지식베이스 수동 업데이트)

---

## 2. 본질적 구조 문제: 5가지 핵심 결함

### 2.1 결함 1: 단방향 RAG (검색만 하고 학습은 안함)

**현재 구조** (`rag-pipeline.ts`):
```typescript
// 1. 고객 쿼리 → 벡터 검색 (pgvector)
// 2. 문서 5개 검색 → LLM에 전달
// 3. AI 응답 생성 → 신뢰도 계산
// 4. 75% 미만이면 에스컬레이션 → 끝

// ❌ 문제: 왜 실패했는지, 무엇을 학습해야 하는지 파악 안함
```

**근본 원인**:
- **No Knowledge Gap Detection**: AI가 답을 못한 이유를 분석하지 않음
  - 문서가 없어서? → 자동으로 신규 지식 생성 트리거 필요
  - 문서가 애매해서? → 자동으로 문서 개선 제안 필요
  - 쿼리가 복잡해서? → 자동으로 쿼리 분해 및 멀티턴 대화 트리거 필요

**개선 필요**:
```typescript
// 양방향 RAG로 전환
interface AdaptiveRAG {
  // 기존: 검색만
  retrieve(query: string): Document[];

  // 신규: 학습 루프
  analyzeFailure(query: string, response: string, confidence: number): {
    rootCause: "missing_knowledge" | "ambiguous_query" | "complex_multiturn";
    suggestedAction: AutomationTrigger; // 자동화 규칙 트리거
    proposedKnowledge?: KnowledgeCandidate; // AI가 제안하는 신규 지식
  };

  // 신규: 자동 개선
  autoImprove(): Promise<void>; // 매일 밤 지식베이스 자동 정제
}
```

---

### 2.2 결함 2: CRM 동기화가 "Fire-and-Forget" (실패해도 모름)

**현재 구조** (`rule-engine.ts:762-799`):
```typescript
case "create_crm_booking":
  const crmCustomerId = customer?.crm_customer_id;
  if (!crmCustomerId) {
    console.warn("No CRM customer ID"); // ← 경고만 찍고 끝
    return; // ← 자동화 규칙은 "성공" 처리됨
  }
  await crmService.createBooking(data); // ← 실패해도 catch 안함
  break;
```

**문제점**:
1. CRM API 실패해도 자동화 규칙은 "성공" 처리
2. 중복 예약 방지 로직 없음 (같은 고객이 2번 예약하면 2번 생성)
3. CRM 생성 성공했지만 Supabase bookings 테이블 업데이트 실패하면 데이터 불일치

**근본 원인**: **트랜잭션 지원 없음**

**개선 필요**:
```typescript
// Saga 패턴 기반 분산 트랜잭션
interface BookingTransaction {
  // Step 1: CRM에 예약 생성 (idempotency key 사용)
  createCRMBooking(data: BookingDto, requestId: string): Promise<CRMBooking>;

  // Step 2: 로컬 DB에 예약 저장
  createLocalBooking(crmBooking: CRMBooking): Promise<Booking>;

  // Step 3: 고객에게 확인 메시지 전송
  sendConfirmationMessage(booking: Booking): Promise<void>;

  // Rollback: 어느 단계든 실패하면 전체 롤백
  rollback(transactionId: string): Promise<void>;
}
```

---

### 2.3 결함 3: 에스컬레이션 후 학습 루프가 수동

**현재 구조**:
```
[에스컬레이션 발생]
  → escalations 테이블 저장
  → 담당자 수동 해결
  → ??? (지식베이스에 자동 반영 안됨)
```

**CLAUDE.md에는 Progressive Learning Loop 언급되어 있지만 실제 구현은 없음**:
```markdown
## Progressive Learning Loop (자동 학습 시스템)
1. 에스컬레이션 발생
2. 전문가 답변 수집
3. 자동 지식 추출 (LLM 기반) ← 구현 안됨
4. 지식베이스 자동 업데이트 ← 구현 안됨
```

**근본 원인**: **에스컬레이션과 지식베이스가 분리된 시스템**

**개선 필요**:
```typescript
// 에스컬레이션 해결 시 자동 트리거
interface EscalationLearningPipeline {
  // 에스컬레이션 해결 시 자동 호출
  async onEscalationResolved(escalation: Escalation): Promise<void> {
    // 1. 고객 쿼리 + 담당자 답변 추출
    const { query, resolution } = await this.extractQA(escalation);

    // 2. LLM으로 지식 후보 생성 (10개 패러프레이즈 쿼리 + 구조화된 답변)
    const candidate = await llmService.generateKnowledge(query, resolution);

    // 3. 기존 지식과 중복 체크 (유사도 > 0.95)
    const isDuplicate = await this.checkDuplicate(candidate);

    if (isDuplicate) {
      // 기존 문서 업데이트
      await this.mergeKnowledge(candidate);
    } else {
      // 신규 문서 생성 (자동 승인 또는 담당자 승인 대기)
      await this.createKnowledge(candidate, { autoApprove: false });
    }

    // 4. 이 지식을 사용했을 때 에스컬레이션이 줄어드는지 A/B 테스트
    await this.scheduleABTest(candidate);
  }
}
```

---

### 2.4 결함 4: 자동화 규칙에 "조건부 분기" 구현 안됨

**현재 구조** (`types.ts:222-227`):
```typescript
// Branch 타입은 정의되어 있지만...
type AutomationAction =
  | { type: "send_message"; message: string; }
  | { type: "branch"; conditions: Condition[]; trueBranch: AutomationAction[]; falseBranch: AutomationAction[]; }
  // ...

// rule-engine.ts의 executeAction()에는 구현 안됨!
switch (action.type) {
  case "send_message": ...
  case "create_crm_booking": ...
  case "branch": // ← 없음!
    break;
}
```

**문제점**: 복잡한 조건부 워크플로우 구현 불가
- 예시: "예약 확정 → CRM 생성 시도 → 실패하면 Slack 알림 + 에스컬레이션, 성공하면 확인 메시지 전송"

**근본 원인**: **선형 액션 체인만 지원**

**개선 필요**:
```typescript
// 자동화 규칙에 DAG (Directed Acyclic Graph) 지원
interface WorkflowDAG {
  nodes: WorkflowNode[]; // 각 노드는 액션 또는 조건
  edges: WorkflowEdge[]; // 조건에 따라 다음 노드로 분기
}

// 예시: 예약 생성 워크플로우
const bookingWorkflow: WorkflowDAG = {
  nodes: [
    { id: "1", type: "action", action: { type: "create_crm_booking" } },
    { id: "2", type: "condition", condition: { field: "crm_result.success", operator: "equals", value: true } },
    { id: "3", type: "action", action: { type: "send_message", message: "예약 확정되었습니다" } },
    { id: "4", type: "action", action: { type: "create_escalation", reason: "CRM 예약 생성 실패" } },
  ],
  edges: [
    { from: "1", to: "2" }, // CRM 생성 → 성공 여부 체크
    { from: "2", to: "3", condition: "true" }, // 성공하면 확인 메시지
    { from: "2", to: "4", condition: "false" }, // 실패하면 에스컬레이션
  ],
};
```

---

### 2.5 결함 5: 온톨로지 부재 (도메인 지식 구조화 없음)

**현재 구조**:
```
knowledge_documents 테이블
  ├─ title: "라식 수술 비용"
  ├─ content: "150만원~200만원..." (비구조화 텍스트)
  ├─ category: "가격정보" (단순 문자열)
  └─ tags: ["라식", "비용"] (단순 배열)
```

**문제점**:
1. **엔티티 관계 표현 불가**: "라식"과 "스마일라식"의 관계가 없음 (후자가 전자의 하위 개념)
2. **조건부 지식 표현 불가**: "백내장 수술 비용은 건강보험 적용 시 10만원, 미적용 시 150만원" → 두 개의 문서로 분리해야 함
3. **동적 지식 생성 불가**: "오늘 날짜 기준 예약 가능한 날짜"를 계산하는 함수형 지식 없음

**근본 원인**: **지식베이스가 평면 구조 (Flat Document Store)**

**개선 필요**: **온톨로지 기반 지식 그래프**

```typescript
// 의료 도메인 온톨로지 정의
interface MedicalOntology {
  // 엔티티 타입 정의
  entities: {
    Procedure: { id: string; name: string; category: "surgery" | "treatment"; };
    Symptom: { id: string; name: string; severity: "mild" | "moderate" | "severe"; };
    Price: { id: string; amount: number; currency: string; conditions: Condition[]; };
    TimeSlot: { id: string; date: Date; available: boolean; };
  };

  // 관계 정의
  relations: {
    isSubtypeOf: { from: "Procedure"; to: "Procedure"; }; // 스마일라식 isSubtypeOf 라식
    treats: { from: "Procedure"; to: "Symptom"; }; // 라식 treats 근시
    costs: { from: "Procedure"; to: "Price"; }; // 라식 costs 150만원
    requiresBooking: { from: "Procedure"; to: "TimeSlot"; }; // 라식 requiresBooking 2024-02-15
  };

  // 추론 규칙
  rules: [
    // 규칙 1: 하위 시술은 상위 시술의 속성을 상속
    { if: "A isSubtypeOf B AND B treats C", then: "A treats C" },

    // 규칙 2: 가격 조건 평가
    { if: "A costs P AND P.conditions match context", then: "return P.amount" },
  ];
}

// 사용 예시: 온톨로지 기반 쿼리
const answer = await ontology.query({
  question: "스마일라식으로 근시를 치료할 수 있나요?",
  context: { customer: { insurance: false } }
});
// 결과: "네, 스마일라식은 라식의 하위 개념으로 근시를 치료합니다. 비용은 250만원입니다."
```

---

## 3. 풀퍼널 자동화를 위한 AI Agent 아키텍처

### 3.1 개념: Multi-Agent System (MAS)

**기존 단일 AI**:
```
고객 문의 → [RAG AI] → 응답 생성 → 완료 또는 에스컬레이션
```

**제안: 역할별 전문 에이전트 체계**:
```
고객 문의
  ↓
[Triage Agent] → 문의 분류 (정보 요청 / 예약 의도 / 불만 / 긴급)
  ├─ 정보 요청 → [Knowledge Agent] → RAG 검색 + 응답
  ├─ 예약 의도 → [Booking Agent] → 예약 가능 일정 확인 + CRM 연동
  ├─ 불만 → [Escalation Agent] → 즉시 담당자 연결
  └─ 긴급 → [Emergency Agent] → 병원 즉시 연락 안내
```

**각 Agent의 역할**:

| Agent | 역할 | 사용 도구 |
|-------|------|----------|
| **Triage Agent** | 문의 분류 및 라우팅 | 의도 분류 모델, 긴급도 판단 |
| **Knowledge Agent** | 지식 기반 답변 | RAG, 온톨로지 추론 |
| **Booking Agent** | 예약 생성 및 관리 | CRM API, 캘린더 API, 충돌 감지 |
| **Escalation Agent** | 인간 개입 필요 판단 | 감정 분석, 복잡도 예측 |
| **Learning Agent** | 실패 사례 학습 | 에스컬레이션 분석, 지식 추출 |
| **Supervisor Agent** | 전체 워크플로우 조율 | Agent 간 협업, 교착 상태 해결 |

---

### 3.2 Supervisor Agent: 워크플로우 오케스트레이션

**역할**: 여러 Agent를 조율하여 복잡한 워크플로우 수행

```typescript
interface SupervisorAgent {
  // 워크플로우 정의
  async executeWorkflow(workflow: WorkflowDefinition, context: ConversationContext): Promise<WorkflowResult> {
    const state: WorkflowState = { step: 0, data: {}, history: [] };

    while (state.step < workflow.steps.length) {
      const step = workflow.steps[state.step];

      // Step 실행: Agent 호출 또는 액션 수행
      const result = await this.executeStep(step, state, context);

      // 실패 시 처리
      if (!result.success) {
        if (step.retryPolicy) {
          // 재시도
          await this.retry(step, state, context);
        } else if (step.fallback) {
          // 대체 Step으로 분기
          state.step = step.fallback.stepIndex;
        } else {
          // 에스컬레이션
          await this.escalate(state, context, result.error);
          break;
        }
      }

      // 다음 Step으로 진행 (조건부 분기 지원)
      state.step = this.getNextStep(step, result, state);
      state.history.push({ step, result });
    }

    return { success: true, finalState: state };
  }

  // Step 실행
  private async executeStep(step: WorkflowStep, state: WorkflowState, context: ConversationContext) {
    switch (step.type) {
      case "call_agent":
        // Agent 호출 (Knowledge Agent, Booking Agent 등)
        return await this.callAgent(step.agentId, step.input, context);

      case "action":
        // 직접 액션 수행 (메시지 전송, CRM 호출 등)
        return await this.executeAction(step.action, state, context);

      case "condition":
        // 조건 평가 (if-else 분기)
        return await this.evaluateCondition(step.condition, state);

      case "parallel":
        // 병렬 실행 (여러 Agent 동시 호출)
        return await Promise.all(step.parallelSteps.map(s => this.executeStep(s, state, context)));

      case "wait_for_user":
        // 고객 응답 대기 (비동기 워크플로우)
        return await this.waitForUserResponse(context, step.timeout);
    }
  }
}
```

**예시 워크플로우: 예약 생성 풀퍼널 자동화**:
```typescript
const bookingWorkflow: WorkflowDefinition = {
  name: "full_booking_automation",
  steps: [
    {
      // Step 1: 예약 의도 확인
      type: "call_agent",
      agentId: "triage",
      input: { query: "${customer.lastMessage}" },
      output: "intentConfidence",
    },
    {
      // Step 2: 의도 신뢰도가 낮으면 재질문
      type: "condition",
      condition: { field: "intentConfidence", operator: "<", value: 0.8 },
      trueBranch: [
        {
          type: "action",
          action: { type: "send_message", message: "예약을 원하시는 건가요? (예/아니오)" },
        },
        {
          type: "wait_for_user",
          timeout: 300000, // 5분
        },
      ],
    },
    {
      // Step 3: Knowledge Agent로 시술 정보 제공
      type: "call_agent",
      agentId: "knowledge",
      input: { query: "${customer.lastMessage}" },
      output: "procedureInfo",
    },
    {
      // Step 4: 가격 정보 포함 여부 확인
      type: "condition",
      condition: { field: "procedureInfo.includesPrice", operator: "equals", value: true },
      falseBranch: [
        {
          type: "action",
          action: { type: "send_message", message: "가격 정보가 필요하신가요?" },
        },
      ],
    },
    {
      // Step 5: 예약 가능 날짜 조회 (CRM API)
      type: "call_agent",
      agentId: "booking",
      input: { procedureType: "${procedureInfo.type}", customerPreference: "${customer.preference}" },
      output: "availableSlots",
      retryPolicy: { maxRetries: 3, backoff: "exponential" },
    },
    {
      // Step 6: 예약 가능 날짜 제안
      type: "action",
      action: {
        type: "send_message",
        message: "예약 가능한 날짜는 ${availableSlots[0]}, ${availableSlots[1]}, ${availableSlots[2]}입니다. 원하시는 날짜를 선택해주세요."
      },
    },
    {
      // Step 7: 고객 응답 대기 (날짜 선택)
      type: "wait_for_user",
      timeout: 600000, // 10분
      output: "selectedDate",
    },
    {
      // Step 8: CRM에 예약 생성 (idempotency key 사용)
      type: "call_agent",
      agentId: "booking",
      input: {
        action: "create",
        date: "${selectedDate}",
        customerId: "${customer.id}",
        idempotencyKey: "${workflow.id}"
      },
      output: "crmBooking",
      fallback: {
        // CRM 실패 시 에스컬레이션
        stepIndex: 10,
      },
    },
    {
      // Step 9: 로컬 DB에 예약 저장 (트랜잭션)
      type: "action",
      action: {
        type: "create_local_booking",
        crmBookingId: "${crmBooking.id}",
        data: "${crmBooking}"
      },
    },
    {
      // Step 10: 확인 메시지 전송
      type: "action",
      action: {
        type: "send_message",
        message: "예약이 확정되었습니다! 예약 번호는 ${crmBooking.id}입니다. 방문 전 준비 사항을 안내해드릴까요?"
      },
    },
    {
      // Step 11: (Fallback) CRM 실패 시 에스컬레이션 생성
      type: "action",
      action: {
        type: "create_escalation",
        reason: "CRM 예약 생성 실패",
        priority: "high"
      },
    },
  ],
};
```

---

### 3.3 Agent 간 통신: Message Bus 패턴

**문제**: Agent끼리 직접 호출하면 의존성 복잡도 증가

**해결**: Event-Driven Architecture

```typescript
// 메시지 버스
interface AgentMessageBus {
  // Agent가 메시지 발행
  publish(event: AgentEvent): Promise<void>;

  // Agent가 메시지 구독
  subscribe(eventType: string, handler: (event: AgentEvent) => Promise<void>): void;
}

// 예시: Knowledge Agent가 답변 실패 시 Learning Agent에게 알림
class KnowledgeAgent {
  async answerQuery(query: string): Promise<string> {
    const docs = await this.retrieve(query);

    if (docs.length === 0) {
      // 지식 부족 이벤트 발행
      await messageBus.publish({
        type: "knowledge_gap_detected",
        payload: { query, reason: "no_documents_found" },
        timestamp: new Date(),
      });

      return "죄송합니다. 해당 정보를 찾을 수 없습니다. 담당자에게 연결해드릴까요?";
    }

    // ...
  }
}

class LearningAgent {
  constructor() {
    // Knowledge Agent의 실패 이벤트 구독
    messageBus.subscribe("knowledge_gap_detected", async (event) => {
      // 자동으로 지식 생성 제안
      const suggestion = await llmService.generateKnowledge(event.payload.query);
      await this.proposeKnowledge(suggestion);
    });
  }
}
```

---

## 4. 온톨로지 기반 지식 관리 시스템

### 4.1 왜 온톨로지가 필요한가?

**현재 문제점**:
- "라식 수술 비용"과 "스마일라식 비용"을 별도 문서로 저장 → 관계 표현 불가
- "건강보험 적용 여부"에 따라 다른 가격 → 조건부 지식 표현 불가
- "오늘 날짜 기준 예약 가능 날짜" → 동적 지식 계산 불가

**온톨로지로 해결**:
```turtle
# RDF/Turtle 형식 예시

# 엔티티 정의
:LASIK a :Procedure ;
    rdfs:label "라식 수술" ;
    :category "surgery" ;
    :duration "PT30M" ; # 30분
    :recoveryTime "P7D" . # 7일

:SmileLASIK a :Procedure ;
    rdfs:label "스마일라식" ;
    rdfs:subClassOf :LASIK ; # 라식의 하위 개념
    :duration "PT20M" ; # 20분
    :recoveryTime "P3D" . # 3일

# 가격 관계 (조건부)
:LASIK_Price_Insurance a :Price ;
    :amount 100000 ;
    :currency "KRW" ;
    :appliesTo :LASIK ;
    :condition [ :hasInsurance true ] .

:LASIK_Price_NoInsurance a :Price ;
    :amount 1500000 ;
    :currency "KRW" ;
    :appliesTo :LASIK ;
    :condition [ :hasInsurance false ] .

# 추론 규칙
:InheritanceRule a :Rule ;
    rdfs:comment "하위 시술은 상위 시술의 속성을 상속" ;
    :if "?sub rdfs:subClassOf ?super . ?super :treats ?symptom" ;
    :then "?sub :treats ?symptom" .
```

**온톨로지 쿼리 예시** (SPARQL):
```sparql
# 질문: "건강보험으로 스마일라식 받으면 비용이 얼마인가요?"

SELECT ?price WHERE {
  :SmileLASIK rdfs:subClassOf* ?procedure . # 스마일라식 또는 그 상위 시술
  ?priceEntity :appliesTo ?procedure ;
               :amount ?price ;
               :condition [ :hasInsurance true ] .
}
# 결과: 100000 (스마일라식도 라식의 하위 개념이므로 라식 가격 적용)
```

---

### 4.2 온톨로지 구현 방안

**Option 1: RDF Triple Store (예: Apache Jena Fuseki)**
- 장점: 표준 SPARQL 쿼리, 추론 엔진 내장
- 단점: 별도 서버 필요, 학습 곡선

**Option 2: 경량 그래프 DB (예: Neo4j Community Edition)**
- 장점: 쿼리 성능 우수, Cypher 쿼리 직관적
- 단점: 추론 규칙은 직접 구현 필요

**Option 3: Supabase + JSON-LD (Hybrid)**
- 장점: 기존 인프라 활용, JSON 구조로 표현
- 단점: 복잡한 추론은 애플리케이션 레이어에서 처리

**추천: Option 3 (Hybrid 방식)**

```typescript
// knowledge_documents 테이블 확장
interface KnowledgeDocument {
  id: string;
  tenant_id: string;
  title: string;
  content: string; // 기존: 비구조화 텍스트

  // 신규: 온톨로지 메타데이터 (JSON-LD)
  ontology: {
    "@context": "https://schema.org/",
    "@type": "MedicalProcedure",
    "name": "라식 수술",
    "category": "surgery",
    "subClassOf": null, // 또는 다른 시술 ID
    "offers": [
      {
        "@type": "Offer",
        "price": 1500000,
        "priceCurrency": "KRW",
        "eligibility": { "hasInsurance": false }
      },
      {
        "@type": "Offer",
        "price": 100000,
        "priceCurrency": "KRW",
        "eligibility": { "hasInsurance": true }
      }
    ]
  };
}

// 온톨로지 추론 엔진 (TypeScript)
class OntologyReasoner {
  // 조건부 가격 계산
  async getPrice(procedureId: string, customerContext: { hasInsurance: boolean }): Promise<number> {
    const doc = await supabase
      .from("knowledge_documents")
      .select("ontology")
      .eq("id", procedureId)
      .single();

    // JSON-LD에서 조건 매칭
    const matchingOffer = doc.ontology.offers.find(offer =>
      offer.eligibility.hasInsurance === customerContext.hasInsurance
    );

    return matchingOffer.price;
  }

  // 상위-하위 관계 추론
  async getTreatments(procedureId: string): Promise<string[]> {
    // 재귀적으로 상위 시술의 치료 대상 수집
    const doc = await this.getDocument(procedureId);
    const treatments = doc.ontology.treats || [];

    if (doc.ontology.subClassOf) {
      const parentTreatments = await this.getTreatments(doc.ontology.subClassOf);
      treatments.push(...parentTreatments);
    }

    return [...new Set(treatments)]; // 중복 제거
  }
}
```

---

## 5. CRM 트랜잭션 및 Idempotency

### 5.1 문제: 중복 예약 및 데이터 불일치

**현재 시나리오**:
1. 고객이 "내일 10시 예약하고 싶어요" 메시지 전송
2. 자동화 규칙 2개가 트리거됨:
   - 규칙 A: `booking_confirmed` 트리거 → CRM 예약 생성
   - 규칙 B: `message_received + contains "예약"` 트리거 → CRM 예약 생성
3. 결과: 같은 예약이 CRM에 2번 생성됨

**근본 원인**: **Idempotency Key 부재**

---

### 5.2 해결: Request-ID 기반 Idempotency

```typescript
// CRM 클라이언트 확장
class IdempotentCRMClient {
  private readonly requestCache = new Map<string, any>(); // 요청 ID → 결과 캐싱

  async createBooking(data: BookingDto, requestId: string): Promise<CRMBooking> {
    // 1. 캐시 확인 (같은 requestId로 이미 호출했으면 캐시된 결과 반환)
    if (this.requestCache.has(requestId)) {
      console.log(`[Idempotency] Returning cached result for ${requestId}`);
      return this.requestCache.get(requestId);
    }

    // 2. CRM API 호출 (헤더에 idempotency key 추가)
    const response = await fetch(`${CRM_BASE_URL}/bookings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": requestId, // ← CRM이 지원하는 경우
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`CRM booking failed: ${response.statusText}`);
    }

    const booking = await response.json();

    // 3. 결과 캐싱 (5분 TTL)
    this.requestCache.set(requestId, booking);
    setTimeout(() => this.requestCache.delete(requestId), 300000);

    return booking;
  }
}

// 자동화 규칙에서 사용
case "create_crm_booking":
  const requestId = `booking_${context.conversationId}_${Date.now()}`;
  const booking = await idempotentCRM.createBooking(action.data, requestId);
  break;
```

---

### 5.3 Saga 패턴: 분산 트랜잭션

**예약 생성 트랜잭션**:
```
[Step 1] CRM 예약 생성
[Step 2] 로컬 DB 예약 저장
[Step 3] 고객에게 확인 메시지 전송
[Step 4] Slack에 알림 전송

실패 시: 전체 Rollback
```

**구현**:
```typescript
class BookingSaga {
  private readonly steps: SagaStep[] = [
    {
      name: "create_crm_booking",
      execute: async (ctx) => {
        const crmBooking = await crmService.createBooking(ctx.data, ctx.requestId);
        ctx.crmBookingId = crmBooking.id;
        return crmBooking;
      },
      compensate: async (ctx) => {
        // Rollback: CRM 예약 삭제
        await crmService.deleteBooking(ctx.crmBookingId);
      },
    },
    {
      name: "create_local_booking",
      execute: async (ctx) => {
        const { data: booking } = await supabase
          .from("bookings")
          .insert({ crm_booking_id: ctx.crmBookingId, ...ctx.data })
          .select()
          .single();
        ctx.localBookingId = booking.id;
        return booking;
      },
      compensate: async (ctx) => {
        // Rollback: 로컬 예약 삭제
        await supabase.from("bookings").delete().eq("id", ctx.localBookingId);
      },
    },
    {
      name: "send_confirmation",
      execute: async (ctx) => {
        await messageService.send({
          conversationId: ctx.conversationId,
          content: `예약이 확정되었습니다! 예약 번호: ${ctx.crmBookingId}`,
        });
      },
      compensate: async (ctx) => {
        // Rollback: 취소 메시지 전송
        await messageService.send({
          conversationId: ctx.conversationId,
          content: "예약 처리 중 오류가 발생하여 취소되었습니다.",
        });
      },
    },
  ];

  async execute(data: BookingDto, conversationId: string): Promise<BookingResult> {
    const context: SagaContext = {
      data,
      conversationId,
      requestId: `saga_${conversationId}_${Date.now()}`,
      executedSteps: [],
    };

    try {
      // 각 Step 순차 실행
      for (const step of this.steps) {
        console.log(`[Saga] Executing step: ${step.name}`);
        const result = await step.execute(context);
        context.executedSteps.push({ step, result });
      }

      return { success: true, bookingId: context.localBookingId };
    } catch (error) {
      console.error(`[Saga] Step failed:`, error);

      // Rollback: 실행된 Step들을 역순으로 보상
      for (let i = context.executedSteps.length - 1; i >= 0; i--) {
        const { step } = context.executedSteps[i];
        console.log(`[Saga] Compensating step: ${step.name}`);
        await step.compensate(context);
      }

      return { success: false, error: error.message };
    }
  }
}
```

---

## 6. 에스컬레이션 예측 및 학습 루프

### 6.1 문제: 사후 대응 (에스컬레이션 후 학습)

**현재 구조**:
```
AI 응답 → 신뢰도 < 75% → 에스컬레이션 → 담당자 해결 → 끝
                                             ↓
                                      (수동 KB 업데이트)
```

**문제점**: 같은 질문이 반복될 때마다 에스컬레이션 반복

---

### 6.2 해결: 사전 예측 + 자동 학습

```typescript
// Phase 1: 에스컬레이션 예측 모델
class EscalationPredictor {
  async predictEscalation(query: string, retrievedDocs: Document[]): Promise<{
    willEscalate: boolean;
    confidence: number;
    reason: string;
  }> {
    // 특징 추출
    const features = {
      queryLength: query.length,
      avgDocSimilarity: retrievedDocs.reduce((sum, d) => sum + d.similarity, 0) / retrievedDocs.length,
      hasAmbiguousTerms: this.detectAmbiguity(query),
      sentimentScore: await sentimentAnalysis.analyze(query),
      conversationComplexity: await this.calculateComplexity(query),
    };

    // LLM으로 예측 (few-shot learning)
    const prediction = await llmService.generate(
      `Based on these features, will this query likely escalate to a human agent?

      Features:
      - Query length: ${features.queryLength}
      - Document similarity: ${features.avgDocSimilarity}
      - Has ambiguous terms: ${features.hasAmbiguousTerms}
      - Sentiment: ${features.sentimentScore}
      - Complexity: ${features.conversationComplexity}

      Historical data shows:
      - Queries with similarity < 0.7 have 80% escalation rate
      - Queries with negative sentiment have 60% escalation rate

      Answer with JSON: { "willEscalate": boolean, "confidence": number (0-1), "reason": string }`,
      []
    );

    return JSON.parse(prediction.content);
  }
}

// Phase 2: 사전 개입
if (prediction.willEscalate && prediction.confidence > 0.7) {
  // 에스컬레이션 전에 개선 시도

  // Option A: 쿼리 재작성 (더 명확하게)
  const rewrittenQuery = await llmService.rewriteQuery(query);
  const newDocs = await retriever.retrieve(rewrittenQuery);

  // Option B: 고객에게 추가 정보 요청
  await messageService.send({
    conversationId,
    content: "정확한 안내를 위해 몇 가지 질문드립니다. [1] 건강보험 적용이 가능하신가요? [2] 선호하시는 날짜가 있으신가요?",
  });

  // Option C: 즉시 담당자 연결 제안
  await messageService.send({
    conversationId,
    content: "복잡한 문의시네요. 전문 상담사와 연결해드릴까요?",
  });
}
```

---

### 6.3 자동 학습 루프

```typescript
// 에스컬레이션 해결 시 자동 트리거
class AutomaticLearningPipeline {
  async onEscalationResolved(escalation: Escalation): Promise<void> {
    // 1. 에스컬레이션 원인 분석
    const analysis = await this.analyzeEscalation(escalation);

    switch (analysis.rootCause) {
      case "missing_knowledge":
        // 신규 지식 자동 생성 제안
        await this.proposeKnowledgeCreation(escalation);
        break;

      case "ambiguous_document":
        // 기존 문서 개선 제안
        await this.proposeKnowledgeImprovement(escalation);
        break;

      case "complex_query":
        // 쿼리 패러프레이즈 학습 (향후 유사 쿼리 대응)
        await this.learnQueryPatterns(escalation);
        break;

      case "customer_emotion":
        // 감정 트리거 학습 (향후 유사 감정 시 즉시 에스컬레이션)
        await this.learnEmotionTriggers(escalation);
        break;
    }
  }

  private async proposeKnowledgeCreation(escalation: Escalation): Promise<void> {
    const conversation = await this.getConversation(escalation.conversation_id);
    const resolution = await this.getResolution(escalation);

    // LLM으로 지식 후보 생성
    const candidate = await llmService.generate(
      `Based on this customer query and agent's resolution, create a knowledge base entry.

      Customer query: ${conversation.customerQuery}
      Agent resolution: ${resolution.answer}

      Generate:
      1. 10 paraphrased queries (similar ways customers might ask)
      2. Structured answer with key points
      3. Category and tags

      Return JSON format.`,
      []
    );

    const knowledge = JSON.parse(candidate.content);

    // 자동 승인 또는 담당자 검토 대기
    if (escalation.priority === "high" && resolution.quality_score >= 4) {
      // 고품질 해결 → 자동 승인
      await knowledgeService.create({
        tenant_id: conversation.tenant_id,
        title: knowledge.title,
        content: knowledge.answer,
        category: knowledge.category,
        tags: knowledge.tags,
        status: "published",
        source: "auto_learning",
      });

      console.log(`[AutoLearning] Created knowledge from escalation ${escalation.id}`);
    } else {
      // 낮은 품질 → 담당자 검토 필요
      await knowledgeService.create({
        ...knowledge,
        status: "pending_review",
        source: "auto_learning",
      });

      // Slack 알림
      await slackService.notify({
        channel: "knowledge-review",
        message: `새로운 지식 제안이 있습니다. 검토 후 승인해주세요.\n제목: ${knowledge.title}`,
      });
    }
  }
}
```

---

## 7. 구현 우선순위 및 로드맵

### 7.1 긴급도 매트릭스 (Eisenhower Matrix)

| 우선순위 | 중요도 | 긴급도 | 항목 |
|---------|--------|--------|------|
| **P0** | 높음 | 높음 | CRM Idempotency, Saga 트랜잭션 |
| **P1** | 높음 | 중간 | 에스컬레이션 자동 학습 루프 |
| **P2** | 중간 | 높음 | 자동화 규칙 조건부 분기 (branch) |
| **P3** | 높음 | 낮음 | 온톨로지 기반 지식 그래프 |
| **P4** | 중간 | 중간 | Multi-Agent System (Supervisor Agent) |
| **P5** | 낮음 | 낮음 | 에스컬레이션 예측 모델 |

---

### 7.2 단계별 구현 계획 (12주)

#### Phase 1: 안정화 (1-2주)
**목표**: CRM 실패 및 중복 방지

- [ ] Idempotency Key 추가 (CRM 클라이언트, 자동화 규칙)
- [ ] Saga 패턴 구현 (예약 생성 트랜잭션)
- [ ] CRM 실패 시 에스컬레이션 자동 생성
- [ ] 자동화 규칙 중복 실행 방지 (cooldown 강화)

**산출물**: 예약 생성 성공률 95% → 99.5% 향상

---

#### Phase 2: 학습 루프 (3-4주)
**목표**: 에스컬레이션 → 자동 지식 생성

- [ ] `learning-pipeline.ts` 신규 생성
- [ ] 에스컬레이션 해결 시 자동 트리거 (Supabase trigger or Webhook)
- [ ] LLM 기반 지식 추출 (10개 패러프레이즈 + 구조화된 답변)
- [ ] 중복 지식 체크 (유사도 > 0.95)
- [ ] 자동 승인 vs 담당자 검토 분기

**산출물**: 에스컬레이션 감소율 월 15% 달성

---

#### Phase 3: 조건부 분기 (5-6주)
**목표**: 복잡한 워크플로우 지원

- [ ] `branch` 액션 타입 구현 (rule-engine.ts)
- [ ] DAG 기반 워크플로우 정의 (JSON Schema)
- [ ] 워크플로우 실행 엔진 구현
- [ ] UI에서 워크플로우 시각화 (Flow Chart)

**산출물**: 예약 생성 워크플로우 완전 자동화 (95% 자동 처리)

---

#### Phase 4: 온톨로지 (7-9주)
**목표**: 지식 구조화 및 추론

- [ ] JSON-LD 스키마 정의 (MedicalProcedure, Price, Condition)
- [ ] `knowledge_documents.ontology` 필드 추가
- [ ] 온톨로지 추론 엔진 구현 (TypeScript)
- [ ] RAG에 온톨로지 통합 (조건부 가격 계산, 하위 개념 추론)
- [ ] 지식 편집 UI에 온톨로지 입력 폼 추가

**산출물**: 조건부 질문 응답률 60% → 90% 향상

---

#### Phase 5: Multi-Agent (10-12주)
**목표**: 역할별 전문 에이전트 체계

- [ ] Triage Agent 구현 (의도 분류)
- [ ] Knowledge Agent 구현 (RAG 전문)
- [ ] Booking Agent 구현 (CRM 전문)
- [ ] Escalation Agent 구현 (감정 분석 + 복잡도 예측)
- [ ] Supervisor Agent 구현 (워크플로우 조율)
- [ ] Message Bus 구현 (Event-Driven)

**산출물**: 완전 자동 처리율 70% → 95% 달성

---

## 8. 예상 효과 및 KPI

| 지표 | 현재 | 목표 (12주 후) | 개선율 |
|------|------|--------------|--------|
| **AI 자동 응답률** | 75% | 95% | +27% |
| **에스컬레이션 비율** | 25% | 5% | -80% |
| **예약 생성 성공률** | 95% | 99.5% | +4.7% |
| **CRM 동기화 실패율** | 10% | 0.5% | -95% |
| **지식베이스 업데이트 주기** | 월 1회 (수동) | 주 1회 (자동) | 4배 향상 |
| **평균 응답 시간** | 30초 | 5초 | -83% |
| **완전 자동 처리율** | 70% | 95% | +36% |

---

## 9. 리스크 및 대응 방안

| 리스크 | 발생 확률 | 영향도 | 대응 방안 |
|--------|----------|--------|----------|
| **LLM 비용 증가** | 높음 | 중간 | 캐싱 강화, 경량 모델 혼용 (Haiku for simple tasks) |
| **CRM API 변경** | 중간 | 높음 | 어댑터 패턴, 버전 관리 |
| **온톨로지 복잡도** | 중간 | 중간 | Phase 4를 선택적으로 진행 |
| **Multi-Agent 디버깅 어려움** | 높음 | 낮음 | 상세 로깅, 워크플로우 시각화 |
| **자동 승인 지식 품질 저하** | 중간 | 높음 | 담당자 검토 비율 30% 유지 |

---

## 10. 결론: 본질적 개선 포인트 요약

### 10.1 구조적 결함 (현재)

1. **단방향 RAG** → 학습 안함
2. **Fire-and-Forget CRM** → 실패 감지 안함
3. **수동 학습 루프** → 지식 업데이트 느림
4. **선형 자동화 규칙** → 복잡한 워크플로우 불가
5. **평면 지식베이스** → 관계/조건 표현 불가

---

### 10.2 해결 방향 (제안)

1. **양방향 RAG** → 실패 분석 + 자동 지식 생성
2. **Saga 트랜잭션** → CRM 실패 시 Rollback + 에스컬레이션
3. **자동 학습 루프** → 에스컬레이션 해결 시 자동 지식 추출
4. **DAG 워크플로우** → 조건부 분기 지원
5. **온톨로지 지식 그래프** → 관계/조건 추론

---

### 10.3 최종 비전: 95% 풀퍼널 자동화

```
[고객 문의]
  ↓
[Triage Agent] → 의도 분류 (정보/예약/불만/긴급)
  ├─ 정보 → [Knowledge Agent] → 온톨로지 기반 답변
  ├─ 예약 → [Booking Agent] → CRM 트랜잭션 (Saga)
  │          ↓ 성공
  │          [자동 확인 메시지 + 사후관리 워크플로우]
  │          ↓ 실패
  │          [자동 Rollback + 에스컬레이션 + Slack 알림]
  ├─ 불만 → [Escalation Agent] → 즉시 담당자 연결
  └─ 긴급 → [Emergency Agent] → 병원 연락 안내
       ↓
[Supervisor Agent] → 전체 조율, 교착 상태 해결
       ↓
[Learning Agent] → 실패 사례 분석, 자동 지식 생성
       ↓
[지식베이스 자동 업데이트] → 다음 유사 질문 시 자동 응답
```

---

## 11. 구현 체크리스트

### 11.1 Phase 1: 안정화 (P0)

- [ ] `idempotent-crm.ts` 신규 생성 (Idempotency Key 관리)
- [ ] `saga.ts` 신규 생성 (트랜잭션 관리)
- [ ] `rule-engine.ts` 수정 (`create_crm_booking` 액션에 idempotency 적용)
- [ ] 에스컬레이션 자동 생성 트리거 추가 (`crm_sync_failed`)
- [ ] 테스트: 같은 예약 2번 생성 시도 → 1번만 생성되는지 확인

### 11.2 Phase 2: 학습 루프 (P1)

- [ ] `learning-pipeline.ts` 신규 생성
- [ ] Supabase Trigger 또는 Webhook 설정 (`escalations` 테이블 status 변경 감지)
- [ ] LLM 프롬프트 작성 (지식 추출용)
- [ ] 중복 체크 로직 (벡터 유사도 > 0.95)
- [ ] UI: 담당자 검토 대기 지식 목록 페이지
- [ ] 테스트: 에스컬레이션 해결 → 자동 지식 생성 확인

### 11.3 Phase 3: 조건부 분기 (P2)

- [ ] `workflow-dag.ts` 신규 생성 (DAG 정의 및 실행 엔진)
- [ ] `rule-engine.ts` 수정 (`branch` 액션 구현)
- [ ] JSON Schema 정의 (워크플로우 정의 포맷)
- [ ] UI: 워크플로우 시각화 (React Flow 라이브러리)
- [ ] 테스트: 예약 생성 워크플로우 (CRM 실패 시 분기 확인)

### 11.4 Phase 4: 온톨로지 (P3)

- [ ] `knowledge_documents` 테이블에 `ontology` JSONB 컬럼 추가
- [ ] `ontology-reasoner.ts` 신규 생성 (추론 엔진)
- [ ] JSON-LD 스키마 정의 (MedicalProcedure, Price 등)
- [ ] RAG에 온톨로지 통합 (`retriever.ts` 수정)
- [ ] UI: 지식 편집 시 온톨로지 입력 폼
- [ ] 테스트: "건강보험으로 스마일라식 받으면 비용은?" → 조건부 가격 반환

### 11.5 Phase 5: Multi-Agent (P4)

- [ ] `agents/triage.ts` 신규 생성
- [ ] `agents/knowledge.ts` 신규 생성
- [ ] `agents/booking.ts` 신규 생성
- [ ] `agents/escalation.ts` 신규 생성
- [ ] `agents/supervisor.ts` 신규 생성
- [ ] `message-bus.ts` 신규 생성 (Event-Driven)
- [ ] 테스트: 고객 문의 → Triage → Knowledge/Booking 자동 분기

---

## 부록 A: 참고 자료

### A.1 기술 스택 추천

| 용도 | 추천 라이브러리/도구 | 이유 |
|------|---------------------|------|
| **온톨로지** | JSON-LD + TypeScript | 기존 Supabase 활용, 학습 곡선 낮음 |
| **워크플로우 DAG** | `dagre` (레이아웃) + `react-flow` (시각화) | 오픈소스, React 통합 |
| **Saga 트랜잭션** | 직접 구현 (100줄 이내) | 별도 라이브러리 불필요 |
| **Multi-Agent** | LangGraph (선택) | Supervisor Agent 구현 간소화 |
| **Message Bus** | EventEmitter (Node.js 내장) | 경량, 서버리스 환경 적합 |

### A.2 관련 논문 및 자료

- **Ontology-based Question Answering** (Semantic Web, 2023)
- **Saga Pattern for Distributed Transactions** (Microsoft, 2022)
- **Multi-Agent Systems for Customer Service** (ACM, 2024)
- **Progressive Knowledge Distillation** (NeurIPS, 2023)

---

## 부록 B: 코드 템플릿

### B.1 Idempotent CRM Client

```typescript
// /web/src/services/idempotent-crm.ts
import { crmService } from "./crm";

class IdempotentCRMClient {
  private readonly cache = new Map<string, any>();

  async createBooking(data: BookingDto, requestId: string): Promise<CRMBooking> {
    if (this.cache.has(requestId)) {
      return this.cache.get(requestId);
    }

    const booking = await crmService.createBooking(data);
    this.cache.set(requestId, booking);
    setTimeout(() => this.cache.delete(requestId), 300000); // 5min TTL

    return booking;
  }
}

export const idempotentCRM = new IdempotentCRMClient();
```

### B.2 Saga Transaction

```typescript
// /web/src/services/saga.ts
interface SagaStep {
  name: string;
  execute: (ctx: any) => Promise<any>;
  compensate: (ctx: any) => Promise<void>;
}

export class Saga {
  constructor(private steps: SagaStep[]) {}

  async execute(initialContext: any): Promise<any> {
    const context = { ...initialContext, executedSteps: [] };

    try {
      for (const step of this.steps) {
        const result = await step.execute(context);
        context.executedSteps.push({ step, result });
      }
      return { success: true, context };
    } catch (error) {
      // Rollback
      for (let i = context.executedSteps.length - 1; i >= 0; i--) {
        await context.executedSteps[i].step.compensate(context);
      }
      return { success: false, error };
    }
  }
}
```

---

**작성자**: Claude Code AI
**문서 버전**: 1.0
**최종 수정일**: 2026-01-29
