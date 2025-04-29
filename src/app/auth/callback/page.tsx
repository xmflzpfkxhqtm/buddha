'use client';
export const dynamic = 'force-dynamic'; // or 'force-no-static'

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleSession = async () => {
      const access_token = searchParams.get('access_token');
      const refresh_token = searchParams.get('refresh_token');

      if (access_token && refresh_token) {
        const { data, error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (!error && data.session) {
          router.push('/me');
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.push('/me');
      } else {
        router.push('/login');
      }
    };

    handleSession();
  }, [router, searchParams]);

  return (
    <main className="flex justify-center items-center min-h-screen">
      <p>로그인 처리 중...</p>
    </main>
  );
}
