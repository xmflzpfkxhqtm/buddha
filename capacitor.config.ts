import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lotuslantern.app',
  appName: '연등',

  // ✅ iOS 딥링크용 커스텀 스킴 지정
  ios: {
    scheme: 'yeondeung',        // Info.plist의 CFBundleURLSchemes 값과 동일
  },

  // (Android에서 딥링크 스킴을 쓰려면 androidScheme 도 유사하게 추가)

  server: {
    url: 'https://buddha-dusky.vercel.app' // 배포 주소 또는 로컬 dev 서버 주소
  }
};

export default config;
