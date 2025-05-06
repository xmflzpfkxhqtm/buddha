'use client';

import { useRouter, usePathname } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { useEffect, useState } from 'react';

const HIDDEN_PATHS: (string | RegExp)[] = [
  '/login',
  '/',
  '/scripture',
  '/fullscreen',
  '/copy/[id]/complete',
];

export default function TopNav() {
  const router   = useRouter();
  const pathname = usePathname();

  /* 숨길 페이지인지 체크 */
  const shouldHide = HIDDEN_PATHS.some((rule) =>
    typeof rule === 'string' ? rule === pathname : rule.test(pathname)
  );
  if (shouldHide) return null;            // ← TopNav + 스페이서 둘 다 안 보임

  /* 라벨 매핑 */
  const [label, setLabel] = useState('');
  useEffect(() => {
    const map: Record<string, string> = {
      '/': '홈',
      '/scripture': '불경',
      '/ask': '질문',
      '/copy': '사경',
      '/me': '내 정보',
      '/answer': '답변',
    };
    setLabel(map[pathname] ?? '');
  }, [pathname]);

  const showBack = pathname !== '/';

  return (
    <>
      {/* ───── 고정 상단바 ───── */}
      <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[460px] h-[48px] px-4
                         flex items-center justify-between bg-white border-red z-40 select-none">
        {showBack && (
          <button
            onClick={() => router.back()}
            className="absolute left-4 flex items-center gap-1 text-red-dark
                    active:scale-95 h-10 px-2"
          >
            <ChevronLeft size={24} />
            돌아가기
          </button>
        )}

        {/* 라벨 – 컨테이너 중앙 고정 */}
        <h1
          className="absolute left-1/2 -translate-x-1/2 text-base font-semibold
                     text-red-dark whitespace-nowrap"
        >
          {label}
        </h1>
      </header>

      {/* ───── 콘텐츠 밀어내는 스페이서 ───── */}
      <div className="h-[48px]" />
    </>
  );
}
