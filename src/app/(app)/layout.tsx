import { Geist, Geist_Mono } from 'next/font/google';
import AppInstallOverlay from '../../../components/AppInstallOverlay'

import '../globals.css';

import PushProvider     from '../../../components/PushProvider';
import PushDebug        from '../../../components/PushDebug';
import PageTransition   from '../../../components/PageTransition';
import MarbleOverlay    from '../../../components/Overlay';
import BottomNav        from '../../../components/BottomNav';
import DeepLinkHandler  from '../../../components/DeepLinkHandler';
import NativeInit       from '../../../components/NativeInit';
import TopNav           from '../../../components/TopNav';
import AppStateRedirect from '../../../components/AppStateRedirect';
import UpdateBlocker    from '../../../components/UpdateBlocker';   // ★ iOS 강제 업데이트
import ReviewPrompt     from '../../../components/ReviewPrompt';
import ThemeProvider    from '../../../components/ThemeProvider';

const geistSans = Geist({ variable: '--font-geist-sans',  subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#F5F1E6" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        {/* default: 아이콘 색은 StatusBar.setStyle(Light/Dark) 로 페이지마다 제어.
            black-translucent 로 두면 iOS 가 항상 흰 아이콘을 강제하여 흰 페이지에서 안 보임. */}
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="연등" />
        <link rel="apple-touch-icon" href="/icon.png" />
        <link rel="icon" href="/favicon.ico" />
      </head>

      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        {/* next-themes: html 의 class 에 'light'/'dark' 를 적용. 토글은 useTheme() 로 제어.
            지금은 기본값 light, system 자동 감지는 끔 (의도적인 사용자 토글로만 변경되도록). */}
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <AppStateRedirect />
          <NativeInit />
          <ReviewPrompt />
          <TopNav className="top-nav-safe" />

          {/* ───────── PUSH ───────── */}
          <PushProvider>
            <PushDebug />
            <div className="relative min-h-screen w-full max-w-[460px] mx-auto pb-[64px]">
              <PageTransition>{children}</PageTransition>
            </div>
          </PushProvider>

          <DeepLinkHandler />
          <BottomNav />
          <MarbleOverlay />
          <AppInstallOverlay />

          {/* iOS 필수 업데이트 오버레이 */}
          <UpdateBlocker />
        </ThemeProvider>
      </body>
    </html>
  );
}
