'use client';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store'; // ✅ 추가

import { Suspense } from 'react';
import AuthCallbackInner from './AuthCallbackInner';

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <AuthCallbackInner />
    </Suspense>
  );
}

function LoadingScreen() {
  return (
    <main className="flex justify-center items-center min-h-screen">
      <p>로그인 처리 중...</p>
    </main>
  );
}
