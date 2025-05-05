'use client';

import { ReactNode } from 'react';
import { usePushToken } from '@/hooks/usePushToken';

export default function PushProvider({ children }: { children: ReactNode }) {
  // 토큰 훅 실행
  usePushToken();

  // 자식 그대로 렌더
  return <>{children}</>;
}
