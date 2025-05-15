import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

/** 네이티브 앱에서 1회 호출 */
export async function initNative() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    /* 1) WebView를 상태바 ‘아래’에 배치 (safe-area 자동) */
    await StatusBar.setOverlaysWebView({ overlay: false });

    /* 2) 상태바 배경을 투명으로 – 페이지가 흰색이면 그대로 흰색 */
    await StatusBar.setBackgroundColor({ color: '#f8f5ee' });

    /* 3) 밝은 배경용 아이콘 색(Dark) */
    await StatusBar.setStyle({ style: Style.Light });
  } catch (err) {
    console.warn('[initNative] StatusBar 설정 실패:', err);
  }
}
