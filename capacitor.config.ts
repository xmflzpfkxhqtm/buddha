import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lotus.lantern',
  appName: '연등',

  /* ───────── iOS 설정 ───────── */
  ios: {
    scheme: 'yeondeung',        // 딥링크용 커스텀 스킴
    appendUserAgent: ' YeondeungApp',   // ← 추가될 문자열 (앞에 공백 하나 필수)
  },

  /* ───────── Android 설정 ───────── */
  android: {
    appendUserAgent: ' YeondeungApp',   // Android WebView도 동일 문자열 추가
  },

  /* ───────── 배포 서버 주소 ───────── */
  server: {
    url: 'https://buddha-dusky.vercel.app/dashboard',
    allowNavigation: ['buddha-dusky.vercel.app'], // ⭐ 반드시 명시
    cleartext: true
  },
};

export default config;
