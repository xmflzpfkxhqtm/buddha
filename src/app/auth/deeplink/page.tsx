'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function AuthDeepLinkPage() {
  useEffect(() => {
    const tryRedirect = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Session fetch error:', error);
          return;
        }

        if (data?.session) {
          window.location.href = 'yeondeung://auth/callback';
        } else {
          alert('로그인에 실패했거나 취소되었습니다.');
        }
      } catch (err) {
        console.error('Unhandled exception in deeplink redirect:', err);
        alert('예상치 못한 오류가 발생했습니다.');
      }
    };

    tryRedirect();
  }, []);

  return (
    <main className="flex justify-center items-center min-h-screen">
      <p>앱으로 돌아가는 중...</p>
    </main>
  );
}
