// src/stores/useChromeStore.ts
// Reader (Layer 3) 의 chrome 상태를 글로벌 컴포넌트 (BottomNav) 와 공유.
// Layer 3 가 scroll 방향에 따라 setVisible 호출, BottomNav 가 구독해서 hide/show.
// 다른 페이지는 store 변경 안 하므로 항상 true (default).

import { create } from 'zustand';

interface ChromeState {
  visible: boolean;
  setVisible: (v: boolean) => void;
}

export const useChromeStore = create<ChromeState>((set) => ({
  visible: true,
  setVisible: (v) => set({ visible: v }),
}));
