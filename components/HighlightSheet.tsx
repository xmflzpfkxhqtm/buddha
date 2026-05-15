// Long-press 또는 floating popover "메모" 액션으로 등장하는 bottom sheet.
// 신규 highlight + 메모 입력, 기존 highlight 메모 수정 + 삭제.
// target 은 selection range (start/end sentence + char offset) — character 단위 e-book UX.

'use client';
import { useEffect, useRef, useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';

export type HighlightSheetTarget = {
  // 선택 범위
  startSentence: number;
  startOffset: number;
  endSentence: number;
  endOffset: number;
  // 미리보기용 (선택된 텍스트)
  previewText: string;
  // 저장 시 anchor 로 쓰일 sentence text (앞 50자)
  anchorStartText: string;
  anchorEndText: string;
  // 기존 highlight 가 있으면 (메모 수정/삭제 모드)
  existing: { id: string; memo: string | null } | null;
};

export default function HighlightSheet({
  target,
  onClose,
  onSave,
}: {
  target: HighlightSheetTarget | null;
  onClose: () => void;
  onSave: (params: { memo: string }) => Promise<void>;
}) {
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMemo(target?.existing?.memo ?? '');
  }, [target]);

  // sheet open 동안 body 스크롤 잠금 (뒷 본문 스크롤 방지)
  useBodyScrollLock(!!target);

  // 모바일 키보드가 올라올 때 sheet 가 키보드 뒤로 가려지지 않게 visualViewport 추적.
  // wrapper 의 paddingBottom 으로 sheet 를 키보드 위로 밀어올림.
  // iOS WKWebView 14+, Android Chrome WebView 모두 지원.
  const [keyboardInset, setKeyboardInset] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const handler = () => {
      const overlap = window.innerHeight - vv.height - vv.offsetTop;
      setKeyboardInset(Math.max(0, overlap));
    };
    vv.addEventListener('resize', handler);
    vv.addEventListener('scroll', handler);
    handler();
    return () => {
      vv.removeEventListener('resize', handler);
      vv.removeEventListener('scroll', handler);
    };
  }, []);

  if (!target) return null;
  const isExisting = !!target.existing;

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave({ memo: memo.trim() });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  // 메모만 제거 (하이라이트는 유지) — onSave 에 빈 memo 전달.
  // 부모 (Layer 3) 의 saveHighlight 가 existing 분기에서 memo: '' → DB 의 memo = null 로 update.
  const handleDeleteMemo = async () => {
    if (!target.existing || saving) return;
    setSaving(true);
    try {
      await onSave({ memo: '' });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        // wrapper click 이 reader 의 main onClick (chrome tap-toggle) 까지 bubble 되지 않게 차단
        e.stopPropagation();
        onClose();
      }}
      className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-end justify-center"
      style={{
        // 키보드 올라온 만큼 sheet 를 위로 밀어냄. 키보드 없을 땐 safe-area 만.
        paddingBottom: keyboardInset > 0 ? keyboardInset : 'env(safe-area-inset-bottom)',
        transition: 'padding-bottom 150ms ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[460px] bg-surface-elevated rounded-t-2xl shadow-2xl px-5 pt-4 pb-6 animate-fade"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-accent">
            {isExisting ? '하이라이트' : '하이라이트 + 메모'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-ink-muted hover:bg-surface-sunken hover:text-ink transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 선택된 구절 미리보기 — 길면 컨테이너 안에서 세로 스크롤 */}
        <div className="mb-3 px-3 py-2 rounded-lg bg-surface-sunken text-sm text-ink-muted leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap">
          {target.previewText || '(빈 선택)'}
        </div>

        <label htmlFor="highlight-memo" className="block text-sm font-semibold text-ink-muted mb-2">
          메모
        </label>
        <textarea
          id="highlight-memo"
          ref={textareaRef}
          rows={4}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="이 구절에 대한 생각을 적어보세요"
          className="w-full rounded-lg border border-line bg-surface-elevated p-3 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none transition-colors resize-none"
        />

        <div className="flex items-center gap-3 mt-4">
          {isExisting && target.existing?.memo && (
            <button
              type="button"
              onClick={handleDeleteMemo}
              disabled={saving}
              aria-label="메모 제거"
              title="메모 제거 (하이라이트는 유지)"
              className="w-11 h-11 flex items-center justify-center rounded-lg text-accent-soft hover:bg-accent/5 active:bg-accent/10 transition-colors disabled:opacity-50"
            >
              <Trash2 size={20} />
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 h-11 rounded-lg bg-accent text-on-brand text-sm font-semibold hover:bg-accent-soft active:bg-accent-soft transition-colors disabled:opacity-50"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
