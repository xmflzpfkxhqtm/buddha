// src/app/debug/review/page.tsx
import ReviewPrompt from '../../../../../components/ReviewPrompt';

export default function ReviewDebug() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <ReviewPrompt force />    {/* 강제 오픈 */}
    </main>
  );
}
