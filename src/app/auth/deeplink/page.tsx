'use client';
export const dynamic = 'force-dynamic';   // CSR 강제

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function AuthDeepLinkPage() {
  const router = useRouter();

  useEffect(() => {
    const tryRedirect = async () => {
      if (isNativeApp()) {
        // ---- 앱 플로우 ----
        const { data } = await supabase.auth.getSession();
        if (!data.session) return alert('로그인 실패');

        const { access_token, refresh_token } = data.session;
        const deeplink = `yeondeung://auth/callback?access_token=${access_token}&refresh_token=${refresh_token}`;
        window.location.href = deeplink;
      } else {
        // ---- 웹 플로우 : 바로 홈으로 ----
        router.replace('/');          // setTimeout 필요 X
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

/** ✔️  브라우저에선 false, 네이티브에선 true */
function isNativeApp() {
  if (typeof window === 'undefined') return false;
  // @ts-expect-error Capacitor global object only in runtime
  return !!window.Capacitor &&
  // @ts-expect-error Capacitor global object
         typeof window.Capacitor.getPlatform === 'function' &&
         // @ts-expect-error Capacitor global object
         window.Capacitor.getPlatform() !== 'web';
}



