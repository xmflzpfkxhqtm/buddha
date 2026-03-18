'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function AppInstallOverlay() {
  const pathname = usePathname()
  const [isNative, setIsNative] = useState(false)
  const [secretInput, setSecretInput] = useState('')
  const [showSecretButton, setShowSecretButton] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // Capacitor 환경 판별
  useEffect(() => {
    const ua = navigator.userAgent
    const isCap = ua.includes('Capacitor') || ua.includes('wv') || ua.includes('YeondeungApp')
    setIsNative(isCap)
  }, [])

  // 치트키 입력 감지 ('open')
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      const next = (secretInput + e.key).slice(-20).toLowerCase()
      setSecretInput(next)

      if (next.includes('open')) {
        setShowSecretButton(true)
      }
    }

    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [secretInput])

  // 처음에 localStorage 체크
  useEffect(() => {
    const flag = localStorage.getItem('appOverlayDismissed')
    if (flag === 'true') setDismissed(true)
  }, [])

  // 오버레이 끄기 처리
  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem('appOverlayDismissed', 'true')
  }

  // TODO: 웹 접근 허용을 위해 일시적으로 비활성화
  return null

  // 표시 조건
  // const shouldHide =
  //   pathname === '/' ||
  //   pathname.startsWith('/answer') ||
  //   isNative ||
  //   dismissed

  // if (shouldHide) return null

  return (
    <div className="fixed inset-0 z-[9999] backdrop-blur-sm bg-black/30 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-[80%] text-center space-y-4 relative">
        <p className="text-lg font-semibold leading-relaxed">
          연등 앱을 설치하고<br />
          마음 속 연등을 밝혀보세요
        </p>
        <a
          href="https://yeondeung.com"
          className="inline-block px-4 py-2 bg-red-light text-white rounded-md text-sm font-medium"
        >
          앱 설치하기
        </a>

        {showSecretButton && (
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 text-xs text-red-500 border border-red-300 px-2 py-1 rounded hover:bg-red-100"
          >
            🔓 오버레이 끄기
          </button>
        )}
      </div>
    </div>
  )
}
