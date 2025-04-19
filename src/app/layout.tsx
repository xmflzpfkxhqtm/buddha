import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PageTransition from "../../components/PageTransition";
import MarbleOverlay from "../../components/Overlay";
import BottomNav from "../../components/BottomNav"; // ✅ 추가

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "연등",
  description: "내 손안의 작은 법당",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
       <head>
        {/* 👇👇👇 추가 부분 시작 */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#F5F1E6" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="연등" />
        <link rel="apple-touch-icon" href="/icon.png" />
        {/* 👆👆👆 추가 부분 끝 */}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning={true}
      >
        {/* ✅ 메인 콘텐츠 */}
        <div className="relative min-h-screen w-full max-w-[430px] mx-auto pb-[64px]">
          <PageTransition>{children}</PageTransition>
        </div>

        {/* ✅ 하단바 고정 */}
        <BottomNav />

        {/* ✅ MarbleOverlay는 최하단 */}
        <MarbleOverlay />
      </body>
    </html>
  );
}
