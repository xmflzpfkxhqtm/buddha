'use client';
export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Browser } from '@capacitor/browser'; // ✅ 추가

declare global {
  interface Window {
    Capacitor?: {
      getPlatform: () => 'ios' | 'android' | 'web';
    };
  }
}

export default function AuthDeepLinkPage() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      if (isNativeApp()) {
        if (window.location.hash.includes('access_token=')) {
          const qs = window.location.hash.substring(1);
          const params = new URLSearchParams(qs);
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');

          if (access_token && refresh_token) {
            const deeplink = `yeondeung://auth/callback?access_token=${access_token}&refresh_token=${refresh_token}`;
            // ✅ Browser.open -> Browser.close 순서로 처리
            await Browser.open({ url: deeplink });
            await Browser.close();
            return;
          }
        }

        // 해시가 없는 경우 (예외 처리)
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          const { access_token, refresh_token } = data.session;
          const deeplink = `yeondeung://auth/callback?access_token=${access_token}&refresh_token=${refresh_token}`;
          await Browser.open({ url: deeplink });
          await Browser.close();
        } else {
          alert('로그인 세션을 가져오지 못했습니다. 다시 시도해주세요.');
        }
      } else {
        // 웹은 그냥 홈으로
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

function isNativeApp() {
  return typeof window !== 'undefined' && window.Capacitor && window.Capacitor.getPlatform() !== 'web';
}
