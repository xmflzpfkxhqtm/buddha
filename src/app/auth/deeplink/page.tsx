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

        const deeplink = `yeondeung://auth/callback?access_token=${access_token}&refresh_token=${refresh_token}`;

        if (isNativeApp()) {
          // ✅ 앱이면 딥링크로
          window.location.href = deeplink;
        } else {
          // ✅ 웹이면 2초 기다렸다가 /auth/callback?~~로 이동
          setTimeout(() => {
            window.location.href = `/auth/callback?access_token=${access_token}&refresh_token=${refresh_token}`;
          }, 2000);
        }
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

// ✅ 앱/웹 구분 함수
function isNativeApp() {
  if (typeof window === 'undefined') return false;
  // @ts-expect-error
  return !!window.Capacitor;
}
