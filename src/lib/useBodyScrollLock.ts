// 모달/sheet open 시 body 스크롤 잠금. iOS WKWebView 까지 확실하게.
// 표준 패턴: position: fixed + top: -scrollY → close 시 scroll 위치 복원.
// 단순 overflow: hidden 만으로는 iOS Safari/WebView 일부에서 안 먹음.
//
// close 시 jump 방지:
//   globals.css 의 html { scroll-behavior: smooth } 때문에 scroll 복원이
//   "최상단 → 원래 위치" smooth scroll 로 보임. cleanup 동안 임시로
//   scroll-behavior: auto 강제 → instant jump (시각적으로 보이지 않음).

'use client';
import { useEffect } from 'react';

export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    if (typeof window === 'undefined') return;

    const scrollY = window.scrollY;
    const body = document.body;
    const html = document.documentElement;
    const prev = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';

    return () => {
      // smooth scroll 임시 비활성 — globals.css 의 html { scroll-behavior: smooth }
      // 가 scrollTo 를 smooth 처리해서 visible jump (top → original) 가 보이는 것 방지.
      const prevBehavior = html.style.scrollBehavior;
      html.style.scrollBehavior = 'auto';

      body.style.overflow = prev.overflow;
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;

      window.scrollTo(0, scrollY);

      // 다음 frame 에 scroll-behavior 원복 (이후 사용자 scroll 동작은 그대로 smooth)
      requestAnimationFrame(() => {
        html.style.scrollBehavior = prevBehavior;
      });
    };
  }, [active]);
}
