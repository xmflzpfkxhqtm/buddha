'use client';

import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { useRouter } from 'next/navigation';

export default function AppStateRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let lastBackground: number | null = null;
    let listener: PluginListenerHandle | undefined;

    void (async () => {
      listener = await App.addListener('appStateChange', ({ isActive }) => {
        const now = Date.now();

        if (!isActive) {
          lastBackground = now;
        } else if (lastBackground && now - lastBackground > 7.2e6) {
          router.replace('/dashboard');
        }
      });
    })();

    return () => {
      listener?.remove();
    };
  }, [router]);

  return null;
}
