'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function AuthDeepLinkPage() {
  useEffect(() => {
    const tryRedirect = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error || !data.session) {
          alert('로그인 실패');
          return;
        }

        const { access_token, refresh_token } = data.session;

        // 앱 딥링크로 access_token 전달
        const deeplink = `yeondeung://auth/callback?access_token=${access_token}&refresh_token=${refresh_token}`;
        window.location.href = deeplink;
      } catch (err) {
        console.error('DeepLink error:', err);
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
