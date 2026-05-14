# Highlight 진화 대응 (Forward-Only)

경전 본문이 LLM·사람 협업으로 *지속 개선* 되는 환경에서, 사용자의 highlight 와 메모를 잃지 않고 새 본문으로 *앞으로만* 끌고 가는 시스템.

## 한 줄 요약

본문 갱신 시 cascade 매칭으로 highlight 위치를 새 본문에 재앵커링. 못 찾으면 orphaned 로 표시하되 `highlight_text`+`memo` 는 영구 보존. 옛 본문은 보관하지 않는다 (forward-only).

## 설계 원칙

- 옛 번역 보존 = 후퇴. **미래로만 진행**, rollback 없음.
- `highlight_text` (사용자가 정확히 선택한 텍스트) + `memo` = **해석 자산**. 본문이 진화해도 영구 보존.
- 본문 변경 시 highlight 를 cascade 로 *최대한 앞으로 끌고 간다*.
- orphan 은 자연 진화의 결과 — 사용자에게 panic event 로 노출 안 함.

## 파일 맵

| 경로 | 역할 |
|------|------|
| `scripts/highlights-versioning-schema.sql` | DB schema (Phase 5A) |
| `src/lib/scriptureContent.ts` | markdown → sentence flat array 파서 (reader + resolve API 공유) |
| `src/app/(app)/api/highlights/resolve-batch/route.ts` | cascade 재앵커링 server (Phase 5B) |
| `src/app/(app)/scripture/[group]/[volume]/page.tsx` | Reader — 향후 resolve API 호출하도록 통합 (Phase 5C) |
| `src/app/(app)/me/highlights/page.tsx` | orphan UX (Phase 5D) |
| `docs/highlights-versioning.md` | 본 문서 |

## Schema

```sql
-- scriptures
content_version          int    not null default 1
content_updated_at       timestamptz

-- highlights
anchor_status            text   not null default 'ok'
  -- 'ok' (좌표 신선) | 'rematched' (cascade 매핑됨) | 'orphaned' (실패) | 'pending' (migration 직후)
resolved_version         int    not null default 1
```

옛 row backfill: `anchor_status='ok', resolved_version=1`. 모두 idempotent (`if not exists`).

## Cascade 알고리즘

`POST /api/highlights/resolve-batch { user_id, titles[] }` (또는 `GET ?user_id=&title=`):

| 단계 | 방법 | 결과 status |
|------|------|------------|
| 0 | `resolved_version == content_version` 이면 캐시 hit, DB row 그대로 | (변화 없음) |
| 1 | 캐시된 좌표 위치 텍스트가 `highlight_text` 와 정확 일치 | `ok` |
| 2 | `highlight_text` 가 본문 어디든 정확 일치 | `rematched` |
| 3 | Normalize (공백·구두점·이체자) 후 fuzzy 검색 | `rematched` |
| 4 | `anchor_start_text` 50자 prefix 로 sentence 매칭 후 within-sentence 시도 | `rematched` |
| 5 (Phase 5F, 옵션) | Embedding cosine similarity | `rematched` |
| — | 모두 실패 | `orphaned` |

매칭 성공 시:
- `start_sentence`, `start_char_offset`, `end_sentence`, `end_char_offset` 갱신
- `anchor_status`, `resolved_version` 업데이트
- 다음 호출은 단계 0 캐시 hit

매칭 실패 시:
- 좌표는 옛 값 유지 (참고용)
- `anchor_status = 'orphaned'`
- `memo` / `highlight_text` 영구 보존

## API

### GET `/api/highlights/resolve-batch?user_id={uuid}&title={title}`

단일 title 의 사용자 highlights 재앵커링.

```ts
Response: {
  highlights: HighlightRow[],   // anchor_status / 좌표 갱신본
  stats: {
    total, ok, rematched, orphaned, cache_hits
  }
}
```

### POST `/api/highlights/resolve-batch`

다중 title (예: /me/highlights 전체 로드).

```ts
Body:    { user_id: string, titles: string[] }
Response: 위와 동일 (titles 의 union)
```

캐싱: `Cache-Control: no-store`. 매 호출 fresh — DB persist 가 캐시 역할.

## UX — orphan 자연화

### Reader (Layer 3)
- orphaned highlight 는 본문에 *시각화 없음* (좌표 모름)
- 하단 작은 footer: `"이 경전의 메모 {N}개를 새 본문에서 찾을 수 없습니다 — 보기"` (N≥1 일 때만)
- "후퇴 경고" 아닌 "부드러운 안내"

### /me/highlights
- 모든 highlight 그대로. `highlight_text` + `memo` 영구
- orphaned 는 회색 dot 미세 표시 (panic 유발 안 함)
- 액션: 그대로 보관 / "새 번역에서 찾기" (Phase 5G, askBuddha 통합) / 삭제

## Author Migration Workflow (Phase 5E, 예정)

```bash
# 1. dry-run
node scripts/migrate-text.mjs --title <title> --new-file <path> --dry-run
# 영향받는 highlights: 18
#   ok (좌표 유효): 14
#   rematched: 3
#   orphaned: 1 (5.5%)

# 2. commit (forward only — rollback 없음)
node scripts/migrate-text.mjs --title <title> --new-file <path> --commit
# - scriptures.content 갱신, content_version++
# - 영향 highlights anchor_status='pending' → cascade 즉시 실행 + persist
# - 리포트
```

Orphan rate 임계 (예: 30%) 초과 시 LLM 1:1 매핑 보조 단계 (Phase 5E+).

## Phase 진행

| Phase | 작업 | 상태 |
|-------|------|------|
| **5A** | Schema (3개 컬럼) + 옛 row backfill | 완료 (SQL 적용 대기) |
| **5B** | resolve-batch API + 공유 parser lib | 완료 |
| **5C** | Reader 가 resolve API 통과 후 렌더 + orphan footer | 예정 |
| **5D** | /me/highlights orphan subtle 뱃지 | 예정 |
| **5E** | Author migration script (dry-run + forward commit) | 예정 |
| **5F** | (옵션) Semantic cascade 단계 5 | 미정 |
| **5G** | (옵션) askBuddha 통합 "새 번역에서 찾기" | 미정 |

## 운영 안전 (단일 main 서버)

- Schema: additive only — 옛 row 통과, 옛 코드 영향 없음 (`anchor_status`/`resolved_version` 미참조)
- API: 신규 endpoint, 기존 `/api/bookmark/load` 등 동결
- Capacitor 옛 캐시: resolve API 못 부르는 옛 JS 는 기존 좌표로 렌더 — 텍스트 변경 전이면 정상, 후면 잘못된 위치 가능 (graceful degradation — 사용자 재진입 시 정상)
- Rollback 시나리오: 새 번역이 나쁘면 → *더 나은 번역으로 forward-fix*. 옛 번역으로 돌아가지 않음. dry-run 으로 사전 검증.

## 한계 / 향후

- `findInFlatSentences` 의 normalized 매칭 — sentence-level hit 으로 정확 offset 복원 X. 사용자 시각으로는 sentence 전체가 highlight 됨. 의미는 보존.
- multi-sentence highlight (start_sentence ≠ end_sentence) — cascade 가 한 sentence 내로만 매핑. 향후 multi-span 지원.
- `confidence score` — cascade 단계마다 자신도가 다름. 추후 score 반환 후 UI 가 "위치 추정" 약한 신호 표시 가능.
- 매우 큰 본문 재구성 (50%+ sentence 변경) — fuzzy 도 한계. Phase 5F semantic 또는 사람 검토 필요.
