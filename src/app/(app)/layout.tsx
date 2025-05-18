'use client';

import { useEffect } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useRouter } from 'next/navigation';

import '../globals.css';

import PushProvider     from '../../../components/PushProvider';
import PushDebug        from '../../../components/PushDebug';
import PageTransition   from '../../../components/PageTransition';
import MarbleOverlay    from '../../../components/Overlay';
import BottomNav        from '../../../components/BottomNav';
import DeepLinkHandler  from '../../../components/DeepLinkHandler';
import NativeInit       from '../../../components/NativeInit';
import TopNav           from '../../../components/TopNav';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let lastBackgroundTime: number | null = null;

    App.addListener('appStateChange', ({ isActive }) => {
      const now = Date.now();

      if (!isActive) {
        // 앱이 백그라운드로 갈 때
        lastBackgroundTime = now;
      } else {
        // 앱이 포그라운드로 돌아왔을 때
        if (lastBackgroundTime && now - lastBackgroundTime > 3000000) {
          router.replace('/'); // reload 대신 내부 라우팅
        }
      }
    });
  }, [router]);

  return (
    <html lang="ko">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#F5F1E6" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="연등" />
        <link rel="apple-touch-icon" href="/icon.png" />
        <link rel="icon" href="/favicon.ico" />
      </head>

      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <NativeInit />
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
      </body>
    </html>
  );
}
