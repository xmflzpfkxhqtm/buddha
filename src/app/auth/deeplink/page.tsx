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
        // ✅ 웹이면 location.hash를 query로 변환
        if (window.location.hash) {
          const queryString = window.location.hash.substring(1); // '#' 제거
          const newUrl = `/auth/callback?${queryString}`;
          window.location.replace(newUrl); // 바로 이동
        } else {
          // hash 없으면 fallback
          setTimeout(() => {
            window.location.href = '/auth/callback';
          }, 2000);
        }
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

function isNativeApp() {
  if (typeof window === 'undefined') return false;
  // @ts-expect-error Capacitor global object
  return !!window.Capacitor;
}
