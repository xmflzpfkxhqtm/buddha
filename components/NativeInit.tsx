// src/components/NativeInit.tsx
'use client';

import { useEffect } from 'react';
import { initNative } from '@/lib/initNative';

export default function NativeInit() {
  useEffect(() => { initNative(); }, []);
  return null;           // 화면엔 아무것도 안 그립니다
}
