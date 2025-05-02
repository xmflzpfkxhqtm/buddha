'use client';

import { useSoundStore } from '@/stores/useSoundStore'
import { Volume2, VolumeX } from 'lucide-react'
import Image from 'next/image'
import { useEffect, useState } from 'react'

export default function ScrollHeader() {
  const [shouldSway, setShouldSway] = useState(false)
  const { soundEnabled, toggleSound } = useSoundStore()

  useEffect(() => {
    const handleTouch = () => {
      setShouldSway(true)
      setTimeout(() => setShouldSway(false), 2000)
    }

    window.addEventListener('touchstart', handleTouch)
    window.addEventListener('scroll', handleTouch)

    return () => {
      window.removeEventListener('touchstart', handleTouch)
      window.removeEventListener('scroll', handleTouch)
    }
  }, [])

  return (
    <header className="w-full max-w-[460px] h-[128px] mx-auto mb-4 relative">
      {/* 우측 상단 사운드 버튼 */}
      <button
        onClick={toggleSound}
        className="absolute top-8 right-2 z-20 text-beige hover:text-red"
      >
        {soundEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
      </button>

      <div className="w-full h-full flex items-end justify-center">
        <Image
          src="/logo.png"
          alt="로고"
          width={80}
          height={80}
          className={`object-contain rounded-3xl z-10 ${shouldSway ? 'animate-sway' : ''}`}
        />
      </div>
      <h1 className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xl font-bold text-[#4B3B2A] drop-shadow">
        연등
      </h1>
    </header>
  )
}
