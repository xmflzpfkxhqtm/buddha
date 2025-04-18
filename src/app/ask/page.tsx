// app/ask/page.tsx
import { Suspense } from 'react';
import AskClient from './AskClient';

export default function AskPage() {
  return (
    <Suspense fallback={<div className="p-6">로딩 중...</div>}>
      <AskClient />
    </Suspense>
  );
}
