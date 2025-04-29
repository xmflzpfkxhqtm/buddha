'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function AuthDeepLinkPage() {
  useEffect(() => {
    const tryRedirect = async () => {
      if (isNativeApp()) {
        try {
          const { data, error } = await supabase.auth.getSession();

          if (error || !data.session) {
            alert('로그인 실패');
            return;
          }

          const { access_token, refresh_token } = data.session;

          // ✅ 앱이면 딥링크로
          const deeplink = `yeondeung://auth/callback?access_token=${access_token}&refresh_token=${refresh_token}`;
          window.location.href = deeplink;
        } catch (err) {
          console.error('DeepLink error:', err);
        }
      } else {
        // ✅ 웹이면 그냥 2초 후 /auth/callback로 강제 이동
        setTimeout(() => {
          window.location.href = '/auth/callback';
        }, 2000);
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
  // @ts-expect-error Capacitor global object
  return !!window.Capacitor;
}
