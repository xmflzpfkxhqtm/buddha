// 불경 탭 — 마지막으로 본 scripture 화면을 기억.
// BottomNav 가 다른 탭 → 불경 탭 전환 시 이 path 로 복귀.
// 같은 불경 탭 재터치 시는 무시하고 Layer 1 (/scripture/v2) 으로 reset.

import { create } from 'zustand';

interface ScriptureNavState {
  lastPath: string | null;
  setLastPath: (path: string) => void;
}

export const useScriptureNavStore = create<ScriptureNavState>((set) => ({
  lastPath: null,
  setLastPath: (path) => set({ lastPath: path }),
}));
