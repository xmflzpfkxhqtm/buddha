// Native text selection 위에 떠 있는 floating popover.
// Selection 영역의 boundingRect 기준으로 위 (공간 부족하면 아래) 에 위치.
// 액션: "하이라이트" (즉시 저장) / "메모" (HighlightSheet 열기) / "묻기" (ask 페이지 인용 prefill).

'use client';
import { useEffect, useState } from 'react';
import { Highlighter, MessageSquarePlus, MessageCircleQuestion } from 'lucide-react';

const POPOVER_HEIGHT = 44;
const POPOVER_GAP = 8;

export default function FloatingActionBar({
  visible,
  rect,
  onHighlight,
  onMemo,
  onAsk,
}: {
  visible: boolean;
  rect: DOMRect | null;
  onHighlight: () => void;
  onMemo: () => void;
  onAsk: () => void;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!visible || !rect) {
      setPos(null);
      return;
    }
    const above = rect.top - POPOVER_GAP - POPOVER_HEIGHT;
    const top = above > 12
      ? above
      : rect.bottom + POPOVER_GAP;
    const centerX = rect.left + rect.width / 2;
    setPos({ top, left: centerX });
  }, [visible, rect]);

  if (!visible || !pos) return null;

  return (
    <div
      role="toolbar"
      aria-label="선택한 구절 액션"
      onClick={(e) => e.stopPropagation()}
      className="fixed z-[60] -translate-x-1/2 flex items-center gap-1 rounded-full bg-ink shadow-lg px-1.5 py-1 animate-fade-opacity"
      style={{ top: pos.top, left: pos.left, height: POPOVER_HEIGHT }}
    >
      <button
        type="button"
        onClick={onHighlight}
        className="flex items-center gap-1.5 px-3 h-9 rounded-full text-sm text-surface-elevated font-medium hover:bg-white/10 active:bg-white/20 transition-colors whitespace-nowrap"
      >
        <Highlighter size={16} />
        하이라이트
      </button>
      <div className="w-px h-5 bg-surface-elevated/20" aria-hidden />
      <button
        type="button"
        onClick={onMemo}
        className="flex items-center gap-1.5 px-3 h-9 rounded-full text-sm text-surface-elevated font-medium hover:bg-white/10 active:bg-white/20 transition-colors whitespace-nowrap"
      >
        <MessageSquarePlus size={16} />
        메모
      </button>
      <div className="w-px h-5 bg-surface-elevated/20" aria-hidden />
      <button
        type="button"
        onClick={onAsk}
        className="flex items-center gap-1.5 px-3 h-9 rounded-full text-sm text-surface-elevated font-medium hover:bg-white/10 active:bg-white/20 transition-colors whitespace-nowrap"
      >
        <MessageCircleQuestion size={16} />
        묻기
      </button>
    </div>
  );
}
