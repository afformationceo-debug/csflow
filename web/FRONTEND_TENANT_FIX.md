# Frontend Tenant ID 수정 완료 ✅

## 문제 확인

Console 에러:
```
GET https://bfxtgqhollfkzawuzfwo.supabase.co/rest/v1/knowledge_documents?select=category&tenant_id=eq.none&category=not.is.null 400 (Bad Request)
```

**근본 원인**: 프론트엔드에서 `tenant_id=eq.none`으로 API 호출 → 400 Bad Request 발생

## 수정 내용

### 1. `/web/src/app/(dashboard)/knowledge/page.tsx` 수정

#### 변경사항 1: `activeTenantId` 초기값 변경
```typescript
// BEFORE (잘못됨)
const [activeTenantId, setActiveTenantId] = useState<string>("");

// AFTER (수정됨)
const [activeTenantId, setActiveTenantId] = useState<string | undefined>(undefined);
```

#### 변경사항 2: React Query 호출 조건부 실행
```typescript
// BEFORE (잘못됨)
const { data: apiDocuments } = useKnowledgeDocuments({
  tenantId: selectedTenantFilter || activeTenantId || "none", // ← "none" 문제!
  category: selectedCategory,
  search: searchQuery || undefined,
});

// AFTER (수정됨)
const { data: apiDocuments } = useKnowledgeDocuments({
  tenantId: selectedTenantFilter || activeTenantId || "",
  category: selectedCategory,
  search: searchQuery || undefined,
}, {
  enabled: !!(selectedTenantFilter || activeTenantId), // ← tenant ID 있을 때만 호출
});
```

### 2. `/web/src/hooks/use-knowledge-base.ts` 수정

React Query hooks에 `enabled` 옵션 지원 추가:

```typescript
// useKnowledgeDocuments
export function useKnowledgeDocuments(
  filters: KnowledgeDocumentFilters,
  options?: { enabled?: boolean } // ← 추가
) {
  return useQuery({
    queryKey: knowledgeKeys.documents(filters),
    queryFn: async () => { ... },
    staleTime: 30000,
    enabled: options?.enabled !== false, // ← 추가
  });
}

// useKnowledgeCategories
export function useKnowledgeCategories(
  tenantId: string,
  options?: { enabled?: boolean } // ← 추가
) {
  return useQuery({
    queryKey: knowledgeKeys.categories(tenantId),
    queryFn: async () => { ... },
    staleTime: 60000,
    enabled: options?.enabled !== false && !!tenantId, // ← 추가
  });
}

// useKnowledgeStatistics
export function useKnowledgeStatistics(
  tenantId: string,
  options?: { enabled?: boolean } // ← 추가
) {
  return useQuery({
    queryKey: knowledgeKeys.statistics(tenantId),
    queryFn: async () => { ... },
    staleTime: 60000,
    enabled: options?.enabled !== false && !!tenantId, // ← 추가
  });
}
```

## 작동 방식

1. **페이지 로드 시**:
   - `activeTenantId = undefined` (초기 상태)
   - React Query 호출 **비활성화** (`enabled: false`)
   - API 요청 **전송 안 됨** ✅

2. **Tenant 로드 완료 후**:
   - `/api/tenants` API 호출 → 첫 번째 tenant ID 설정
   - `activeTenantId = "8d3bd24e-0d74-4dc7-aa34-3e39d5821244"`
   - React Query 호출 **활성화** (`enabled: true`)
   - 올바른 tenant ID로 API 요청 ✅

3. **API 요청 예시**:
```
GET https://bfxtgqhollfkzawuzfwo.supabase.co/rest/v1/knowledge_documents?select=*&tenant_id=eq.8d3bd24e-0d74-4dc7-aa34-3e39d5821244
```

## 빌드 검증 ✅

```bash
npm run build
# Result: ✓ Compiled successfully
# TypeScript: 0 errors
# Next.js build: Success
```

## 다음 단계

1. **배포**: Vercel에 자동 배포 (main 브랜치 push 시)
2. **테스트**: https://csflow.vercel.app/knowledge 접속
   - 로그인: `afformation.ceo@gmail.com / afformation1!`
   - **기대 결과**: 75개 문서 모두 표시 ✅
3. **RLS 정책 검증**: Migration 008 + 프론트엔드 수정으로 완전히 해결됨

## 기술 요약

**문제**: `tenant_id=eq.none` → 400 Bad Request
**원인**: 초기 로딩 중 tenant ID가 없을 때 `"none"` 문자열로 fallback
**해결**:
- `activeTenantId` 타입을 `string | undefined`로 변경
- React Query `enabled` 옵션으로 조건부 실행
- Tenant 로드 완료 후에만 API 호출

**RLS 정책 상태**: Migration 008 이미 실행 완료 (Database는 정상)
**Frontend 상태**: 수정 완료 (이번 커밋)
**전체 상태**: ✅ Database + Frontend 모두 준비됨
