# `scripture-3layer` 브랜치 — 동료용 변경 요약

이번 브랜치 변경 사항을 5분 안에 파악할 수 있는 한 페이지 요약. 세부 사항은 각 [상세 문서](#상세-문서-링크) 로.

---

## 0. TL;DR

| 영역 | 변화 |
|------|------|
| **불경 탭** | 3-layer 라우트 (`/scripture/v2`, `/scripture/[group]`, `/scripture/[group]/[volume]`) + 옛 `/scripture` 보존 |
| **북마크 → 하이라이트** | 문장 단위 → 캐릭터 단위 e-book 하이라이트, 메모, AI 부처님 묻기 통합 |
| **개인화 추천** | `/scripture/v2` 에 "당신을 위한 추천" 섹션 — affinity 기반 |
| **개념 사전** | `[[term]]` 마크업 → 풍부한 bottom sheet (한자/Sanskrit/어원/설명/관련 개념), 1,119 entries, 100% 커버리지 |
| **본문 진화 대응** | LLM 번역 업데이트 시 사용자 하이라이트 자동 재앵커링 (forward-only cascade) |
| **UI 정리** | TopNav 통일, /me sub-page 디자인 통일, 다크모드 시멘틱 토큰, BirthDateWheel |

---

## 1. 사용자 관점 변화

### 불경 탭 (`/scripture/v2`)
- **Hero carousel**: 5경전 + 경율이상, Ken Burns + auto-rotate 5초
- **이어 읽기**: 마지막 본 (그룹, 권) 즉시 진입
- **당신을 위한 추천** (NEW): ★/하이라이트/AI 묻기 신호 기반 8개 personalized + 2개 explore. 신호 < 3 이면 미렌더.
- **주요 경전 / 주제별 셔플 / 더보기**: 옛 동선 보존

### 그룹 페이지 (`/scripture/[group]`)
- 그룹 헤더 + ★ 즐겨찾기 + 권 리스트 + 이어 읽기

### Reader (`/scripture/[group]/[volume]`)
- 미니멀 nav, scroll 방향 기반 chrome hide/show
- **본문 selection 길게** → `FloatingActionBar` (하이라이트 / 메모 / 묻기)
- **하이라이트 클릭** → popover (삭제 / 메모 / 묻기). 메모 있으면 본문 미리보기.
- **`[[term]]` 마크 클릭** → Bottom sheet — 한자 + Sanskrit + 어원 + 풍부한 설명 + 관련 개념 (wiki 식 navigation)
- **AI 부처님 묻기**: 선택한 구절 + 질문 → AI 답변 + 명시 저장 (/me/answers 의 "경전 인용" 탭에 누적)
- 본문 끝에 "위치 추적 못 한 메모 N개" subtle pill (orphan 안내 — 현재 0)

### `/me/*` 정리
- `/me/highlights` (옛 /me/bookmarks 대체): 전체 / 메모 탭, 본문 미리보기 + 메모 + 클릭 시 reader 해당 위치로
- `/me/favorites` (NEW): ★ 한 경전 그룹 목록
- `/me/answers`: 자유 / 경전 인용 탭, 인용 텍스트 모달
- `/me/profile`: 전면 리뉴얼 + iOS 휠 picker (BirthDateWheel, accordion)
- 모든 sub-page: divide-y border-y 리스트 + `< 1/N >` 페이지네이션 통일

### 다크모드
- 시멘틱 토큰 마이그 — `text-gray-900` → `text-ink`, `bg-gray-300` → `bg-line-strong` 등
- 카카오 로그인 버튼 다크모드 fix (브랜드 컬러 유지)

---

## 2. 기술 관점 변화

### 새 라우트 (additive — 옛 라우트 모두 보존)

| Path | 역할 |
|------|------|
| `/scripture/v2` | Layer 1 — Browse (Hero + 추천 + Featured + Topic) |
| `/scripture/[group]` | Layer 2 — 그룹 상세 + 권 리스트 |
| `/scripture/[group]/[volume]` | Layer 3 — Reader |
| `/scripture/topic/[tag]` | 태그별 그룹 |
| `/api/scripture/groups`, `group/[key]`, `topic/[tag]` | 신규 group 메타 API |
| `/api/scripture/recommendations` | 개인화 추천 |
| `/api/highlights/resolve-batch` | Forward-only 하이라이트 재앵커링 |
| `/api/concepts`, `concepts/lookup` | 신규 개념 사전 |

옛 라우트 `/scripture/page.tsx`, `/api/scripture`, `/api/scripture/list`, `/api/glossary` 등 **모두 동결 유지** — Capacitor 옛 캐시 호환.

### 새 라이브러리 / 컴포넌트

| 경로 | 역할 |
|------|------|
| `src/lib/scriptureContent.ts` | markdown → sentence 파서 (reader + resolve API 공유) |
| `src/lib/scriptureSelection.ts` | DOM Selection → highlight range/offset |
| `src/lib/scripturePath.ts` | title → reader path 매핑 |
| `src/lib/useBodyScrollLock.ts` | iOS WKWebView 까지 안전한 body lock |
| `src/lib/scriptureCache.ts` | 모듈 in-memory + localStorage 캐시 |
| `src/lib/askBuddha.ts` | AI 부처님 묻기 helper |
| `src/lib/concepts.ts` | ConceptEntry types + lookup + density 판정 |
| `components/FloatingActionBar.tsx` | selection popover (3 액션) |
| `components/HighlightSheet.tsx` | 메모 입력 bottom sheet |
| `components/AskHighlightModal.tsx` | AI 묻기 3-phase 모달 |
| `components/ConceptSheet.tsx` | 개념 풍부한 bottom sheet (Sanskrit-grounded) |

### Stores (Zustand)

| Store | 용도 |
|-------|------|
| `useHighlightStore` | 옛 useBookmarkStore 대체, 동일 interface (이름만 변경) |
| `useScriptureFavoritesStore` | ★ 즐겨찾기 |
| `useScriptureNavStore` | 불경 탭 마지막 위치 |
| `useChromeStore` | reader chrome 표시 상태 |
| `useReaderSettingsStore` | 글자 크기 등 |
| `useAskCitationStore` | askBuddha 인용 임시 저장 |

---

## 3. 데이터 변경

### Live production DB (이미 적용됨, additive only)

| 테이블 / 컬럼 | 변경 | 영향 |
|---------------|------|------|
| `scriptures.content_version` | 신규 컬럼 (default 1) | 옛 코드 무시 — 안전 |
| `scriptures.content_updated_at` | 신규 컬럼 | 동일 |
| `scriptures.volume_no`, `group_key` | 신규 컬럼 (이전 세션) | 동일 |
| `scripture_groups` | 신규 테이블 (1509 그룹 메타) | 동일 |
| `highlights` | 신규 테이블 (옛 bookmarks 마이그됨) | 옛 row 모두 보존 |
| `highlights.start_char_offset`, `end_char_offset`, `highlight_text` | 신규 컬럼 | 동일 |
| `highlights.anchor_status`, `resolved_version` | 신규 컬럼 (forward-only versioning) | 동일 |
| `scripture_favorites` | 신규 테이블 (★) | 동일 |
| `temp_answers.scripture_title` | 신규 컬럼 (Phase 3 AI 인용) | 옛 NULL row 그대로 |

옛 `bookmarks` 테이블도 보존 중 (롤백 안전). 1~2주 안정화 후 별도 PR 로 drop 예정.

### Git 추가 파일

| 파일 | 크기 | 용도 |
|------|------|------|
| `dictionary/concepts.json` | 1119 entries, ~700KB | 개념 사전 진실 source. PR 로 변경 추적. |
| `scripts/*.sql` | 3 schemas | DB 마이그 (이미 적용) |
| `scripts/migrate-glossary-to-concepts.mjs` | — | glossary CSV → concepts.json 1차 마이그 |

기존 `dictionary/glossary-v0.8.csv` 보존 (옛 `/api/glossary` 가 참조).

---

## 4. main merge 직전 확인 사항

### ✅ 이미 안전 처리된 것
- DB schema 변경 모두 **additive** — 옛 main 코드 영향 0 (이미 production DB 적용 완료)
- 옛 라우트·API·테이블 **모두 보존** — Capacitor 옛 빌드 호환
- lint·tsc·런타임 테스트 모두 통과
- 5 commits 로 분할 (data → highlights+ask → scripture 3-layer → ui → docs) + 1 추가 (concepts curation)

### 🟢 main merge 직접 가능 — 추가 조치 불필요

```bash
git checkout main && git merge scripture-3layer && git push origin main
```

위 단계만으로 production 반영. **추가 마이그·SQL·환경 변경 없음**.

### ⚠️ merge 즉시 영향 받는 것
- Vercel auto-deploy 발동 → 1~3분 후 production (buddha-dusky.vercel.app) 새 코드
- Capacitor 네이티브 앱 (remote URL 모드) 사용자는 다음 앱 열기 시 즉시 새 코드 (네이티브 재빌드 불필요)
- DB 이미 schema 갱신 완료라 *코드만* 따라잡으면 됨

### 🟡 추후 정리 작업 (별도 PR, 운영 안정 후)
- 옛 `bookmarks` 테이블 drop (1~2주 후)
- 옛 `temp_answers` NULL user_id row 처리 (선택)
- 옛 `/scripture/page.tsx`, `/api/glossary` 등 deprecated 라우트 정리 (Capacitor 옛 빌드 충분히 교체된 후)

---

## 5. 알려진 한계 / 향후 작업

| 분야 | 한계 | 후속 작업 |
|------|------|-----------|
| Highlight | multi-sentence highlight 의 cascade — 한 sentence 내 매핑만 | Phase 5F semantic cascade |
| Highlight | 본문 50% 이상 재구성 시 cascade 한계 | LLM 보조 1:1 매핑 (text-evolution.md) |
| 개념 사전 | 1119 entries 의 confidence 0.3~0.5 (사람 검증 X) | 점진 curation, 1.0 상향 |
| 개념 사전 | top 50 만 Sanskrit-rich, 나머지는 simple | 점진 Sanskrit 추가 |
| 추천 | 매번 새로운 결과 (random tie-break) — 직관성↓ 가능 | session 단위 seed |
| 추천 | 측정 X — 클릭률 / 효과 미관측 | analytics 인프라 (별도) |
| 본문 업데이트 | dry-run script 없음 | Phase 5E author migration tool |

---

## 6. 상세 문서 링크

| 문서 | 내용 |
|------|------|
| [`docs/recommendations.md`](./recommendations.md) | 개인화 추천 affinity v1.1 — 알고리즘, 가중치, 캐싱, 튜닝 가이드 |
| [`docs/highlights-versioning.md`](./highlights-versioning.md) | 하이라이트 forward-only 재앵커링 — schema, cascade 단계, API |
| [`docs/text-evolution.md`](./text-evolution.md) | 본문 개선 작업 원칙 — 등급 (L0~L4), dry-run, orphan 임계, LLM prompt 가이드, 시스템 invariants |
| [`docs/concepts-system.md`](./concepts-system.md) | 개념 사전 — ConceptEntry 모델, type/density 정책, Sanskrit-grounded 큐레이션, LLM 워크플로우 |
| [`CLAUDE.md`](../CLAUDE.md) | 프로젝트 전반 컨텍스트 (AI 도구용) |

---

## 7. 커밋 단위 (review 참고)

```
5246de5f data(concepts): 1,119 entries 큐레이션 — 본문 [[]] 마커 100% 커버리지
39e83638 docs: Phase 4-6 onboarding + text-evolution 프레임워크 + CLAUDE.md 포인터
94af5008 ui: TopNav 통일 + /me sub-page 디자인 + 다크모드 시멘틱 토큰 + BirthDateWheel + 컴포넌트 정리
f8e52273 feat(scripture): 3-layer (v2/[group]/topic) + Phase 4-6 backends + reader 통합
f15ea86e feat(highlights+ask): character-offset e-book highlight + Reader AI 부처님 묻기 + /me/* 정리
e9b44796 data: SQL schemas + 마이그 scripts + concepts.json
```

각 commit 은 topic 단위로 cohesive. 일부 commit 은 후속 commit 의 코드를 *참조*하는 reader 변경을 포함 — git bisect 중간 단계는 일시적으로 broken 상태 가능, *최종 HEAD 는 정상*.

---

## 8. 핵심 점검 포인트 (동료 검증 시)

다음 흐름을 직접 따라가 보시면 변화 대부분 확인 가능:

1. `/dashboard` → 불경 탭
2. `/scripture/v2` 새로고침 → "당신을 위한 추천" 섹션 (신호 ≥ 3 일 때) → 카드 탭
3. 그룹 → 권 → reader 진입
4. 본문 단어 select → FloatingActionBar → 하이라이트 + 메모
5. 본문 `[[반야바라밀]]` 마크 탭 → ConceptSheet (Sanskrit + 어원 + 풍부한 설명) → 관련 개념 클릭 (wiki 식)
6. `[[수보리]]` — 한 권 안에서 첫 등장만 마크 (반복 마크 자동 억제) 확인
7. `/me/highlights` 메모 보기 → reader 위치로 복귀
8. `/me/answers` → 경전 인용 탭 → AI 답변 + 인용 본문
9. 다크모드 토글 → 모든 페이지 시각 확인

이상 발견 시 Issue 또는 코멘트 부탁드립니다.
