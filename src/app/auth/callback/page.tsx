'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleAuth = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (!data.session && !error) {
        // 세션이 없으면 강제로 새로고침 시도
        await supabase.auth.refreshSession();
      }

      const { data: finalSession } = await supabase.auth.getSession();
      if (finalSession.session) {
        router.push('/me');
      } else {
        router.push('/login');
      }
    };

    handleAuth();
  }, [router]);

  return (
    <main className="flex justify-center items-center min-h-screen">
      <p>로그인 처리 중...</p>
    </main>
  );
}
