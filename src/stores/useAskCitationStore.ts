// 경전 selection → /ask 페이지로 인용 컨텍스트 전달 (휘발성).
// /ask 페이지가 mount 시 consume 으로 가져가서 사용 + clear.
// URL query string 대신 store — 긴 selection / 한도 / encoding 안전.

import { create } from 'zustand';

export type AskCitation = {
  text: string;             // 사용자가 선택한 정확한 인용 텍스트
  scriptureTitle: string;   // 옛 형식 — '금강반야바라밀경_K0013_1권'
  groupKey: string;
  volumeNo: number;
  startSentence: number;
  endSentence: number;
};

interface AskCitationState {
  pending: AskCitation | null;
  setPending: (c: AskCitation | null) => void;
  /** 한 번 가져가면서 동시에 clear. ask 페이지가 useEffect 한 번만 처리. */
  consume: () => AskCitation | null;
}

export const useAskCitationStore = create<AskCitationState>((set, get) => ({
  pending: null,
  setPending: (c) => set({ pending: c }),
  consume: () => {
    const c = get().pending;
    if (c) set({ pending: null });
    return c;
  },
}));
