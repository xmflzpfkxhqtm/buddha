'use client';

import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { PluginListenerHandle } from '@capacitor/core';
import { AuthError } from '@supabase/supabase-js';

/* 로깅 */
const log = (tag: string, payload?: string | Record<string, unknown> | AuthError) =>
  console.log(`[DLINK][${tag}]`, payload ?? '');

export default function DeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    let sub: PluginListenerHandle | undefined;

    (async () => {
      sub = await App.addListener('appUrlOpen', async ({ url }) => {
        log('RAW', url);

        if (!url?.startsWith('https://buddha-dusky.vercel.app/auth/deeplink'))
          return; // 커스텀 스킴 쓴다면 조건 변경

        /* ────────── PKCE : ?code= ────────── */
        if (url.includes('?code=')) {
          log('PKCE', 'exchange start');
          const { error } = await supabase.auth.exchangeCodeForSession(url);
          log('PKCE', error ?? 'success');

          if (!error) {
            await Browser.close();
            router.replace('/me');
          }
          return;
        }

        /* ────────── Implicit : #access_token= ────────── */
        if (url.includes('#access_token=')) {
          log('IMPLICIT', 'hash parse');
          const [, fragment] = url.split('#');
          const p = new URLSearchParams(fragment);

          const access_token  = p.get('access_token');
          const refresh_token = p.get('refresh_token');

          if (!access_token || !refresh_token) {
            log('IMPLICIT', 'parse fail');
            return;
          }

          await supabase.auth.setSession({ access_token, refresh_token });
          await Browser.close();
          router.replace('/me');
          return;
        }

        log('SKIP', 'unknown format');
      });
    })();

    return () => { sub?.remove(); };
  }, [router]);

  return null;
}
