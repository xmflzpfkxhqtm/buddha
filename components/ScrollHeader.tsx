'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

export default function ScrollHeader() {
  const [visible, setVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setVisible(false); // 아래로 스크롤 → 헤더 숨김
      } else {
        setVisible(true); // 위로 스크롤 → 헤더 보임
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  return (
<header
  className={`fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] h-[192px] z-50 transition-transform duration-300 overflow-hidden ${
    visible ? 'translate-y-0' : '-translate-y-full'
  }`}
>

<div className="w-full h-full flex items-center justify-center">
<Image
  src="/logo.png"
  alt="로고"
  width={96}
  height={96}
  className="object-contain rounded-3xl border-1 border-beige"
/>

      </div>
  {/* 실제 콘텐츠 */}
  <div className="relative z-10 flex items-center justify-center h-full">
    <h1 className="text-xl font-bold text-[#4B3B2A] drop-shadow">
      연등
    </h1>

      </div>
    </header>
  );
}
