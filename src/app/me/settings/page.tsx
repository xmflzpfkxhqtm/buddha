'use client';

import { useSoundStore } from '@/stores/useSoundStore'; // ✅ Zustand store import

export default function SettingsPage() {
  const { soundEnabled, toggleSound } = useSoundStore(); // ✅ Zustand에서 상태와 토글 함수 가져오기

  return (
    <main className="min-h-screen max-w-[430px] mx-auto bg-white px-6 py-10">
      <h1 className="text-xl font-bold text-red-dark mb-6">⚙️ 설정</h1>

      <div className="flex items-center justify-between py-4">
        <span className="text-black">소리 켜기</span>
        <button
          onClick={toggleSound}
          className={`w-12 h-6 flex items-center rounded-full p-1 transition-all duration-300 ${
            soundEnabled ? 'bg-red' : 'bg-gray-300'
          }`}
        >
          <div
            className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out ${
              soundEnabled ? 'translate-x-6' : ''
            }`}
          />
        </button>
      </div>

      {/* 📌 여기에 다른 설정 옵션을 계속 추가할 수 있습니다 */}
    </main>
  );
}
