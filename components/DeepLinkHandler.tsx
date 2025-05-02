'use client';

import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';          // 🔹 추가
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';        // 🔹 추가

export default function DeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    // addListener가 반환하는 sub를 기억해 두면 나중에 remove 가능
    let unsubscribe: any;
    
    const setupListener = async () => {
      const sub = await App.addListener('appUrlOpen', async ({ url }) => {
        console.log('앱 딥링크 복귀 URL:', url);

        if (!url?.startsWith('yeondeung://auth/callback')) return;

        /* ✅ 1) "code → 세션" 교환 */
        const { error } = await supabase.auth.exchangeCodeForSession(url);
        if (error) {
          console.error('세션 교환 실패', error);
          return;
        }

        /* ✅ 2) 인앱 브라우저 닫기 (SFSafariViewController) */
        await Browser.close();

        /* ✅ 3) 원하는 화면으로 이동 */
        router.replace('/me');      // 또는 /home 등
      });
      unsubscribe = sub;
    };

    setupListener();

    // clean-up
    return () => {
      if (unsubscribe) unsubscribe.remove();
    };
  }, [router]);

  return null;
}
