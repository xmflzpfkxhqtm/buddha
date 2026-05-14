# 경전 텍스트 진화 — 작업 원칙 / 프레임워크

> "AI가 가속하는 empirical culture는 동시에 더 많은 사람을 근원적 질문으로 밀어 보낸다.
> 다가올 시대의 사람들에게 닿는 형태로서의 불교는 아직 준비되어 있지 않다.
> 우리 작업은 그 *도달 가능한 형태* 를 구축하는 것이다."

본 문서는 위 thesis 에 따라 경전 번역본을 *지속 개선* 할 때 지켜야 할 원칙과 작업 프로세스를 정리한다. `docs/highlights-versioning.md` (forward-only highlight 재앵커링) 와 함께 읽는다.

---

## 0. 핵심 원칙 (philosophy)

| 원칙 | 의미 |
|------|------|
| **Forward-only** | 옛 번역은 보존하지 않는다. 모든 변경은 *더 나은 미래* 로의 한 방향. rollback 인프라 없음. 더 나쁜 결과가 나오면 *더 좋은 다음 번역으로 forward-fix*. |
| **highlight_text = 사용자 자산** | 사용자가 선택한 텍스트 + 메모는 *영구 자산*. 본문 변경 시 *위치는 잃을 수 있어도 자산은 절대 손실 금지*. cascade 가 자동으로 새 위치 매핑 시도. |
| **변화는 의식적 비용을 동반** | 텍스트 변경에는 자유가 있되, 그 자유의 *비용* (orphan, embedding 재생성, cache invalidation) 을 알고 의식적으로 결정한다. |
| **격리 안전** | 한 title 의 변경이 다른 title 의 사용자 자산에 영향 주면 안 됨. 변경은 title 단위 atomic. |
| **관측 가능** | 모든 텍스트 변경은 stats (ok / rematched / orphaned) 와 함께 기록. 운영 중 trend 추적. |

---

## 1. 변경 분류와 위험도 (taxonomy)

이 분류는 *highlight 보존 관점* 의 위험도. 번역 품질과는 별도.

| 등급 | 변경 유형 | Highlight 영향 | 워크플로우 |
|------|----------|---------------|-----------|
| **L0 — 안전** | 구두점·공백·이체자 normalize, 오타 수정 | 거의 없음 (cascade level 1·3 자동) | 자동 적용 가능, dry-run optional |
| **L1 — 미세** | 단어/구문 동의어 치환, 짧은 phrasing 윤문 (sentence 경계 유지) | cascade level 2·3 흡수 | dry-run 권장, orphan rate < 5% 예상 |
| **L2 — 중간** | 문장 분할/병합, 한 문장 내 어순 변경 | sentence index 일부 shift, level 4 가 prefix 로 흡수 | dry-run 필수, orphan < 15% 임계 |
| **L3 — 높음** | 단락 재구성, 문장 추가/제거, 단락 내 순서 변경 | 좌표 대규모 변경, cascade level 2·5 만 의지 | LLM 자동 적용 금지. 사람 review + dry-run 필수, orphan < 30% |
| **L4 — 매우 높음** | 권 분할/병합, title 자체 변경 | highlight.title 자체 무효 (별도 마이그 필요) | 별도 정책 결정 (현재 미정 — 발생 시 별도 논의) |

---

## 2. 작업 프로세스 (workflow)

### 2.1 변경 전 — 의도 명시
- Commit / PR description 에 변경 의도, 범위, 등급 (L0~L4) 명시.
- LLM 으로 생성한 경우 prompt 와 model 명 기록.

### 2.2 Dry-run (예정 — Phase 5E)
```bash
node scripts/migrate-text.mjs --title <title> --new-file <path> --dry-run
```
출력:
- 영향받는 highlight 수
- Cascade 시뮬: ok / rematched / orphaned 분포
- Orphan rate, 등급별 임계 대비 ✅/⚠️/❌

### 2.3 Orphan rate 임계 (행동 매트릭스)

| 등급 | Orphan ≤ 5% | 5–15% | 15–30% | > 30% |
|------|-------------|-------|---------|---------|
| L0 | ✅ commit | (이상치) 검토 | ❌ stop | ❌ stop |
| L1 | ✅ commit | ⚠️ review | ❌ stop | ❌ stop |
| L2 | ✅ commit | ✅ commit | ⚠️ LLM 1:1 매핑 보조 | ❌ stop |
| L3 | ✅ commit | ✅ commit | ✅ commit (사람 review 통과 시) | ⚠️ LLM 매핑 + 사람 review |
| L4 | — (별도 정책) | | | |

### 2.4 적용 (atomic)
- `scriptures.content` 갱신 + `content_version++` + 영향 highlight cascade 재실행 — 한 트랜잭션 (migration script 가 보장).
- *직접 SQL UPDATE 금지* — 항상 migration script 통과 (cascade 보장).

### 2.5 적용 직후 — 검증
- Cascade stats 로그 (`{ok, rematched, orphaned}`) commit 메시지 또는 별도 로그에 기록.
- Sanity: orphan 이 dry-run 예측과 ±5% 이내인지.

### 2.6 Embedding 재생성 (연계 시스템)
- 본문 변경은 RAG 임베딩 stale 화. `src/app/(app)/api/embed/` 파이프라인으로 재생성.
- 이 단계 *누락 시* AI 부처님 묻기 응답이 옛 본문 컨텍스트로 → 사용자 혼란. **반드시 sync**.

---

## 3. 텍스트 작성/수정 가이드 (editor playbook)

설계가 만들어내는 *암묵적 제약* 을 의식적으로 따르면 cascade 성공률 ↑, orphan ↓.

### 3.1 sentence 경계 안정성
- `splitSentences` (src/lib/scriptureContent.ts) 는 `[.!?]` + 따옴표 + 공백을 sentence 경계로 인식.
- 마침표 추가/제거는 sentence count 변화 → index 대규모 shift.
- **원칙**: 마침표 패턴은 가능하면 그대로. 의도된 분할/병합만.

### 3.2 sentence 시작 50자 (anchor_start_text 영역)
- Cascade level 4 가 *문장 첫 50자 prefix* 로 매칭.
- 문장 시작부를 크게 바꾸면 prefix 매칭 실패 → orphan ↑.
- **원칙**: 윤문은 sentence *후반* 부터, 첫 머리는 보수적.

### 3.3 사용자 highlight 가능 단위 보존
- 사용자는 의미적으로 완결된 구절 (e.g. "삼관(三觀)을 닦으면", "공(空)이 곧 색(色)이라") 을 선택.
- 이런 *의미 단위 구절* 을 깨뜨리면 cascade level 2 (exact) 실패.
- **원칙**: 구절 단위 표현은 가급적 유지. 동의어 치환도 *구절 통째로* 가 아니라 *구절 내 단어 1개* 정도.

### 3.4 markdown 구조 일관성
- 빈 줄, `#`, `>`, `---` 는 parseMarkdownToBlocks 가 의존.
- 단락 경계 (빈 줄) 변경 → sentence flat array 의 그룹화 변화.
- **원칙**: 단락 구조는 *내용적 이유* 가 있을 때만 변경. 마구잡이 단락 재배치 금지.

### 3.5 normalize 규칙 통일
- 옛 commits 에 "콤마 뒤 줄바꿈 일괄 적용" 정책 적용됨.
- 이런 정형 normalize 는 *전체 일괄 적용* (한 title 만 부분 적용 금지) → cascade level 3 normalize 와도 정합.
- **원칙**: normalize 변경은 *전 경전 일괄* commit. 부분 적용은 불일치 부채.

### 3.6 용어 (glossary) 정합
- `dictionary/` CSV 의 용어가 본문에 등장 → glossary popup.
- 본문에서 용어를 다른 표현으로 치환할 때 glossary 도 동시 업데이트.
- **원칙**: glossary 와 본문은 한 commit 에서 함께 변경.

---

## 4. AI / LLM 협업 시 (LLM-assisted improvements)

### 4.1 Prompt 설계
LLM 에게 텍스트 개선 요청 시 다음 컨텍스트를 prompt 에 *반드시* 포함:

```
이 경전 번역본은 사용자가 highlight 와 메모를 남길 수 있습니다.
- sentence 경계 (마침표, 따옴표) 는 가능하면 유지하세요.
- 각 sentence 의 첫 50자는 가급적 보수적으로 (anchor 역할).
- 의미 단위 구절 (예: "공(空)이 곧 색(色)") 은 그대로 또는 1:1 치환만.
- 단락 구조 (빈 줄 경계) 는 의도적 변경만.
```

### 4.2 LLM 출력 검증
- 자동 적용 금지 (L1 까지만).
- L2 이상은 dry-run → 사람 1차 review → cascade stats 확인 → commit.
- L3 이상은 dry-run 후 cascade orphan 들에 대해 LLM 에게 *1:1 매핑* 요청 (old highlight_text → new sentence 매핑).

### 4.3 LLM 모델 / prompt 버전 기록
- `scripture_groups.generated_by`, `generated_at` 와 유사하게 본문 변경 commit 에 모델·prompt 기록.
- 추후 어느 모델 버전의 어떤 prompt 가 가장 좋은 번역을 만드는지 evolutionary tuning 가능.

---

## 5. 시스템 Invariants (지켜야 할 불변)

이 invariants 가 깨지면 cascade / highlight 시스템 동작 보장 불가.

| Invariant | 의미 | 위반 시 |
|-----------|------|---------|
| `content_version` monotonic forward | 매 변경마다 strictly increment, 절대 감소 안 함 | cascade 가 잘못된 캐시 hit 판정 |
| 본문 변경은 migration script 만 | `UPDATE scriptures SET content = ...` 직접 금지 | cascade 안 돌고 highlight 좌표 stale → 사용자에게 broken UX |
| `highlight_text`, `memo` 절대 미수정 | migration script 가 highlights 의 *좌표만* 수정. text/memo 는 read-only | 사용자 자산 손실 |
| `splitSentences` 함수 변경 = breaking change | 사실상 *모든 title 전체 재앵커링* 필요 | docs/highlights-versioning.md 의 추가 절차 필요 |
| Glossary / 본문 / embedding sync | 셋이 정합한 한 단위 commit 또는 *명시적 sync 작업* | RAG / popup / highlight 불일치 |

---

## 6. 관측 / 운영 (observability)

### 6.1 변경마다 기록할 메트릭
- title
- old_version → new_version
- 변경 등급 (L0~L4)
- 작업자 / LLM 모델
- Cascade stats: total / ok / rematched / orphaned
- Orphan rate
- 사람 review 통과 여부

### 6.2 운영 중 추적
- 주 1회 batch: 전체 title 의 평균 orphan rate
- 특정 title 의 orphan rate 가 *시간이 지나며 ↑* 면 *cascade 가 차츰 무너지는 징후* — 재검토.
- 사용자 피드백 채널: "메모가 사라졌어요" → 항상 즉시 추적 (사용자 자산이라 SLA 1순위).

### 6.3 임계 알람 (제안)
- 단일 변경의 orphan rate > 30% (L3 임계 초과)
- 전체 title 평균 orphan rate > 15%
- 특정 title 의 누적 orphan ratio > 40%
- 사용자가 highlight 한 직후 orphan 발생 (텍스트가 너무 자주 바뀐다는 신호)

---

## 7. 알려진 한계 (현 시점)

이 한계들은 *향후 Phase 5F+* 또는 별도 작업에서 해결.

| 한계 | 영향 | 해결 후보 |
|------|------|----------|
| Multi-sentence highlight (`start_sentence ≠ end_sentence`) cascade 가 single-sentence 로 collapse | 긴 highlight 가 부분 표시 | multi-span cascade — start/end 별도 매칭 |
| Normalized 매칭의 char offset 복원 불가 | sentence-level 매칭 (offset = 0, sentence.length) | character alignment 알고리즘 (예: needle-Wunsch) |
| 매우 큰 본문 재구성 (50%+ sentence 변경) | level 2·3·4 모두 fail → orphan 다수 | Phase 5F semantic (embedding cosine) |
| L4 (권 분할/병합, title 변경) | highlight.title 자체 무효, 별도 migration | 별도 정책 (발생 시 결정) |
| 사용자 정의 글자 변환 (예: 한자→한글 자동) | 모든 highlight 한 번에 orphan 가능 | normalize 정책에 포함 |

---

## 8. 결정 매트릭스 — "이 변경 해도 돼?"

빠른 의사결정 가이드:

1. **L0** (구두점 normalize) → 그냥 적용. dry-run 선택.
2. **L1** (단어 치환) → dry-run → orphan < 5% 이면 적용.
3. **L2** (sentence 분할/병합) → dry-run → 15% 임계 적용. 초과 시 변경 범위 축소.
4. **L3** (단락 재구성) → dry-run + 사람 review + LLM 매핑 보조. 30% 초과 시 단계적 분할.
5. **L4** (권 변경) → 별도 논의 후 별도 migration.

판단 기준:
- 변경의 *번역 품질 향상* vs *사용자 자산 손실 비용* 의 균형
- Forward-only 원칙: 시간이 갈수록 더 나은 번역을 향해 가는 길에 일부 orphan 은 수용 가능
- 단, 사용자가 *동시에* 다수의 highlight 를 잃는 사건은 신뢰 손실 → 같은 사용자가 자주 쓰는 title 은 보수적

---

## 9. 관련 문서

- [docs/highlights-versioning.md](./highlights-versioning.md) — cascade 알고리즘 / API / Phase 진행
- [docs/recommendations.md](./recommendations.md) — 사용자 affinity 시스템 (highlight signal 사용)
- [CLAUDE.md](../CLAUDE.md) — 프로젝트 전반 컨텍스트
- `scripts/highlights-versioning-schema.sql` — schema 정의
- `src/lib/scriptureContent.ts` — sentence parser (변경 시 breaking change)

---

## 변경 이력

- **v1 (2026-05-14)**: 초안. Phase 5A·B·C 직후. forward-only highlight 시스템 직후의 원칙 명문화. dry-run script (5E) 도입 시 2.2 section refine 예정.
