// src/components/SuspenseWrapper.tsx
'use client';

import { Suspense } from 'react';

export default function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
