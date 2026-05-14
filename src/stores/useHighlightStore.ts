// Reader 가 외부 진입 시 자동 점프할 highlight 위치를 임시 보관.
// dashboard / answer / push / /me/highlights 에서 setHighlight(title, index) + router.push,
// reader (Layer 3) mount 시 pendingTitle === resolvedTitle 이면 해당 sentence 로 scroll + clear.
//
// 옛 useBookmarkStore 의 후계자. interface 동일 (title/index pending pointer).
// Range / 메모는 supabase highlights 테이블에서 직접 read/write.

import { create } from 'zustand';

type HighlightStoreState = {
  title: string | null;
  index: number | null;
  setHighlight: (title: string, index: number) => void;
  clearHighlight: () => void;
};

export const useHighlightStore = create<HighlightStoreState>((set) => ({
  title: null,
  index: null,
  setHighlight: (title, index) => set({ title, index }),
  clearHighlight: () => set({ title: null, index: null }),
}));
