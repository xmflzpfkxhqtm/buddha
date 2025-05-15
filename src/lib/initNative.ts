// src/lib/initNative.ts
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

/** iOS·Android 네이티브 앱에서만 실행되는 초기화 */
export async function initNative() {
  if (!Capacitor.isNativePlatform()) return;          // 웹/PWA면 스킵

  try {
    /* 1️⃣ 먼저 WebView를 상태바 아래로 내려서 겹침 방지 */
    await StatusBar.setOverlaysWebView({ overlay: false });

    /* 2️⃣ 배경 + 아이콘 색 한꺼번에 맞추기
          - 밝은 배경(#F5F1E6)이므로 Dark 아이콘이 가독성↑
          - setBackgroundColor는 iOS·Android 모두 지원 (Capacitor 5)  */
    const BG = '#f8f5ee';
    await StatusBar.setBackgroundColor({ color: BG });
    await StatusBar.setStyle({ style: Style.Dark });

    /* 3️⃣ (선택) 디버그용 뷰포트 로그 */
    if (process.env.NODE_ENV === 'development') {
      console.log('[initNative] viewport', window.innerWidth, 'dpr', window.devicePixelRatio);
    }
  } catch (err) {
    console.warn('[initNative] StatusBar 설정 실패:', err);
  }
}
