// src/app/(site)/layout.tsx
import '../globals.css';                // ⭐️ Tailwind 전역
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '연등 – 부처님 AI',
  description: '팔만대장경 기반 부처님 AI',
};

export default function SiteLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-black text-white antialiased">
        {children}
      </body>
    </html>
  );
}
