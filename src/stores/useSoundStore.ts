import { create } from 'zustand'

interface SoundStore {
  soundEnabled: boolean
  toggleSound: () => void
  setSound: (value: boolean) => void
}

export const useSoundStore = create<SoundStore>((set) => {
  // 브라우저 환경에서 localStorage 접근 (SSR 대응)
  const initial =
    typeof window !== 'undefined'
      ? localStorage.getItem('sound') !== 'false' // 기본값 true
      : true

  return {
    soundEnabled: initial,
    toggleSound: () =>
      set((state) => {
        const newValue = !state.soundEnabled
        localStorage.setItem('sound', String(newValue))
        return { soundEnabled: newValue }
      }),
    setSound: (value: boolean) => {
      localStorage.setItem('sound', String(value))
      set({ soundEnabled: value })
    },
  }
})
