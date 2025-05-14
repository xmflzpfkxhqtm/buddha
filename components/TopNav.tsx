'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { useEffect, useState } from 'react';

/* 1. TopNav를 절대 표시하지 않을 경로 */
const HIDDEN_PATHS: (string | RegExp)[] = [
  '/login',
  '/dashboard',                    // 홈
  '/scripture',           // 경전 메인
  '/fullscreen',          // 전체화면 뷰
  '/ask/confirm',         // 질문 확인 페이지
  /^\/copy\/[^/]+\/complete$/, // copy/[id]/complete ← 정규식(동적 라우트)
];

/* 2. “돌아가기” 예외 – 정확 매칭 */
const CUSTOM_BACK: Record<string, string> = {
  '/answer': '/ask',                // 답변 보기 → 질문 작성
};

/* 3. “돌아가기” 예외 – 정규식 매칭 */
const CUSTOM_BACK_REGEX: { pattern: RegExp; to: string }[] = [
  { pattern: /^\/copy\/[^/]+\/complete$/, to: '/copy' }, // 사경 완료 → 사경 홈
];

export default function TopNav() {
  const router   = useRouter();
  const pathname = usePathname();

  /* ── 페이지 라벨 ── */
  const [label, setLabel] = useState('');
  useEffect(() => {
    const map: Record<string, string> = {
      '/': '홈',
      '/scripture': '불경',
      '/ask': '부처님께 여쭙기',
      '/copy': '사경하기',
      '/me': '내 정보',
      '/answer': '답변',
    };
    setLabel(map[pathname] ?? '');
  }, [pathname]);

  /* ── TopNav 숨김 여부 ── */
  const shouldHide = HIDDEN_PATHS.some((rule) =>
    typeof rule === 'string' ? rule === pathname : rule.test(pathname)
  );
  if (shouldHide) return null;

  /* ── 예외 뒤로가기 경로 계산 ── */
  const customExact   = CUSTOM_BACK[pathname];
  const customRegex   = CUSTOM_BACK_REGEX.find((r) => r.pattern.test(pathname))?.to;
  const customTarget  = customExact || customRegex;

  const showBack = pathname !== '/';

  return (
    <>
      {/* ───── 고정 상단바 ───── */}
      <header
        className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[460px] h-[48px]
                   bg-white z-40 select-none flex items-center border-b border-grey/50"
      >
        {showBack && (
          <button
            className="absolute left-4 flex items-center gap-1 font-semibold text-red-dark
                       active:scale-95 h-10"
            onClick={() => {
              if (customTarget) {
                router.replace(customTarget);      // 예외 경로
              } else if (history.length > 1) {
                router.back();                     // 일반 한 칸 뒤로
              } else {
                router.push('/');                  // 스택 없으면 홈
              }
            }}
          >
            <ChevronLeft size={24} />
            돌아가기
          </button>
        )}

        {/* 라벨 – 중앙 고정 */}
        <h1 className="absolute left-1/2 -translate-x-1/2 text-base font-semibold text-red-dark">
          {label}
        </h1>
      </header>

      {/* 본문을 아래로 밀어주는 스페이서 */}
      <div className="h-[48px]" />
    </>
  );
}
