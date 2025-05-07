'use client';

import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { PluginListenerHandle } from '@capacitor/core';
import { AuthError } from '@supabase/supabase-js';

/* ---------- 상수 & 로깅 ---------- */
const SCHEME_CB = 'yeondeung://auth/callback';        // 네이티브용 콜백
const log = (
  tag: string,
  payload?: string | Record<string, unknown> | AuthError
) => console.log(`[DLINK][${tag}]`, payload ?? '');

export default function DeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    let sub: PluginListenerHandle | undefined;

    (async () => {
      sub = await App.addListener('appUrlOpen', async ({ url }) => {
        log('RAW', url);

        /* ---------- 내 앱 콜백인지 확인 ---------- */
        if (!url?.startsWith(SCHEME_CB)) {
          log('SKIP', 'not our callback');
          return;
        }

        /* ---------- ① PKCE : ?code= ---------- */
        if (url.includes('?code=')) {
          log('PKCE', 'exchange start');
          const { error } = await supabase.auth.exchangeCodeForSession(url);
          log('PKCE', error ?? 'success');

          if (!error) {
            log('BROWSER', 'closing Safari VC');
            await Browser.close();
            router.replace('/me');
          }
          return;
        }

        /* ---------- ② Implicit : #access_token= ---------- */
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
          log('BROWSER', 'closing Safari VC');
          await Browser.close();
          router.replace('/me');
          return;
        }

        log('SKIP', 'unknown format');
      });
    })();

    return () => {
      sub?.remove();
    };
  }, [router]);

  return null;
}
