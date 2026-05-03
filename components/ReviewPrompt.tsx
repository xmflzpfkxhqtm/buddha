/* components/ReviewPrompt.tsx - 훅 제거 버전 */
'use client';

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { InAppReview } from '@capacitor-community/in-app-review';
import { useRouter } from 'next/navigation';

const TRIGGERS = [3, 10, 30];

interface Props { force?: boolean }

export default function ReviewPrompt({ force = false }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  /* ── 호출 조건 ── */
  useEffect(() => {
    /* 1) 강제 모드 & ?review=1 파라미터 */
    const urlParams = new URLSearchParams(window.location.search);
    if (force || urlParams.get('review') === '1') {
      setOpen(true);
      return;
    }

    /* 2) 네이티브 플랫폼에서만 카운트 */
    if (!Capacitor.isNativePlatform()) return;

    const cnt = parseInt(localStorage.getItem('launchCount') ?? '0', 10) + 1;
    localStorage.setItem('launchCount', String(cnt));

    const today = new Date().toDateString();
    if (localStorage.getItem('reviewDate') === today) return;

    if (TRIGGERS.includes(cnt)) setOpen(true);
  }, [force]);

  if (!open) return null;

  /* ── 모달 ── */
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-40">
      <div className="w-80 rounded-2xl bg-surface-elevated p-6 text-center space-y-5 shadow-xl">
        <h2 className="text-lg font-semibold">앱이 마음에 드셨나요?</h2>
        <p className="text-base text-accent">
          짧은 리뷰 한 줄이 큰 힘이 됩니다. <br />
          법을 전하는 일에 공덕을 보태주세요 🙏
        </p>

        <div className="flex justify-center gap-4">
          <button
            className="px-4 py-2 bg-accent-soft text-on-brand rounded-2xl hover:bg-accent transition"
            onClick={async () => {
              try { await InAppReview.requestReview(); } catch {}
              localStorage.setItem('reviewDate', new Date().toDateString());
              setOpen(false);
            }}
          >
            마음에 들어요
          </button>

          <button
            className="px-4 py-2 border border-accent text-accent rounded-2xl hover:bg-accent hover:text-on-brand transition"
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
