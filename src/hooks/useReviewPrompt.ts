import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

const TRIGGERS = [5, 15, 30];

export default function useReviewPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const key   = 'launchCount';
    const count = parseInt(localStorage.getItem(key) ?? '0', 10) + 1;
    localStorage.setItem(key, String(count));

    if (TRIGGERS.includes(count)) setShow(true);
  }, []);

  return { show, hide: () => setShow(false) };
}
