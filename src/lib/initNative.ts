import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export async function initNative() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // 1. 상태바가 WebView 위에 올라오게 (overlay = true)
    await StatusBar.setOverlaysWebView({ overlay: true });

    // 2. 배경을 완전 투명으로
    await StatusBar.setBackgroundColor({ color: '#00000000' });

    // 3. 아이콘‧글자를 검은색(Dark)으로
    await StatusBar.setStyle({ style: Style.Light });
  } catch (err) {
    console.warn('[initNative] StatusBar 설정 실패', err);
  }
}
