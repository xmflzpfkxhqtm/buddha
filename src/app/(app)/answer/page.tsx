// src/app/answer/page.tsx
'use client';

import SuspenseWrapper from '../../../../components/SuspenseWrapper';
import AnswerClient from './AnswerClient';

export default function AnswerPage() {
  return (
    <SuspenseWrapper
      fallback={
        <main className="min-h-screen w-full max-w-[460px] mx-auto bg-background text-foreground" />
      }
    >
      <AnswerClient />
    </SuspenseWrapper>
  );
}
