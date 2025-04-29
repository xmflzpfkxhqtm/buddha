'use client';
export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import AuthCallbackInner from './AuthCallbackInner';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // ✅ 해시로 온 경우 강제로 쿼리로 바꿔주기
    if (typeof window !== 'undefined' && window.location.hash.startsWith('#access_token=')) {
      const qs = window.location.hash.substring(1); // '#' 제거
      const newUrl = `${window.location.pathname}?${qs}`;
      window.location.replace(newUrl); // 쿼리로 리로드
    }
  }, []);

  return (
    <Suspense fallback={<p className="text-center p-8">로그인 처리 중...</p>}>
      <AuthCallbackInner />
    </Suspense>
  );
}
