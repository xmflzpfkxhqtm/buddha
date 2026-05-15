# 개인화 추천 (`/scripture/v2` "당신을 위한 추천")

`scripture/v2` 의 "당신을 위한 추천" 섹션을 떠받치는 affinity 기반 추천 시스템 문서.

## 한 줄 요약

사용자의 ★/highlight/AI 묻기 신호를 group 단위로 모아 tag(school·topic) 가중합 → 후보 group 점수 매겨 top-N 반환. 발견을 위한 "탐험" 슬롯 별도. ML 없음, SQL+JS만.

## 파일 맵

| 경로 | 역할 |
|------|------|
| `src/app/(app)/api/scripture/recommendations/route.ts` | server route (v1.1 활성) |
| `src/app/(app)/scripture/v2/page.tsx` (`RecommendCard`, `RecommendHScrollRow`, 추천 fetch effect) | UI |
| `scripts/_recommendation-affinity-sim.mjs` | 로컬 시뮬레이션 (가중치 튜닝용) |
| `scripts/_recommendation-affinity-sim.sql` | Supabase SQL Editor 용 동일 로직 |
| `scripts/highlights-schema.sql`, `scripts/scripture-favorites-schema.sql`, `scripts/scripture-groups-schema.sql` | 데이터 모델 |
| `docs/recommendations.md` | (본 문서) |

## 데이터 모델 (신호 원천)

| 신호 | 테이블 | 가중치 (raw) | 메모 |
|------|--------|---------------|------|
| ★ 즐겨찾기 | `scripture_favorites (user_id, group_key)` | 5.0 | 명시적 |
| 메모 달린 highlight | `highlights (memo not null)` | 2.0 | title → `scriptures.group_key` join |
| 메모 없는 highlight | `highlights (memo is null)` | 1.0 | 위와 동일 |
| AI 부처님 묻기 (인용) | `temp_answers (scripture_title not null)` | 3.0 (count×) | 의도적 행동 |
| 최근 30일 보너스 | (위 모두) | × 1.5 | 신선도 |
| group 메타 (school/topic tags) | `scripture_groups` | (콘텐츠) | tag affinity 계산용 |

모든 가중치/임계는 `route.ts` 상단 상수.

## 알고리즘 (v1.1)

1. **사용자 group affinity**: 모든 신호의 group 별 가중합 → `Map<group_key, score>`.
2. **사용자 tag affinity**: 각 group 의 school/topic tag 에 group score 누적.
   - 예: ★ 7.5 인 group의 school=["반야부","선종"] → 반야부 +7.5, 선종 +7.5.
3. **후보 점수**: 모든 group (이미 affinity 있는 것 / ★한 것 제외) 에 대해
   `score = Σ(school tag 가중치) + Σ(topic tag 가중치)`.
4. **Personalized 풀**: `score > 0` 후보를 score desc 정렬, **동률은 random shuffle**.
   School signature (`school_tags` sorted-join) 당 최대 2 개 (다양성 cap).
   Top `(limit - explore)` 개 선택.
5. **Explore 풀**: `user_school_overlap == 0` (사용자 affinity school 과 disjoint) + `is_featured = true`.
   Random shuffle 후 `explore` 개 선택.
6. **Reason 매칭** (UI 설명용):
   - personalized: 후보 tag 와 *최대 overlap* 인 user affinity group 을 anchor 로. UI: `[Sparkles] {anchor_group}` + tooltip `"비슷한 경전: …"`.
   - explore: 후보 school_tags[0] 사용. UI: `[Compass] {school}` (accent-soft 색) + tooltip `"새 분야 탐험: …"`.
   - topic fallback (school 매칭 없음): UI: `[Tag] {topic}` + tooltip `"관심 분야: …"`.
   - 카드 폭(140px) 초과 시 텍스트는 1줄 truncate (ellipsis). 풀텍스트는 tooltip 으로.

## Cold-start

신호 합 < 임계 (`COLD_START_THRESHOLD = 3`) 면 `is_cold_start: true` 반환 → UI 가 섹션 자체 미렌더 → 옛 동선 (Featured / Topics) 으로 fallback.

## API

```
GET /api/scripture/recommendations?user_id={uuid}&limit=10&explore=2
```

Response:
```ts
{
  stats: { signal_count: number; threshold: number; is_cold_start: boolean },
  personalized: RecommendItem[],
  explore: RecommendItem[]
}
type RecommendItem = GroupRow & {
  raw_score: number,
  reason:
    | { kind: 'similar'; anchor_group: string }
    | { kind: 'topic';   anchor_tag: string }   // school 매칭 fallback
    | { kind: 'explore'; anchor_tag: string }
}
```

- 인증: query string 의 `user_id` 신뢰 (기존 `/api/bookmark/load` 등 codebase 컨벤션).
  RLS 보호는 별개. 빠른 join 위해 service-role key 사용.
- 서버 캐싱: `Cache-Control: no-store`. 매 호출마다 random tie-break / explore shuffle 로 신선함.
- 클라이언트 캐싱: 2단 (in-memory + localStorage).
  - **in-memory** `scriptureCache.recommendations` — 탭 스위치 시 즉시 렌더.
  - **localStorage** key `scripture-recommendations-v1` — 페이지 reload / 앱 재시작 사이 유지. mount 시점에 hydrate.
  - **Background refresh**: cache 가 있어도 항상 fetch 해서 silent update. 새 highlight/★ 직후 한 박자 늦지만 자연 갱신.
  - 다른 user 의 LS cache 가 hydrate 되면 fetch 후 discard + 정상 응답으로 교체.
  - Cold-start / 실패도 빈 배열로 LS 저장 — 다음 진입 시 skeleton 안 깜빡임.
- 로딩 UX: 캐시 hit 면 즉시 렌더, miss (첫 설치 직후) 면 skeleton (회색 placeholder 6개) → fade-in.

## 시뮬레이션 (가중치 튜닝)

```bash
# 본인 user_id 로 affinity / top-N 결과 콘솔 표시
node scripts/_recommendation-affinity-sim.mjs <user_uuid>
```

또는 Supabase SQL Editor 에서 `scripts/_recommendation-affinity-sim.sql` 의 9번째 줄 `'YOUR-USER-UUID-HERE'` 만 본인 uuid 로 치환 후 실행. 동일 로직.

## 튜닝 포인트 (운영 중 조정 빈도 ↑)

| 파라미터 | 위치 | 현재 | 조정 가이드 |
|----------|------|------|-------------|
| Cold-start 임계 N | `COLD_START_THRESHOLD` | 3 | 사용자 평균 신호 수 따라 ± . 너무 일찍 노출하면 추천 품질 저하. |
| School signature cap | `MAX_PER_SCHOOL_SIGNATURE` | 2 | 다양성 강도. 1 = 더 다양, 3 = 더 집중. |
| Explore 슬롯 | query `explore` (default 2) | 2 | 발견 vs 관심 비율. |
| 가중치 (★=5, ask=3, hl_memo=2, hl=1) | `route.ts` 상수 | — | 신호 분포 보고. 시뮬 mjs 로 사용자별 결과 검증. |
| 최근 30일 boost | `RECENT_DAYS / RECENT_MULT` | 30일 × 1.5 | 옛 일회성 흥미가 고착되지 않게. |

## 알려진 한계 / Phase 2+ 후보

| 한계 | 후보 해결책 | 단계 |
|------|-------------|------|
| Group 단위 신호 — 권 단위 깊이 (어디까지 읽었는지) 미반영 | reader 에 page_view / dwell_time event 트래킹 추가 | Phase 4 (별도 결정) |
| Tag 빈약한 group 은 추천 풀에서 누락 | 임베딩 기반 group prototype + cosine | Phase 5 (옵션) |
| 사용자 간 신호 격리 — collaborative filtering 없음 | 사용자 규모 확보 후 SVD/ALS 또는 graph-walk | 미래 |
| Reason 의 anchor 가 사용자 ★ 가 아닌 다른 affinity group 일 때 직관성 ↓ | "비슷한 분야" / "○○ 계열" 등 phrasing 분기 | UI tweak |
| Random tie-break 으로 매 호출 결과가 바뀜 — 안정성/직관성 ↓ 가능 | session 단위 seed (sessionStorage) 도입 | UI tweak |

## 변경 이력

- **v1.0 (2026-05-14)**: 첫 prototype. School cap을 `school_tags[0]` (primary) 기준 → 반야부 편향 9/10. 폐기.
- **v1.1 (2026-05-14)**: School signature sorted-join 기준 cap + random tie-break + explore 슬롯 (school overlap 0 & featured). 현재 활성.

## 단일 main 서버 안전 원칙 부합 여부

- API: additive only — 기존 `/api/scripture`, `/api/scripture/groups`, `/api/scripture/list` 영향 없음.
- UI: 섹션 추가만, 옛 위치 그대로. Cold-start 시 통째 미렌더.
- DB: 신규 테이블/컬럼 0. 기존 신호 테이블 SELECT 만.
- Capacitor: 옛 캐시된 JS 에서는 단순히 새 섹션 호출 없음 — 무동작 fallback.

## 디버깅 팁

- 추천이 안 나오면: dev tools network 에서 `/api/scripture/recommendations` 응답 확인.
  `is_cold_start: true` 면 신호 부족. `personalized: []` 면 모든 후보가 excluded (사용자가 모든 group ★ 했을 때 등 edge case).
- 결과가 매번 같으면: 동률 score 후보 없음 (사용자 신호 매우 강함). 정상.
- Reason 이 어색하면: `route.ts` 의 `reasonForPersonalized` 가 anchor 선택 — overlap_score = school×2 + topic. 사용자 affinity group 중 후보와 가장 겹치는 group.
