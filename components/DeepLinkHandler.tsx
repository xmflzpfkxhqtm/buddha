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
        console.log('[DeepLink] RAW URL →', url);

        if (!url?.startsWith('yeondeung://auth/callback')) return;

        /* ────────── ① PKCE : ?code= ────────── */
        if (url.includes('?code=')) {
          console.log('[DeepLink] PKCE path');
          const { error } = await supabase.auth.exchangeCodeForSession(url);
          if (error) {
            console.error('[DeepLink] exchangeCodeForSession 실패', error);
            return;
          }
          await Browser.close();
          router.replace('/me');
          return;
        }

        /* ────────── ② implicit : #access_token= ────────── */
        if (url.includes('#access_token=')) {
          console.log('[DeepLink] Implicit path');
          const [, fragment] = url.split('#');
          const p = new URLSearchParams(fragment);

          const access_token  = p.get('access_token');
          const refresh_token = p.get('refresh_token');

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
          return;
        }

        console.warn('[DeepLink] 알 수 없는 URL 형식, 무시');
      });
    })();

    return () => { sub?.remove(); };
  }, [router]);

  return null;
}
