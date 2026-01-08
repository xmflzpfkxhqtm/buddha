// src/app/(site)/layout.tsx
import '../globals.css';
import type { Metadata } from 'next';

const siteUrl = 'https://yeondeung.com';

export const metadata: Metadata = {
  title: '연등 – AI 부처님과 마음공부 | 팔만대장경 기반 불교 AI',
  description:
    '팔만대장경 5천만 자 기반 AI 부처님이 당신의 물음에 응답합니다. 고민 상담, 불경 읽기, 마음공부를 연등 앱에서 시작하세요.',
  keywords: [
    '연등',
    'AI 부처님',
    '불교 AI',
    '팔만대장경',
    '마음공부',
    '명상',
    '불교 상담',
    '불경',
    '부처님 말씀',
    '법문',
    '심리 상담',
    '마음 치유',
  ],
  authors: [{ name: 'Yeondeung', url: siteUrl }],
  creator: 'Yeondeung',
  publisher: 'Yeondeung',
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    other: [
      { rel: 'icon', url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { rel: 'icon', url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: siteUrl,
    siteName: '연등',
    title: '연등 – AI 부처님과 마음공부',
    description:
      '팔만대장경 5천만 자 기반 AI 부처님이 당신의 물음에 응답합니다. 고민 상담, 불경 읽기, 마음공부를 연등 앱에서 시작하세요.',
    images: [
      {
        url: '/graphic.png',
        width: 1200,
        height: 630,
        alt: '연등 - AI 부처님과 마음공부',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '연등 – AI 부처님과 마음공부',
    description:
      '팔만대장경 5천만 자 기반 AI 부처님이 당신의 물음에 응답합니다.',
    images: ['/graphic.png'],
  },
  robots: {
    index: true,
    follow: false,
    googleBot: {
      index: true,
      follow: false,
    },
  },
  verification: {
    google: 'google427009c19a4cd557',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '연등',
  },
  formatDetection: {
    telephone: false,
  },
  category: 'spirituality',
};

export default function SiteLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="scroll-smooth">   {/* ← smooth 스크롤 */}
      <body className="bg-black text-white antialiased">
        {children}
      </body>
    </html>
  );
}
