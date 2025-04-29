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

          const deeplink = `yeondeung://auth/callback?access_token=${access_token}&refresh_token=${refresh_token}`;
          window.location.href = deeplink;
        } catch (err) {
          console.error('DeepLink error:', err);
        }
      } else {
        // ✅ 웹이면 2초 후 홈(/)으로 이동
        setTimeout(() => {
          window.location.href = '/';
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

// ✅ isNativeApp는 단순히 Capacitor 객체 존재만 확인
function isNativeApp() {
  if (typeof window === 'undefined') return false;
  // @ts-expect-error Capacitor global object
  return !!window.Capacitor;
}
