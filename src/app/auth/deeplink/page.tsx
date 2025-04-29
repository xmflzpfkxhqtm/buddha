'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function AuthDeepLinkPage() {
  const router = useRouter();

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
        // ✅ 웹에서는 router.push('/')로 안전하게 리다이렉트
        setTimeout(() => {
          router.replace('/');
        }, 2000);
      }
    };

    tryRedirect();
  }, [router]);

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
