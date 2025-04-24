// ✅ server component 유지 (❌ use client X)
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import PageTransition from '../../components/PageTransition';
import MarbleOverlay from '../../components/Overlay';
import BottomNav from '../../components/BottomNav';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: '연등',
  description: '내 손안의 작은 법당',
  icons: {
    icon: '/favicon.ico', // ✅ 여기에 경로 지정
  },

};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
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
        suppressHydrationWarning={true}
      >
        <div className="relative min-h-screen w-full max-w-[430px] mx-auto pb-[64px]">
          <PageTransition>{children}</PageTransition>
        </div>
        <BottomNav /> {/* 표시 여부는 내부에서 제어 */}
        <MarbleOverlay />
      </body>
    </html>
  );
}
