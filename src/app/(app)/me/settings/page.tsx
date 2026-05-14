'use client';

import { useSoundStore } from '@/stores/useSoundStore'; // ✅ Zustand store import
import { useReaderSettingsStore } from '@/stores/useReaderSettingsStore';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export default function SettingsPage() {
  const { soundEnabled, toggleSound } = useSoundStore(); // ✅ Zustand에서 상태와 토글 함수 가져오기
  const lineHighlight = useReaderSettingsStore((s) => s.lineHighlight);
  const setLineHighlight = useReaderSettingsStore((s) => s.setLineHighlight);
  const hydrateReaderSettings = useReaderSettingsStore((s) => s.hydrate);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // next-themes 는 client-only 라 hydration 후에만 정확한 theme 값을 반환.
  useEffect(() => setMounted(true), []);
  // localStorage 의 reader 설정 hydrate
  useEffect(() => hydrateReaderSettings(), [hydrateReaderSettings]);
  const isDark = mounted && theme === 'dark';

  return (
    <main className="min-h-screen max-w-[430px] mx-auto bg-surface-elevated px-6 py-10">
      <div className="flex items-center justify-between py-4">
        <span className="text-ink">소리 켜기</span>
        <button
          onClick={toggleSound}
          className={`w-12 h-6 flex items-center rounded-full p-1 transition-all duration-300 ${
            soundEnabled ? 'bg-accent' : 'bg-line-strong'
          }`}
        >
          <div
            className={`bg-surface-elevated w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out ${
              soundEnabled ? 'translate-x-6' : ''
            }`}
          />
        </button>
      </div>

      <div className="flex items-center justify-between py-4">
        <span className="text-ink">다크 모드</span>
        <button
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className={`w-12 h-6 flex items-center rounded-full p-1 transition-all duration-300 ${
            isDark ? 'bg-accent' : 'bg-line-strong'
          }`}
          aria-label="다크 모드 전환"
        >
          <div
            className={`bg-surface-elevated w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out ${
              isDark ? 'translate-x-6' : ''
            }`}
          />
        </button>
      </div>

      <div className="flex items-center justify-between py-4">
        <div className="pr-4">
          <span className="text-ink block">읽는 줄 강조</span>
          <span className="text-xs text-ink-muted">
            끄면 TTS 재생 중에만 강조됩니다.
          </span>
        </div>
        <button
          onClick={() => setLineHighlight(!lineHighlight)}
          className={`shrink-0 w-12 h-6 flex items-center rounded-full p-1 transition-all duration-300 ${
            lineHighlight ? 'bg-accent' : 'bg-line-strong'
          }`}
          aria-label="읽는 줄 강조 전환"
        >
          <div
            className={`bg-surface-elevated w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out ${
              lineHighlight ? 'translate-x-6' : ''
            }`}
          />
        </button>
      </div>

      {/* 📌 여기에 다른 설정 옵션을 계속 추가할 수 있습니다 */}
    </main>
  );
}
