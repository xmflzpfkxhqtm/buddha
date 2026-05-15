# 경전 개념 시스템 — Sanskrit-Grounded Concepts

경전 본문의 `[[term]]` 마크업이 트리거하는 개념 설명 시스템. 본 시스템은 *동시대인이 납득 가능한* 불교 개념 설명을 위해, 한자/한국어 중계 설명 대신 **Sanskrit 어원에 기반한 설명**을 제공한다.

## 한 줄 요약

본문 `[[surface]]` 마커 → `dictionary/concepts.json` 의 ConceptEntry lookup → 풍부한 bottom sheet (한국어/한자/Sanskrit/어원/설명/관련 개념). type+density_policy 로 반복 마크 (수보리 등) 자동 억제.

## 파일 맵

| 경로 | 역할 |
|------|------|
| `dictionary/concepts.json` | **진실 source**. 모든 entry 의 데이터. git 으로 변경 추적. |
| `src/lib/concepts.ts` | TypeScript types, lookup index 빌드, density 판정 |
| `src/app/(app)/api/concepts/route.ts` | 전체 dictionary 반환 (reader 가 mount 시 1회 받아 메모리 lookup) |
| `src/app/(app)/api/concepts/lookup/route.ts` | surface → entry 단건/다건 |
| `src/app/(app)/scripture/[group]/[volume]/page.tsx` | reader — density-aware 렌더 |
| `components/ConceptSheet.tsx` | bottom sheet UX (한국어/한자/Sanskrit/어원/설명/관련) |
| `scripts/migrate-glossary-to-concepts.mjs` | 옛 `dictionary/glossary-v0.8.csv` → `concepts.json` 마이그 |
| `docs/concepts-system.md` | (본 문서) |

기존 `dictionary/glossary-v0.8.csv` 와 `/api/glossary` 는 동결 유지 (Capacitor 옛 캐시 호환). 신규 코드는 concepts.json 사용.

## 데이터 모델

```ts
type ConceptEntry = {
  id: string;                   // canonical, kebab-case (예: 'sunyata')
  korean: string;               // '공'
  korean_variants: string[];    // ['공', '공성', '공함']  ← 본문 lookup 키
  hanja?: string;               // '空'
  sanskrit?: string;            // 'śūnyatā' (IAST)
  sanskrit_devanagari?: string; // 'शून्यता'
  pali?: string;
  pronunciation_ko?: string;    // '슈냐타'
  etymology?: string;           // 'śūnya (비어 있음) + -tā (-性)'
  explanation: string;          // 산스크리트 어원 기반 현대어 설명
  type: 'concept' | 'proper_noun' | 'place' | 'sutra_name' | 'practice' | 'other';
  density_policy: 'always' | 'first_per_volume' | 'first_per_scripture' | 'never';
  related?: string[];           // 관련 concept id 들
  confidence?: number;          // 0~1 — curator 검토 신뢰도
  updated_at?: string;
};
```

### Density policy
- `always` — 매 occurrence 마다 시각 마크 (concept 기본)
- `first_per_volume` — 한 권 안에서 첫 등장만 (수보리, 아난 등 인물)
- `first_per_scripture` — 한 그룹 안에서 첫 등장만 (사위국, 영축산 등 장소)
- `never` — entry 존재하지만 마크 안 함 (사전에서만 찾을 수 있음)

### Lookup 동작
- 본문 `[[공]]` → `korean_variants` 에 "공" 포함된 entry 찾음
- `[[공함]]` → 같은 entry hit (variants 매칭)
- 충돌 시 첫 entry 우선 (사전 순서)

## 렌더링 (Reader)

```
본문 markdown 의 [[surface]] 마커
↓
conceptsIndex.get(surface) → ConceptEntry | null
↓
entry 없음 → plain text (시각 마크 X) ← 수보리 미등록 문제 자동 해결
entry 있고 density 판정 fail → plain text
entry 있고 density 판정 pass → <button> 마크 표시 + sheet 트리거
```

`densityState` 는 한 paint 당 1회 생성 (`makeDensityState()`), reader 의 JSX IIFE 안에서 누적. 같은 권 내 두 번째 [[수보리]] 부터는 plain 으로 렌더.

## API

### `GET /api/concepts`
전체 dictionary JSON 반환. Reader 가 mount 시 1회 호출, 모듈 캐시에 저장.

```ts
Response: ConceptDictionary
{
  version: string;       // semver
  generated_at: string;
  entries: ConceptEntry[];
}
```

Cache: `public, s-maxage=86400, stale-while-revalidate=604800` (정적 데이터).

### `GET /api/concepts/lookup?surface={surface}`
단건 lookup. 변형 매칭 (variants 포함). 거의 사용 안 함 — reader 는 전체 dictionary 받고 메모리 lookup.

### `POST /api/concepts/lookup`
다건. body: `{ surfaces: ['공', '보살', ...] }`.

## UX — Bottom Sheet (`ConceptSheet`)

```
┌────────────────────────────────────┐
│ ‹ 뒤로                         × │  ← history 있을 때만
├────────────────────────────────────┤
│ 공  空                            │
│ 산스크리트 śūnyatā  शून्यता        │
│ 팔리 suññatā                       │
│ 발음 ≈ 슈냐타                      │
├────────────────────────────────────┤
│ 다른 표기  공성, 공함              │
├────────────────────────────────────┤
│ 어원                              │
│ ┌──────────────────────────────┐  │
│ │ śūnya (비어 있음, 0의 어원)  │  │
│ │ + -tā (-性, 추상명사 접미사) │  │
│ └──────────────────────────────┘  │
├────────────────────────────────────┤
│ 설명                              │
│ 어떤 대상이 그 자체로 독립된...    │
├────────────────────────────────────┤
│ 관련 개념                          │
│ [무아] [연기] [무상] [중도]        │  ← 클릭 → 같은 sheet 내 navigation
├────────────────────────────────────┤
│        [닫기]                     │
└────────────────────────────────────┘
```

- 빈 필드는 hide
- 관련 개념 클릭 → history stack 누적 + entry 교체 (wiki 식 탐색)
- `confidence < 0.5` 면 작은 안내 ("1차 자동 생성본")
- Body scroll lock (뒷 본문 스크롤 방지)
- safe-area-inset-bottom 처리

## 작성 / 큐레이션 워크플로우

### 1차 자동 생성 (예정 — Phase 6E)
- `wiki-terms.csv` (1233 후보) 또는 본문에 등장하는 `[[surface]]` 들에서 새 entry 후보 추출
- LLM 에게 entry 별 prompt:
  - input: korean, hanja, context (어느 경전 어떤 sentence 에서 등장)
  - output: sanskrit, etymology, explanation (산스크리트 어원 기반), related
  - 반드시 Sanskrit 출처 citation (Monier-Williams 등)
- LLM 결과 `confidence: 0.3~0.5` 로 저장

### 사람 검증
- Sanskrit 정확도 확인 (Monier-Williams Sanskrit-English Dict, Buddhist Hybrid Sanskrit Dict)
- 어원 분석 검증
- 설명의 thesis 정렬 (Chinese-mediated 설명 회피, Sanskrit-grounded 강조)
- 검증 통과 시 `confidence: 1.0`

### type / density 분류
- 인물 (수보리, 아난, 가섭) → `proper_noun` + `first_per_volume`
- 장소 (사위국, 기수급고독원) → `place` + `first_per_scripture`
- 경전명 → `sutra_name` + `first_per_scripture`
- 수행법 (좌선, 염불) → `practice` + `always`
- 추상 개념 (공, 보살, 반야) → `concept` + `always`

### PR / 변경 추적
- `dictionary/concepts.json` 은 git 으로 변경 추적
- PR diff 가 entry 수정 단위 — 사람 검토 자연스러움
- 빌드 시 DB sync (추후 — 현재는 file-based)

## 현재 상태 (Phase 6 MVP + LLM 큐레이션 후, v1.2.1)

- ✅ **1,119 entries** (옛 246 마이그 + Phase 6E rich 50 + Coverage B simple 250 + Residual 660 + 1 placeholder)
- ✅ **본문 [[]] 마커 100% 커버리지** — 1,193 unique surfaces 모두 entry 매칭, "등록 안 됨" 절대 안 나옴
- ✅ Type 분포: concept 267 / proper_noun 276 / place 116 / sutra_name 309 / practice 88 / other 63
- ✅ Density 분포: always 319 / first_per_volume 316 / first_per_scripture 483 / never 1
- ✅ Top 50 (반야바라밀, 보살, 수보리 등) Sanskrit + 어원 + 풍부한 explanation 보유
- 나머지는 simple entry — 추후 curation 으로 rich 업그레이드 가능
- Confidence 0.3~0.5 (사람 검증 X). 검증 완료 entry 는 1.0 으로 상향.

### LLM 생성 비용 (참고)

| 단계 | 모델 | 비용 |
|------|------|------|
| Phase 6F (246 type 분류) | Sonnet 4.6 | $0.25 |
| Phase 6E (50 rich) | Sonnet 4.6 | $0.86 |
| Coverage B (250 simple) | Sonnet 4.6 | $2.26 |
| Residual (660 simple) | Sonnet 4.6 | $4.42 |
| **합계** | | **~$7.79** |

## 다음 단계 (Phase 6E+)

| | 작업 | 우선순위 |
|---|------|---------|
| 6E | 5경전 핵심 개념 (~50개) LLM 1차 + curation | 높음 — 본문 가독성 큰 효과 |
| 6F | 인물·장소 type 분류 (수보리 → proper_noun 등) | 높음 — 반복 마크 추가 억제 |
| 6G | wiki-terms.csv 의 mid 우선순위 (~200개) LLM 생성 | 중간 |
| 6H | 관련 개념 그래프 시각화 (별도 페이지) | 낮음 (탐험적) |
| 6I | 사용자 토글 ("모두 / 주요 개념만 / 끄기") | 중간 |

## 단일 main 서버 안전 원칙 부합

- API: additive — 기존 `/api/glossary` 동결 유지 (옛 캐시 JS 호환)
- 데이터: `dictionary/concepts.json` 신규, 옛 `glossary-v0.8.csv` 보존
- Reader 변경: `[[surface]]` 마크업 처리만 — 본문 자체는 안 건드림
- Capacitor 옛 캐시: 옛 JS 가 `/api/glossary` 호출 → 옛 동작 그대로

## 디버깅

- 본문 [[X]] 가 plain 으로 렌더되면: `conceptsIndex.get('X')` 가 null. `dictionary/concepts.json` 에 entry 추가 필요.
- 같은 entry 가 한 권 내 여러 번 마크되면: `density_policy` 가 `always` 임. `first_per_volume` 로 변경.
- 새 entry 추가했는데 안 보이면: dev 서버 재시작 (서버 모듈 캐시).
- 관련 개념 클릭이 작동 안 함: `related` 가 다른 entry 의 `korean` 또는 `korean_variants` 와 일치하지 않음. id 가 아닌 korean 으로 작성 권장.
