import { create } from 'zustand';
import { lsGet, lsSet } from '@/lib/localStorage';

interface SoundStore {
  soundEnabled: boolean;
  toggleSound: () => void;
  setSound: (value: boolean) => void;
}

export const useSoundStore = create<SoundStore>((set) => ({
  soundEnabled: lsGet('sound') !== 'false', // 기본값 true
  toggleSound: () =>
    set((state) => {
      const newValue = !state.soundEnabled;
      lsSet('sound', String(newValue));
      return { soundEnabled: newValue };
    }),
  setSound: (value) => {
    lsSet('sound', String(value));
    set({ soundEnabled: value });
  },
}));
