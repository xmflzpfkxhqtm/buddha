'use client';

import Image from 'next/image';
import MarbleOverlay from './Overlay'; // ✅ 오버레이 가져오기

export default function Loading({ fadeOut = false }: { fadeOut?: boolean }) {
  const message = fadeOut
    ? '부처님께서 말씀을 내리시는 중입니다.'
    : '마음의 소리에 귀를 기울이는 중입니다.\n당신의 물음이 조용히 울리고 있습니다.';

  return (
    <div
      className={`relative flex flex-col justify-center text-base items-center h-screen bg-red text-white
        transition-opacity duration-1500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
    >
      {/* ✅ 연등 효과 등 위에 깔기 */}
      <MarbleOverlay />

      {/* ✅ 로딩 내용은 위로 */}
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
