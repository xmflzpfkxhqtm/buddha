'use client';

import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { PluginListenerHandle } from '@capacitor/core';

export default function DeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    let sub: PluginListenerHandle | undefined;

    (async () => {
      sub = await App.addListener('appUrlOpen', async ({ url }) => {
        if (!url?.startsWith('yeondeung://auth/callback')) return;
        console.log('[DeepLink] URL →', url);

        /* ───────────────────────────────────────────────
           1)  쿼리 code 파라미터(PKCE)                    */
        if (url.includes('?code=')) {
          const { error } = await supabase.auth.exchangeCodeForSession(url);
          if (error) {
            console.error('[DeepLink] exchangeCodeForSession 실패', error);
            return;
          }
          await Browser.close();
          router.replace('/me');
          return; // ✅ 처리 완료
        }

        /* ───────────────────────────────────────────────
           2)  해시 access_token 파라미터(implicit)        */
        if (url.includes('#access_token=')) {
          const [, fragment] = url.split('#');
          const p = new URLSearchParams(fragment);

          const access_token  = p.get('access_token');
          const refresh_token = p.get('refresh_token');
          const expires_in    = Number(p.get('expires_in') ?? '3600');

          if (!access_token || !refresh_token) {
            console.error('[DeepLink] 해시 파싱 실패');
            return;
          }

          await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          await Browser.close();
          router.replace('/me');
          return; // ✅ 처리 완료
        }

        console.warn('[DeepLink] 알 수 없는 형식의 URL, 무시');
      });
    })();

    /* ───────── clean-up ───────── */
    return () => { sub?.remove(); };
  }, [router]);

  return null;
}
