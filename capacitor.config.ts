import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lotuslantern.app',
  appName: '연등',
  // 현재 webDir: 'public'으로 설정되어 있는데, SSR/API 라우트를 사용하므로
  // 이 설정은 필요 없으며 'server' 설정을 사용해야 합니다.
  // 이 줄(webDir: 'public',)은 삭제하거나 아래처럼 주석 처리합니다.
  // webDir: 'public',

  // 배포된 Next.js 앱의 URL을 로드하기 위한 server 설정 추가
  server: {
    url: 'https://buddha-dusky.vercel.app' // <--- **이 부분을 실제 웹사이트 주소로 바꿔주세요**
    // 예시: 'https://your-deployed-nextjs-app.com' 또는 'https://your-app-name.vercel.app'
    // 로컬에서 테스트하고 싶다면 'http://localhost:3000' (개발 서버 실행 중일 때) 로 설정할 수도 있습니다.

    // 필요에 따라 추가 설정 가능:
    // androidScheme: 'https', // Android에서 사용할 스킴 (기본값: http, https)
    // allowNavigation: ['your-domain.com', 'another-allowed-domain.com'] // WebView 내에서 특정 외부 도메인 탐색 허용
  }
};

export default config;