// Layer 1 hero carousel — 5대 경전을 컬러 + 텍스트로 살아있게.
// 이미지 없이 큰 한자 워터마크 + Ken Burns 줌 + 5초 auto-rotate + 스와이프.

'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type FeaturedSutra = {
  key: string;          // group_key (Layer 2 path)
  title: string;        // 친숙한 별칭 ("금강경")
  watermark: string;    // 워터마크용 한자 (보통 첫 글자 또는 짧은 발췌)
  sub: string;          // 한 줄 소개
  bg: string;           // 배경 컬러 (브랜드 적갈 패밀리 변주)
};

const FEATURED: FeaturedSutra[] = [
  {
    key: '금강반야바라밀경_K0013',
    title: '금강경',
    watermark: '金剛',
    sub: '집착을 끊는 공(空)의 지혜',
    bg: '#6E1517',
  },
  {
    key: '묘법연화경',
    title: '법화경',
    watermark: '妙法',
    sub: '모든 중생이 부처가 되는 일승의 길',
    bg: '#C26B4A',
  },
  {
    key: '유마힐소설경',
    title: '유마경',
    watermark: '維摩',
    sub: '재가 거사가 설한 불이(不二)의 가르침',
    bg: '#6B7E5A',
  },
  {
    key: '대불정여래밀인수증요의제보살만행수릉엄경',
    title: '능엄경',
    watermark: '楞嚴',
    sub: '마음의 본질과 수행의 길',
    bg: '#4D3A5C',
  },
  {
    key: '법구경',
    title: '법구경',
    watermark: '法句',
    sub: '짧은 게송에 담긴 일상의 지혜',
    bg: '#B8843C',
  },
  {
    key: '경율이상',
    title: '경율이상',
    watermark: '經律',
    sub: '경전과 율장의 신기하고 흥미로운 이야기',
    bg: '#5C4A3A',
  },
];

const ROTATE_MS = 5000;
const PAUSE_AFTER_INTERACTION_MS = 8000;
const SWIPE_THRESHOLD_PX = 50;
const FG = '#F8F5EE'; // 모든 슬라이드 공통 — 따뜻한 크림

export default function HeroCarousel() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // PointerEvent 통합 — mouse drag (desktop) + touch swipe (mobile/WKWebView) 둘 다 처리
  const dragStartX = useRef<number | null>(null);
  const wasDragging = useRef(false);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pauseTemporarily = useCallback(() => {
    setPaused(true);
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = setTimeout(() => setPaused(false), PAUSE_AFTER_INTERACTION_MS);
  }, []);

  // Auto-rotate
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % FEATURED.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [paused]);

  // 컴포넌트 unmount 시 보류 중인 timer 정리
  useEffect(() => () => {
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
  }, []);

  const goTo = useCallback((next: number) => {
    setIndex((next + FEATURED.length) % FEATURED.length);
    pauseTemporarily();
  }, [pauseTemporarily]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragStartX.current = e.clientX;
    wasDragging.current = false;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragStartX.current === null) return;
    if (Math.abs(e.clientX - dragStartX.current) > 5) {
      wasDragging.current = true;
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (dragStartX.current === null) return;
    const dx = e.clientX - dragStartX.current;
    dragStartX.current = null;
    if (Math.abs(dx) >= SWIPE_THRESHOLD_PX) {
      goTo(index + (dx < 0 ? 1 : -1));
    }
  };

  const onPointerCancel = () => {
    dragStartX.current = null;
    wasDragging.current = false;
  };

  const current = FEATURED[index];

  const handleClick = () => {
    // drag 직후 click 무시 (desktop mouse drag, mobile swipe 후 click 발화 방지)
    if (wasDragging.current) {
      wasDragging.current = false;
      return;
    }
    router.push(`/scripture/${encodeURIComponent(current.key)}`);
  };

  return (
    <section className="px-4 pt-3">
      <div
        role="button"
        tabIndex={0}
        aria-label={`${current.title} — ${current.sub}`}
        className="relative w-full aspect-[2/1] rounded-2xl overflow-hidden cursor-pointer select-none touch-pan-y transition-colors duration-500"
        style={{ backgroundColor: current.bg }}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          } else if (e.key === 'ArrowRight') {
            goTo(index + 1);
          } else if (e.key === 'ArrowLeft') {
            goTo(index - 1);
          }
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {/* 한자 워터마크 — 슬라이드 마다 Ken Burns 재시작 (key=index) */}
        <div
          key={`bg-${index}`}
          aria-hidden
          className="absolute inset-0 flex items-center justify-center pointer-events-none animate-ken-burns"
        >
          <span
            className="font-bold leading-none whitespace-nowrap"
            style={{
              color: FG,
              opacity: 0.12,
              fontSize: 'clamp(5rem, 20vw, 9rem)',
              fontFamily: '"YujiMai", serif',
              transform: 'translateX(16%)',
            }}
          >
            {current.watermark}
          </span>
        </div>

        {/* subtle radial highlight */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 25% 20%, rgba(248,245,238,0.10), transparent 55%)`,
          }}
        />

        {/* 콘텐츠 */}
        <div
          key={`content-${index}`}
          className="relative z-10 flex flex-col justify-end h-full p-5 animate-fade"
          style={{ color: FG }}
        >
          <h3 className="text-[26px] font-bold leading-tight mb-1">{current.title}</h3>
          <p className="text-sm opacity-85">{current.sub}</p>
        </div>

        {/* Dot indicators */}
        <div className="absolute bottom-3 right-4 z-20 flex items-center gap-1.5">
          {FEATURED.map((s, i) => (
            <button
              key={s.key}
              type="button"
              aria-label={`${i + 1}번째 슬라이드`}
              aria-current={i === index}
              onClick={(e) => {
                e.stopPropagation();
                goTo(i);
              }}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                backgroundColor: FG,
                opacity: i === index ? 1 : 0.4,
                width: i === index ? '14px' : '6px',
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
