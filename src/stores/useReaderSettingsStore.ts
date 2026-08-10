// Reader (Layer 3) 사용자 설정. localStorage 영속.
// - lineHighlight: 현재 보고 있는 줄을 amber background 로 표시할지 여부.
//   OFF 라도 TTS 재생 중일 때는 Layer 3 가 자체적으로 강제 표시 (재생 위치 시각 sync).

import { create } from 'zustand';
import { lsGet, lsSet } from '@/lib/localStorage';

const KEY = 'reader-line-highlight';

interface ReaderSettingsState {
  lineHighlight: boolean;
  setLineHighlight: (v: boolean) => void;
  /** mount 시 한 번 호출해서 localStorage 값으로 hydrate. SSR 안전. */
  hydrate: () => void;
}

export const useReaderSettingsStore = create<ReaderSettingsState>((set) => ({
  lineHighlight: false, // SSR / 첫 render default
  setLineHighlight: (v) => {
    lsSet(KEY, v ? '1' : '0');
    set({ lineHighlight: v });
  },
  hydrate: () => {
    const v = lsGet(KEY);
    if (v !== null) set({ lineHighlight: v === '1' });
  },
}));
