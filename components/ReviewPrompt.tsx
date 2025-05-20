/* Tailwind v2/v3 공통으로 동작하도록 bg-opacity 클래스로 변경 */
'use client';

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { InAppReview } from '@capacitor-community/in-app-review';
import { useRouter, useSearchParams } from 'next/navigation';

const TRIGGERS = [3, 10, 30];

interface Props { force?: boolean }

export default function ReviewPrompt({ force = false }: Props) {
  const [open, setOpen] = useState(false);
  const router  = useRouter();
  const params  = useSearchParams();

  /* ── 호출 조건 ── */
  useEffect(() => {
    if (force || params.get('review') === '1') {
      setOpen(true);
      return;
    }

    if (!Capacitor.isNativePlatform()) return;

    const cnt = parseInt(localStorage.getItem('launchCount') ?? '0', 10) + 1;
    localStorage.setItem('launchCount', String(cnt));

    const today = new Date().toDateString();
    if (localStorage.getItem('reviewDate') === today) return;

    if (TRIGGERS.includes(cnt)) setOpen(true);
  }, [force, params]);

  if (!open) return null;

  /* ── 모달 ── */
  return (
    <div
      className="
        fixed inset-0 z-[9999] flex items-center justify-center
        bg-black bg-opacity-40   /* ← v2 호환 */
      "
    >
      <div className="w-80 rounded-2xl bg-white p-6 text-center space-y-5 shadow-xl">
        <h2 className="text-lg font-semibold">앱이 마음에 드셨나요?</h2>
        <p className="text-base text-red-dark">
          짧은 리뷰 한 줄이 큰 힘이 됩니다. <br />
          법을 전하는 일에 공덕을 보태주세요 🙏
        </p>

        <div className="flex justify-center gap-4">
          {/* 긍정 버튼 */}
          <button
            className="px-4 py-2 bg-red-light text-white rounded-2xl hover:bg-red transition"
            onClick={async () => {
              try { await InAppReview.requestReview(); } catch {}
              localStorage.setItem('reviewDate', new Date().toDateString());
              setOpen(false);
            }}
          >
            마음에 들어요
          </button>

          {/* 개선 제안 */}
          <button
            className="px-4 py-2 border border-red text-red rounded-2xl hover:bg-red hover:text-white transition"
            onClick={() => {
              localStorage.setItem('reviewDate', new Date().toDateString());
              setOpen(false);
              router.push('/me/feedback');
            }}
          >
            별로에요
          </button>
        </div>
      </div>
    </div>
  );
}
