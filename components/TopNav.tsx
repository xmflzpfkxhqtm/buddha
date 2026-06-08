'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { useEffect, useState } from 'react';

/* 1. TopNav를 절대 표시하지 않을 경로 */
const HIDDEN_PATHS: (string | RegExp)[] = [
  '/login',
  '/dashboard',                    // 홈
  '/scripture',           // 경전 메인 (옛)
  /^\/scripture\//,        // scripture 하위 모든 path (Layer 1 v2 / Layer 2 [group] / Layer 3 [group]/[volume])
  '/fullscreen',          // 전체화면 뷰
  '/ask/confirm',         // 질문 확인 페이지
  /^\/copy\/[^/]+\/complete$/,          // copy/[id]/complete ← 정규식(동적 라우트)
  /^\/practice\/copy\/[^/]+\/complete$/, // practice/copy/[id]/complete
];

/* 2. "돌아가기" 예외 – 정확 매칭 */
const CUSTOM_BACK: Record<string, string> = {
  '/answer': '/ask',                // 답변 보기 → 질문 작성
};

/* 3. "돌아가기" 예외 – 정규식 매칭 */
const CUSTOM_BACK_REGEX: { pattern: RegExp; to: string }[] = [
  { pattern: /^\/copy\/[^/]+\/complete$/,          to: '/practice/copy' }, // 사경 완료 → 사경 홈
  { pattern: /^\/practice\/copy\/[^/]+\/complete$/, to: '/practice/copy' }, // practice 사경 완료 → 사경 홈
];

/* 4. 섹션 루트 – 라벨/헤더는 표시하되 돌아가기 버튼은 숨김.
   페이지네이션을 BottomNav 로만 의도. 하위 레이어는 정상적으로 백 버튼 노출. */
const NO_BACK_PATHS: string[] = ['/ask', '/copy', '/me', '/practice'];

interface TopNavProps {
  className?: string;
}

export default function TopNav({ className }: TopNavProps) {
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
      '/me/profile': '프로필 관리',
      '/me/profile/account-delete': '계정 삭제',
      '/me/highlights': '하이라이트',
      '/me/favorites': '즐겨찾기',
      '/me/answers': '내가 저장한 말씀들',
      '/me/copies': '나의 사경노트',
      '/me/feedback': '제안 및 문의',
      '/me/settings': '설정',
      '/answer': '답변',
      '/practice': '수행하기',
      '/practice/meditation': '명상 타이머',
      '/practice/yunsang': '목륜상 점보기',
      '/practice/copy': '사경',
    };
    const dynamicLabel =
      /^\/practice\/copy\/[^/]+$/.test(pathname) ? '사경' : '';
    setLabel(map[pathname] ?? dynamicLabel);
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

  const showBack = pathname !== '/' && !NO_BACK_PATHS.includes(pathname);

  return (
    <>
      {/* ───── 고정 상단바 ─ scripture 컨벤션과 통일 (백버튼 = 아이콘만, 라벨 = 백버튼 옆) ───── */}
      <header
        className={`fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[460px]
                   bg-surface-elevated z-40 select-none border-b border-line-strong/50 ${className ?? ''}`}
        style={{
          // 일부 iOS Capacitor WKWebView 가 env() 를 0 으로 평가하는 케이스 대비 max() fallback.
          paddingTop: 'max(44px, env(safe-area-inset-top))',
          height: 'calc(48px + max(44px, env(safe-area-inset-top)))',
        }}
      >
        {/* grid 3-column — 좌(백버튼) / 가운데(라벨, truncate) / 우(균형용 placeholder).
            라벨이 정확히 중앙에 오도록 보장. */}
        <div className="grid grid-cols-[40px_1fr_40px] items-center gap-1 h-12 px-2">
          {showBack ? (
            <button
              type="button"
              aria-label="뒤로"
              className="w-10 h-10 flex items-center justify-center rounded-lg text-accent hover:bg-accent/5 active:bg-accent/10 transition-colors"
              onClick={() => {
                if (customTarget) {
                  router.replace(customTarget);
                } else if (history.length > 1) {
                  router.back();
                } else {
                  router.push('/');
                }
              }}
            >
              <ChevronLeft size={24} />
            </button>
          ) : (
            <div aria-hidden />
          )}
          <h1 className="text-center text-base font-semibold text-accent truncate">{label}</h1>
          <div aria-hidden />
        </div>
      </header>

      {/* 본문을 아래로 밀어주는 스페이서 (헤더 높이 + safe-area top 만큼) */}
      <div style={{ height: 'calc(48px + max(44px, env(safe-area-inset-top)))' }} />
    </>
  );
}
