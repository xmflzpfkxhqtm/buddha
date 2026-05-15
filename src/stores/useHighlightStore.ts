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
  /** 옵션. 본문 신역으로 index drift 발생한 entry (예: todayTeaching) 가
   *  reader 도착 시 displayTexts 안에서 유사도 최고 match 로 재정렬할 anchor text. */
  sentence: string | null;
  setHighlight: (title: string, index: number, sentence?: string | null) => void;
  clearHighlight: () => void;
};

export const useHighlightStore = create<HighlightStoreState>((set) => ({
  title: null,
  index: null,
  sentence: null,
  setHighlight: (title, index, sentence = null) => set({ title, index, sentence }),
  clearHighlight: () => set({ title: null, index: null, sentence: null }),
}));
