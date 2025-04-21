'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import MarbleOverlay from './Overlay';
import { useSoundStore } from '@/stores/useSoundStore'; // ✅ 추가

export default function Loading({ fadeOut = false }: { fadeOut?: boolean }) {
  const message = fadeOut
    ? '부처님께서 말씀을 내리시는 중입니다.'
    : '마음의 소리에 귀를 기울이는 중입니다.\n당신의 물음이 조용히 울리고 있습니다.';

  const { soundEnabled } = useSoundStore(); // ✅ 소리 설정 가져오기

  useEffect(() => {
    if (soundEnabled) {
      const audio = new Audio('/sounds/moktak.wav');
      audio.volume = 0.6;
      audio.play().catch((e) => {
        console.warn('목탁 소리 재생 실패:', e);
      });
    }
  }, [soundEnabled]); // ✅ 상태 반영

  return (
    <div
      className={`relative flex flex-col justify-center text-base items-center h-screen bg-red text-white
        transition-opacity duration-1500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
    >
      <MarbleOverlay />

      <div className="text-5xl animate-float mb-4 z-10">
        <Image
          src="/lotusbeige.png"
          alt="lotus"
          width={48}
          height={48}
          className="object-contain border-beige mx-2"
        />
      </div>

      <p className="text-base font-semibold text-center tracking-wide animate-fadeIn px-6 whitespace-pre-line z-10">
        {message}
      </p>
    </div>
  );
}
