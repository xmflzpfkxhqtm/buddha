'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

export default function LandingPage() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 100)
    return () => clearTimeout(t)
  }, [])

  return (
    /* 화면을 꽉 채우고 가운데 정렬 */
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#000000] text-pink-light px-5 md:px-8 lg:px-12 overflow-hidden">

      {/* 헤드라인 */}
      <h1
        className={`text-5xl md:text-6xl font-extrabold leading-tight text-center mb-6 md:mb-10 transition-all duration-1000 ease-out
        ${show ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}
      >
        마음 속 연등을<br className="md:hidden" /> 밝혀보세요
      </h1>

      {/* 연등 이미지 */}
      <div
        className={`w-60 md:w-72 lg:w-80 h-auto mb-6 md:mb-10 transition-all duration-[1200ms] ease-out
        ${show ? 'opacity-100 rotate-[0deg] translate-y-0' : 'opacity-0 rotate-[20deg] -translate-y-6'}`}
      >
        <Image src="/graphic.png" alt="연등 이미지" width={640} height={640} priority />
      </div>

      {/* 서브 카피 */}
      <p
        className={`text-lg md:text-xl text-center text-zinc-300 mb-10 md:mb-14 transition-all duration-1000 ease-out delay-300
        ${show ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}
      >
        팔만대장경 바탕의 AI 부처님이<br />
        당신의 물음에 응답합니다
      </p>



      {/* 스토어 버튼 */}
      <div className='flex flex-col items-center justify-center'>

      <p
        className={`text-md md:text-lg text-center text-zinc-300 mb-2 md:mb-4 transition-all duration-1000 ease-out delay-300
        ${show ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}
      >
        지금 마음공부 시작하기
      </p>

      <div className="flex gap-3 md:gap-4">
        <a
          href="https://apps.apple.com/app/id..."
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 md:gap-3 bg-white text-black rounded-xl px-4 py-2 md:px-5 md:py-3 shadow-lg hover:scale-[1.03] transition"
        >
          <Image src="/appstore.svg" alt="App Store" width={20} height={20} />
          <span className="text-sm md:text-base font-medium">App Store</span>
        </a>

        {/* <a
          href="https://play.google.com/store/apps/details?id=..."
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 md:gap-3 bg-white text-black rounded-xl px-4 py-2 md:px-5 md:py-3 shadow-lg hover:scale-[1.03] transition"
        >
          <Image src="/google-play.svg" alt="Google Play" width={20} height={20} />
          <span className="text-sm md:text-base font-medium">Google Play</span>
        </a> */}
      </div>
      </div>
    </div>
  )
}
