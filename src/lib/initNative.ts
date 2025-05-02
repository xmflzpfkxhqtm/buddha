import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

/** iOS·Android 네이티브 앱에서만 실행 */
export async function initNative() {
  if (!Capacitor.isNativePlatform()) return;          // 브라우저/PWA일 때 건너뜀

  try {
    // 상태바 스타일 설정
    await StatusBar.setStyle({ style: Style.Light });
    
    // 상태바가 웹뷰를 덮지 않도록 설정
    await StatusBar.setOverlaysWebView({ overlay: false });
    
    // iOS에서 상태바 배경색 설정
    if (Capacitor.getPlatform() === 'ios') {
      await StatusBar.setBackgroundColor({ color: '#F5F1E6' });
    }

    // 뷰포트 크기 로깅
    console.log('Viewport width:', window.innerWidth);
    console.log('Device pixel ratio:', window.devicePixelRatio);
  } catch (e) {
    console.warn('StatusBar 설정 실패', e);
  }
}
