'use client';
export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const run = async () => {
      const access_token = searchParams.get('access_token');
      const refresh_token = searchParams.get('refresh_token');

      if (access_token && refresh_token) {
        const { data, error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (error) {
          console.error('Session set 실패', error);
          router.replace('/login');
          return;
        }

        if (data.session) {
          router.replace('/me');
          return;
        }
      } else {
        // token이 URL에 없으면, 기존 세션으로 로그인 시도
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          router.replace('/me');
        } else {
          router.replace('/login');
        }
      }
    };

    run();
  }, [router, searchParams]);

  return (
    <main className="flex justify-center items-center min-h-screen">
      <p>로그인 처리 중...</p>
    </main>
  );
}
