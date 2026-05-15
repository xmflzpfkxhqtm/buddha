// 텍스트 선택 시 화면 하단에 고정 표시되는 액션 bar.
// 액션: "하이라이트" (즉시 저장) / "메모" (HighlightSheet 열기) / "묻기" (ask 페이지 인용 prefill).
//
// 이전 버전은 selection rect 기준 위/아래 popover 였으나 OS native menu (iOS UIEditMenu /
// Android ActionMode) 와 같은 공간에서 그려져 가려지는 문제가 있어 하단 고정으로 분리.
// 공간이 분리되므로 OS menu 와 우리 FAB 가 동시 표시되어도 서로 가리지 않음.

'use client';
import { Highlighter, MessageSquarePlus, MessageCircleQuestion } from 'lucide-react';

export default function FloatingActionBar({
  visible,
  onHighlight,
  onMemo,
  onAsk,
}: {
  visible: boolean;
  /** 호환성을 위해 prop 은 유지하지만 사용하지 않음. 하단 고정 bar 라 selection rect 불필요. */
  rect?: DOMRect | null;
  onHighlight: () => void;
  onMemo: () => void;
  onAsk: () => void;
}) {
  if (!visible) return null;

  return (
    <div
      role="toolbar"
      aria-label="선택한 구절 액션"
      onClick={(e) => e.stopPropagation()}
      className="fixed left-1/2 -translate-x-1/2 z-[60] flex items-center gap-1 rounded-full bg-ink shadow-lg px-1.5 py-1 animate-fade-opacity"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 90px)', height: 44 }}
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
