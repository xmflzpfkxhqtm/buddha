'use client';

import { useEffect, useState } from 'react';

export default function Loading({ fadeOut = false }: { fadeOut?: boolean }) {
  return (
    <div
      className={`flex flex-col justify-center items-center h-screen bg-[#F5F1E6] text-[#3E3E3E]
        transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
    >
      <div className="text-5xl animate-float mb-4">🪷</div>
      <p className="text-xl font-bold text-center tracking-wide animate-fadeIn px-6">
        마음의 소리에 귀 기울이는 중입니다.<br />
        당신의 물음이 조용히 울리고 있습니다.
      </p>
    </div>
  );
}
