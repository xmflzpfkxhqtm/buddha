// ✅ 반드시 named export 로 내보냅니다.
import { Capacitor } from '@capacitor/core';

export function getPlatform(): 'ios' | 'android' | 'web' | 'server' {
  if (typeof window === 'undefined') return 'server';
  const platform = Capacitor.getPlatform();
  return platform === 'ios' || platform === 'android' ? platform : 'web';
}
