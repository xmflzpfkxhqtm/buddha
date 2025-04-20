// src/app/answer/page.tsx
'use client';

import SuspenseWrapper from '../../../components/SuspenseWrapper';
import AnswerClient from './AnswerClient';

export default function AnswerPage() {
  return (
    <SuspenseWrapper>
      <AnswerClient />
    </SuspenseWrapper>
  );
}
