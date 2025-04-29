'use client';

import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { useRouter } from 'next/navigation';

export default function DeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    let removeListener: () => void;

    App.addListener('appUrlOpen', ({ url }) => {
      if (url?.startsWith('yeondeung://auth/callback')) {
        router.push('/auth/callback');
      }
    }).then((listener) => {
      removeListener = () => {
        listener.remove();
      };
    });

    return () => {
      removeListener?.();
    };
  }, [router]);

  return null;
}
