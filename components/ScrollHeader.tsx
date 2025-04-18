'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

export default function ScrollHeader() {
  const [shouldSway, setShouldSway] = useState(false);

  useEffect(() => {
    const handleTouch = () => {
      setShouldSway(true);
      setTimeout(() => setShouldSway(false), 2000); // 2초 동안 흔들림
    };

    window.addEventListener('touchstart', handleTouch);
    window.addEventListener('scroll', handleTouch);

    return () => {
      window.removeEventListener('touchstart', handleTouch);
      window.removeEventListener('scroll', handleTouch);
    };
  }, []);

  return (
    <header className="w-full max-w-[430px] h-[128px] mx-auto mb-4 relative">
      <div className="w-full h-full flex items-end justify-center">
        <Image
          src="/logo.png"
          alt="로고"
          width={96}
          height={96}
          className={`object-contain rounded-3xl border-1 border-beige z-10 ${shouldSway ? 'animate-sway' : ''}`}
        />
      </div>
      <h1 className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xl font-bold text-[#4B3B2A] drop-shadow">
        연등
      </h1>
    </header>
  );
}