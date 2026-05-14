// Reader (Layer 3) 사용자 설정. localStorage 영속.
// - lineHighlight: 현재 보고 있는 줄을 amber background 로 표시할지 여부.
//   OFF 라도 TTS 재생 중일 때는 Layer 3 가 자체적으로 강제 표시 (재생 위치 시각 sync).

import { create } from 'zustand';

const LINE_HIGHLIGHT_KEY = 'reader-line-highlight';

interface ReaderSettingsState {
  lineHighlight: boolean;
  setLineHighlight: (v: boolean) => void;
  /** mount 시 한 번 호출해서 localStorage 값으로 hydrate. SSR 안전. */
  hydrate: () => void;
}

export const useReaderSettingsStore = create<ReaderSettingsState>((set) => ({
  lineHighlight: true, // SSR / 첫 render default
  setLineHighlight: (v) => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(LINE_HIGHLIGHT_KEY, v ? '1' : '0');
      } catch {
        /* quota / 미가용 무시 */
      }
    }
    set({ lineHighlight: v });
  },
  hydrate: () => {
    if (typeof window === 'undefined') return;
    try {
      const v = window.localStorage.getItem(LINE_HIGHLIGHT_KEY);
      if (v === null) return; // default 유지 (ON)
      set({ lineHighlight: v === '1' });
    } catch {
      /* noop */
    }
  },
}));
