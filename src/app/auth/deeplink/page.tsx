'use client';
export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function AuthDeepLinkPage() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      if (isNativeApp()) {
        /** ① 해시에 토큰이 있으면 바로 딥링크 */
        if (window.location.hash.includes('access_token=')) {
          const qs = window.location.hash.substring(1);          // '#' 제거
          const params = new URLSearchParams(qs);
          const access_token   = params.get('access_token');
          const refresh_token  = params.get('refresh_token');

          if (access_token && refresh_token) {
            const deeplink = `yeondeung://auth/callback?access_token=${access_token}&refresh_token=${refresh_token}`;
            window.location.href = deeplink;                     // 앱으로 복귀
            return;
          }
        }

        /** ② (드물게) 해시가 없으면 기존 방식으로 세션 시도 */
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          const { access_token, refresh_token } = data.session;
          const deeplink = `yeondeung://auth/callback?access_token=${access_token}&refresh_token=${refresh_token}`;
          window.location.href = deeplink;
        } else {
          alert('로그인 세션을 가져오지 못했습니다. 다시 시도해주세요.');
        }
      } else {
        /** 웹은 이미 로그인 완료 → 홈으로 이동 */
        router.replace('/');
      }
    };

    run();
  }, [router]);

  return (
    <main className="flex justify-center items-center min-h-screen">
      <p>앱으로 돌아가는 중...</p>
    </main>
  );
}

/** Capacitor WebView(ios·android) 만 true */
function isNativeApp() {
  // @ts-expect-error Capacitor global only in native build
  return typeof window !== 'undefined' && window.Capacitor && window.Capacitor.getPlatform() !== 'web';
}



