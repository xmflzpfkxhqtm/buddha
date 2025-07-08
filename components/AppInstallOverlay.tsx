'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function AppInstallOverlay() {
  const pathname = usePathname()
  const [isNative, setIsNative] = useState(false)

  // Capacitor 네이티브 앱 환경인지 확인
  useEffect(() => {
    const userAgent = navigator.userAgent || ''
    const isCapacitor = userAgent.includes('Capacitor') || userAgent.includes('wv') || userAgent.includes('YeondeungApp')
    setIsNative(isCapacitor)
  }, [])

  const shouldHide =
    pathname === '/' ||
    pathname.startsWith('/answer') ||
    isNative

  if (shouldHide) return null

  return (
    <div className="fixed inset-0 z-[9999] backdrop-blur-sm bg-black/30 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-[80%] text-center space-y-4">
        <p className="text-lg font-semibold leading-relaxed">
          연등 앱을 설치하고<br />
          마음 속 연등을 밝혀보세요
        </p>
        <a
          href="https://yeondeung.com" // 실제 앱 설치 링크
          className="inline-block px-4 py-2 bg-red-light text-white rounded-md text-sm font-medium"
        >
          앱 설치하기
        </a>
      </div>
    </div>
  )
}
