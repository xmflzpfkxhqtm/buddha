import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

/** 네이티브 앱에서 1회 호출 */
export async function initNative() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    /* 1) WebView 가 status bar 아래까지 확장되도록 (Android). iOS 는 layout 의 viewport-fit=cover
          + apple-mobile-web-app-status-bar-style=black-translucent 메타로 동일 효과. */
    await StatusBar.setOverlaysWebView({ overlay: true });

    /* 2) Android 한정: 기본 상태바 배경(흰 페이지용 베이지). 페이지별로 덮어씀. */
    await StatusBar.setBackgroundColor({ color: '#f8f5ee' });

    /* 3) 흰 배경 페이지가 기본이라 어두운 아이콘. dashboard 등 어두운 배경 페이지는 자체적으로 Light 로 변경. */
    await StatusBar.setStyle({ style: Style.Dark });
  } catch (err) {
    console.warn('[initNative] StatusBar 설정 실패:', err);
  }
}
