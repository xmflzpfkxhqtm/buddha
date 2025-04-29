'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleAuthCallback = async () => {
      // ✅ Supabase가 세션 갱신하도록 요청
      const { error } = await supabase.auth.getSession();

      if (error) {
        console.error('세션 갱신 실패:', error.message);
        router.push('/login');
        return;
      }

      // ✅ 세션 정상 -> 원하는 곳으로 이동
      router.push('/me');
    };

    handleAuthCallback();
  }, [router]);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-white text-black">
      <p className="text-lg font-medium">로그인 중입니다...</p>
    </main>
  );
}
