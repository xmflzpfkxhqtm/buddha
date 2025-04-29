'use client';

import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { useRouter } from 'next/navigation';

export default function DeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    const setupDeepLink = async () => {
      App.addListener('appUrlOpen', ({ url }) => {
        console.log('앱 딥링크 복귀 URL:', url); // ✅ 여기 찍히는지 보자

        if (url?.startsWith('yeondeung://auth/callback')) {
          router.push('/auth/callback' + (url.split('auth/callback')[1] || ''));
        }
      });
    };

    setupDeepLink();
  }, [router]);

  return null;
}
