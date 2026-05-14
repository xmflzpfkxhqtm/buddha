// 경전 selection → "묻기" 시 reader 안에서 등장하는 부처님 문답 모달.
// phase: input → loading → answer → (저장 옵션). 닫으면 모든 state reset.
// /ask 페이지로 이동 안 함 — reader 컨텍스트 유지.

'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { X, Save, Check } from 'lucide-react';
import { askBuddha, saveAnswer, buildCitedQuestion, type BuddhaAnswer } from '@/lib/askBuddha';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';

export type AskCitation = {
  text: string;
  titleClean: string;       // 표시용 정돈된 제목 (예: '금강반야바라밀경 1권')
  scriptureTitle: string;   // 옛 형식 원본 (예: '금강반야바라밀경_K0013_1권') — DB 저장용
};

type Phase = 'input' | 'loading' | 'answer';

export default function AskHighlightModal({
  open,
  citation,
  onClose,
}: {
  open: boolean;
  citation: AskCitation | null;
  onClose: () => void;
}) {
  const [userQuestion, setUserQuestion] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [answer, setAnswer] = useState<BuddhaAnswer | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  // 키보드 올라온 visible 영역 안에 modal 이 fit 되도록 max-height 동적 계산.
  const [visibleHeight, setVisibleHeight] = useState<number | null>(null);

  // 모달 open 동안 body 스크롤 잠금 (뒷 본문 스크롤 방지)
  useBodyScrollLock(open);

  // 모달 닫힘 시 모든 state reset
  useEffect(() => {
    if (open) return;
    setUserQuestion('');
    setPhase('input');
    setAnswer(null);
    setSaving(false);
    setSaved(false);
    setError(null);
  }, [open]);

  // 키보드 inset (visualViewport) + visible 영역 추적
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const handler = () => {
      const overlap = window.innerHeight - vv.height - vv.offsetTop;
      setKeyboardInset(Math.max(0, overlap));
      setVisibleHeight(vv.height);
    };
    vv.addEventListener('resize', handler);
    vv.addEventListener('scroll', handler);
    handler();
    return () => {
      vv.removeEventListener('resize', handler);
      vv.removeEventListener('scroll', handler);
    };
  }, []);

  if (!open || !citation) return null;

  const handleSubmit = async () => {
    if (phase !== 'input') return;
    setPhase('loading');
    setError(null);
    try {
      const fullQuestion = buildCitedQuestion(citation, userQuestion);
      const result = await askBuddha({
        question: fullQuestion,
        length: 'short',
        scriptureTitle: citation.scriptureTitle,
      });
      setAnswer(result);
      setPhase('answer');
    } catch (e) {
      setError(e instanceof Error ? e.message : '답변을 받지 못했습니다.');
      setPhase('input');
    }
  };

  const handleSave = async () => {
    if (!answer || saved) return;
    setSaving(true);
    setError(null);
    try {
      await saveAnswer(answer.id);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-end justify-center"
      style={{
        paddingBottom: keyboardInset > 0 ? keyboardInset : 'env(safe-area-inset-bottom)',
        transition: 'padding-bottom 150ms ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[460px] bg-surface-elevated rounded-t-2xl shadow-2xl px-5 pt-4 pb-6 flex flex-col"
        style={{
          // visible 영역의 95% 안에 fit. fallback 85vh.
          maxHeight: visibleHeight ? `${Math.floor(visibleHeight * 0.95)}px` : '85vh',
        }}
      >
        <div className="flex items-center justify-between mb-3 shrink-0">
          <h2 className="text-base font-semibold text-accent">부처님께 묻기</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-ink-muted hover:bg-surface-sunken hover:text-ink transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 인용 박스 — 모든 phase 공통 */}
        <div className="shrink-0 mb-3 px-3 py-2 rounded-lg bg-surface-sunken text-sm text-ink-muted leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap">
          <p className="text-xs text-ink-subtle mb-1">📖 {citation.titleClean}</p>
          {citation.text}
        </div>

        {/* phase 별 본문 */}
        {phase === 'input' && (
          <>
            <textarea
              rows={4}
              value={userQuestion}
              onChange={(e) => setUserQuestion(e.target.value)}
              placeholder={`이 구절에 대해 더 묻고 싶은 점을 적어보세요.
(비워두면 자동으로 의미를 여쭙습니다.)`}
              className="w-full rounded-lg border border-line bg-surface-elevated p-3 text-sm text-ink placeholder:text-ink-subtle placeholder:whitespace-pre-line focus:border-accent focus:outline-none transition-colors resize-none"
            />
            {error && <p className="mt-2 text-sm text-accent">{error}</p>}
            <button
              type="button"
              onClick={handleSubmit}
              className="mt-4 h-11 w-full rounded-lg bg-accent text-on-brand text-sm font-semibold hover:bg-accent-soft transition-colors"
            >
              부처님께 묻기
            </button>
          </>
        )}

        {phase === 'loading' && (
          <div className="flex-1 flex flex-col items-center justify-center py-12 gap-4">
            {/* ask 흐름의 Loading 컴포넌트와 시각/언어 톤 통일.
                목탁 소리는 의도적으로 제외 — reader 안 즉석 묻기는 가벼운 흐름. */}
            <div className="animate-float">
              <Image
                src="/lotusbeige.png"
                alt="lotus"
                width={48}
                height={48}
                className="object-contain"
              />
            </div>
            <p className="text-sm text-center text-ink-muted whitespace-pre-line leading-relaxed animate-fadeIn">
              마음의 소리에 귀를 기울이는 중입니다.{'\n'}당신의 물음이 조용히 울리고 있습니다.
            </p>
          </div>
        )}

        {phase === 'answer' && answer && (
          <>
            <div className="flex-1 overflow-y-auto whitespace-pre-wrap text-ink leading-relaxed text-base font-maruburi mb-4 pr-1">
              {answer.answer}
            </div>
            {error && <p className="mb-2 text-sm text-accent">{error}</p>}
            <div className="shrink-0 flex gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || saved}
                className={`flex-1 h-11 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  saved
                    ? 'bg-surface-sunken text-ink-muted cursor-default'
                    : 'bg-accent text-on-brand hover:bg-accent-soft'
                } disabled:opacity-50`}
              >
                {saved ? (
                  <>
                    <Check size={16} /> 저장됨
                  </>
                ) : saving ? (
                  '저장 중...'
                ) : (
                  <>
                    <Save size={16} /> 저장
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-11 rounded-lg border border-line text-sm font-semibold text-ink-muted hover:bg-surface-sunken transition-colors"
              >
                닫기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
