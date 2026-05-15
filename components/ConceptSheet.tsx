// Phase 6D — 경전 본문 [[...]] 마크 탭 시 등장하는 풍부한 entry sheet.
// 옛 중앙 popup 대체. 구조: 한국어/한자 / Sanskrit / 발음 / 변형 / 어원 / 설명 / 관련 개념.
// 관련 개념 클릭 → 같은 sheet 안에서 entry 교체 (wiki 식 탐색).
// 빈 필드는 hide.

'use client';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { ConceptEntry, LookupIndex } from '@/lib/concepts';
// 주의: useBodyScrollLock 는 부모 (reader) 가 termPopup 기반으로 관리한다.
// 여기서 다시 호출하면 이중 lock → 닫을 때 cleanup 순서 충돌로 body 스크롤이 잠긴 채 잔존.

export default function ConceptSheet({
  initialSurface,
  initialEntry,
  conceptsIndex,
  onClose,
}: {
  initialSurface: string;
  initialEntry: ConceptEntry | null;
  conceptsIndex: LookupIndex;
  onClose: () => void;
}) {
  // 현재 표시 중인 entry — 관련 개념 클릭 시 교체
  const [current, setCurrent] = useState<{ surface: string; entry: ConceptEntry | null }>(
    () => ({ surface: initialSurface, entry: initialEntry }),
  );
  // 탐색 history — 뒤로 가기용 (옵션)
  const [history, setHistory] = useState<{ surface: string; entry: ConceptEntry | null }[]>([]);

  useEffect(() => {
    setCurrent({ surface: initialSurface, entry: initialEntry });
    setHistory([]);
  }, [initialSurface, initialEntry]);

  // 관련 개념 id 로 lookup (related 는 entry.id 또는 entry.korean 일 수 있음 — 안전하게 둘 다 시도)
  const navigateToRelated = (idOrKorean: string) => {
    // 1차: korean 으로 lookup (가장 흔함)
    const entry = conceptsIndex.get(idOrKorean) ?? null;
    if (entry) {
      setHistory((h) => [...h, current]);
      setCurrent({ surface: idOrKorean, entry });
    }
  };

  const handleBack = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setHistory(history.slice(0, -1));
    setCurrent(last);
  };

  const { surface, entry } = current;
  const hasEntry = !!entry;

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      className="fixed inset-0 z-[190] bg-ink/20 backdrop-blur-sm flex items-end justify-center"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[460px] max-h-[80vh] overflow-y-auto bg-surface-elevated rounded-t-2xl shadow-2xl px-5 pt-4 pb-6 font-maruburi animate-fade"
      >
        {/* 상단 — 뒤로 가기 (history 있을 때만) + 닫기 */}
        <div className="flex items-center justify-between mb-3">
          {history.length > 0 ? (
            <button
              type="button"
              onClick={handleBack}
              aria-label="뒤로"
              className="text-sm text-ink-muted hover:text-ink active:text-ink transition-colors"
            >
              ‹ 뒤로
            </button>
          ) : (
            <span aria-hidden />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-ink-muted hover:bg-surface-sunken hover:text-ink transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {!hasEntry ? (
          <div>
            <p className="font-bold text-accent-soft text-xl">{surface}</p>
            <p className="mt-3 text-ink-muted leading-relaxed">
              사전에 등록된 뜻/설명이 아직 없습니다.
            </p>
          </div>
        ) : (
          <>
            {/* 헤더 — 한국어 + 한자 */}
            <div className="flex items-baseline gap-3 flex-wrap">
              <p className="font-bold text-accent-soft text-2xl">{entry.korean}</p>
              {entry.hanja && (
                <p className="text-lg text-ink-muted">{entry.hanja}</p>
              )}
            </div>

            {/* Sanskrit / Pali / 발음 */}
            {(entry.sanskrit || entry.sanskrit_devanagari || entry.pali || entry.pronunciation_ko) && (
              <div className="mt-2 space-y-0.5">
                {entry.sanskrit && (
                  <p className="text-sm text-ink-muted">
                    <span className="font-semibold text-ink-muted">산스크리트</span>{' '}
                    <span className="italic">{entry.sanskrit}</span>
                    {entry.sanskrit_devanagari && (
                      <span className="ml-2 not-italic">{entry.sanskrit_devanagari}</span>
                    )}
                  </p>
                )}
                {entry.pali && (
                  <p className="text-sm text-ink-muted">
                    <span className="font-semibold text-ink-muted">팔리</span>{' '}
                    <span className="italic">{entry.pali}</span>
                  </p>
                )}
                {entry.pronunciation_ko && (
                  <p className="text-xs text-ink-subtle">발음 ≈ {entry.pronunciation_ko}</p>
                )}
              </div>
            )}

            {/* 변형 표기 — korean 외에 다른 variants 가 있을 때만 */}
            {entry.korean_variants && entry.korean_variants.length > 1 && (
              <div className="mt-3 text-xs text-ink-muted">
                <span className="font-semibold">다른 표기</span>{' '}
                {entry.korean_variants.filter((v) => v !== entry.korean).join(', ')}
              </div>
            )}

            {/* 어원 — Sanskrit grounded explanation 의 토대 */}
            {entry.etymology && (
              <div className="mt-4 px-3 py-2.5 rounded-lg bg-surface-sunken">
                <p className="text-xs font-semibold text-ink-muted mb-1">어원</p>
                <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
                  {entry.etymology}
                </p>
              </div>
            )}

            {/* 설명 — 본문 */}
            <div className="mt-4">
              <p className="text-xs font-semibold text-ink-muted mb-1">설명</p>
              <p className="text-base text-ink leading-relaxed whitespace-pre-wrap">
                {entry.explanation}
              </p>
            </div>

            {/* 관련 개념 — 클릭 시 sheet 내 navigation */}
            {entry.related && entry.related.length > 0 && (
              <div className="mt-5">
                <p className="text-xs font-semibold text-ink-muted mb-2">관련 개념</p>
                <div className="flex flex-wrap gap-1.5">
                  {entry.related.map((rel) => (
                    <button
                      key={rel}
                      type="button"
                      onClick={() => navigateToRelated(rel)}
                      className="px-3 py-1 rounded-full text-xs text-accent-soft bg-accent-soft/10 hover:bg-accent-soft/20 active:bg-accent-soft/30 transition-colors"
                    >
                      {rel}
                    </button>
                  ))}
                </div>
              </div>
            )}

          </>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full py-2.5 rounded-xl bg-accent-soft text-on-brand font-semibold"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
