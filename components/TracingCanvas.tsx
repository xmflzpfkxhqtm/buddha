'use client';

import { useRef, useState, useEffect } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import getStroke from 'perfect-freehand';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useTheme } from 'next-themes';

type Point = [number, number];

interface Props {
  char: string;
  initialSvg?: string | null;
  guideChars: string[];
  prevSvgs: (string | null)[];
  onFinish(svg: string): void;
  onClear(): void;
  onPrev?: () => void;
  onNext?: () => void;
  canPrev?: boolean;
  canNext?: boolean;
  lang: 'kor' | 'han';
  isLast?: boolean;
}

/* 셀 크기 · 확대배율 */
const CELL = 50;
const SCALE = 6;

export default function TracingCanvas({
  char,
  initialSvg,
  guideChars,
  prevSvgs,
  onFinish,
  onClear,
  onPrev,
  onNext,
  canPrev,
  canNext,
  lang,
  isLast = false,
}: Props) {
  /* canvas 는 CSS color 자동 상속이 안 되므로 theme 별로 ink 색을 직접 적용. */
  const { resolvedTheme } = useTheme();
  const inkColor = resolvedTheme === 'dark' ? '#E0D5C2' : '#2E2B28';

  /* ---------------- state ---------------- */
  const [dSmallList, setDSmallList] = useState<string[]>([]);
  useEffect(() => {
    setDSmallList(
      initialSvg
        ? [...initialSvg.matchAll(/d="([^"]+)"/g)].map((m) => m[1])
        : []
    );
  }, [char, initialSvg]);

  /* ---------------- canvas refs ---------------- */
  const baseRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);

  /* ---------------- draw guides ---------------- */
  useEffect(() => {
    const W = CELL * SCALE;
    const H = W;
    const base = baseRef.current!;
    base.width = W;
    base.height = H;
    const ctx = base.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);

    /* 1) guide glyph */
    const guideFont = lang === 'kor' ? "'MaruBuri'" : "'Yuji Mai'";
    ctx.font = `${CELL * SCALE * 0.7}px ${guideFont}, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = inkColor;
    ctx.globalAlpha = 0.18;

    const m = ctx.measureText(char);
    const h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    const y = (H + h) / 2 - m.actualBoundingBoxDescent;
    ctx.fillText(char, W / 2, y);
    ctx.globalAlpha = 1;

    /* 2) committed strokes */
    ctx.fillStyle = inkColor;
    dSmallList.forEach((dSmall) => {
      ctx.save();
      ctx.scale(SCALE, SCALE);
      ctx.fill(new Path2D(dSmall));
      ctx.restore();
    });

    /* reset live layer */
    const live = liveRef.current!;
    live.width = W;
    live.height = H;
    live.getContext('2d')!.clearRect(0, 0, W, H);
  }, [char, dSmallList, lang, inkColor]);

  /* ---------------- drawing ---------------- */
  const points = useRef<Point[]>([]);
  const drawing = useRef(false);
  const liveCtx = () => liveRef.current!.getContext('2d')!;

  const handleDown = (e: React.PointerEvent) => {
    drawing.current = true;
    points.current = [[e.nativeEvent.offsetX, e.nativeEvent.offsetY]];
    const lc = liveCtx();
    lc.beginPath();
    lc.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    lc.lineWidth = 4;
    lc.lineCap = 'round';
    lc.strokeStyle = inkColor;
  };

  const handleMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    points.current.push([e.nativeEvent.offsetX, e.nativeEvent.offsetY]);
    liveCtx().lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    liveCtx().stroke();
  };

  const finishStroke = async () => {
    if (!drawing.current || points.current.length === 0) return;
    drawing.current = false;

    /* clear live layer */
    liveCtx().clearRect(0, 0, CELL * SCALE, CELL * SCALE);

    /* build SVG path (50×50) */
    const ptsSmall = points.current.map(
      ([x, y]) => [x / SCALE, y / SCALE] as Point
    );
    const outline = getStroke(ptsSmall, {
      size: 5,
      thinning: 0.2,
      smoothing: 0.2,
      streamline: 0.4,
      easing: (t: number) => t * t,
      start: { taper: 10, cap: true },
      end: { taper: 10, cap: true },
    });
    const dSmall =
      outline
        .map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`)
        .join(' ') + ' Z';

    /* paint on base canvas */
    const bctx = baseRef.current!.getContext('2d')!;
    bctx.save();
    bctx.scale(SCALE, SCALE);
    bctx.fill(new Path2D(dSmall));
    bctx.restore();

    setDSmallList((list) => [...list, dSmall]);
    points.current = [];

    /* ▶️ 짧은 햅틱 */
    await Haptics.impact({ style: ImpactStyle.Light });
  };

  /* ---------------- controls ---------------- */
  const handleClear = () => {
    setDSmallList([]);
    onClear();
  };

  const handleFinish = async () => {
    if (dSmallList.length === 0) return;
    /* fill="currentColor" 로 저장하면 렌더 시 부모의 color 를 따라가서 라이트/다크 모두 자연스럽게 보임. */
    const svgSmall = dSmallList
      .map((d) => `<path d="${d}" fill="currentColor"/>`)
      .join('');
    onFinish(svgSmall);
    setDSmallList([]);

    /* ▶️ 글자 완료 햅틱 (조금 더 강하게) */
    await Haptics.impact({ style: ImpactStyle.Medium });
  };

  /* ---------------- render ---------------- */
  return (
    <div className="w-full flex flex-col items-center gap-2">
      {/* guides */}
      <div className="grid grid-cols-7 gap-1">
        {guideChars.map((g, i) => (
          <div
            key={i}
            className={`w-[50px] h-[50px] flex items-center justify-center text-2xl ${
              lang === 'kor' ? "font-['MaruBuri']" : "font-['Yuji_Mai']"
            } text-accent`}
          >
            {g}
          </div>
        ))}
      </div>

      {/* committed row */}
      <div className="grid grid-cols-7 gap-1">
        {prevSvgs.map((svg, i) => (
          <div
            key={i}
            className="w-[50px] h-[50px] border-1 border-accent-soft relative rounded"
          >
            {svg && (
              <svg
                className="absolute inset-0 text-ink"
                viewBox={`0 0 ${CELL} ${CELL}`}
                /* 기존에 fill="black" 으로 저장된 항목도 currentColor 로 변환해 다크모드에서 보이게. */
                dangerouslySetInnerHTML={{ __html: svg.replace(/fill="black"/g, 'fill="currentColor"') }}
              />
            )}
          </div>
        ))}
      </div>

      {/* drawing canvas */}
      <div className="flex justify-center">
        <div
          className="relative my-8 border-2 border-accent-soft rounded-lg shadow-md"
          style={{ width: CELL * SCALE, height: CELL * SCALE }}
        >
          <canvas ref={baseRef} className="absolute inset-0" />
          <canvas
            ref={liveRef}
            className="absolute inset-0 select-none"
            onPointerDown={handleDown}
            onPointerMove={handleMove}
            onPointerUp={finishStroke}
            onPointerLeave={finishStroke}
          />
        </div>
      </div>

      {/* buttons */}
      <div className="flex items-center w-full mt-2">
        {/* prev */}
        {onPrev ? (
          <button
            onClick={onPrev}
            disabled={!canPrev}
            className="flex-none px-2 py-1 text-2xl text-accent disabled:opacity-30 hover:bg-accent-soft/20"
            aria-label="이전 글자"
          >
            <ArrowLeft className="text-accent" />
          </button>
        ) : (
          <span className="flex-none w-[40px]" />
        )}

        {/* center buttons */}
        <div className="flex-auto flex justify-center gap-4">
          <button
            onClick={handleClear}
            className="px-4 py-2 font-bold border border-accent-soft bg-surface-elevated text-accent rounded-xl hover:bg-accent hover:text-on-brand transition"
          >
            다시 쓰기
          </button>
          <button
            onClick={handleFinish}
            disabled={dSmallList.length === 0}
            className="px-4 py-2 font-bold border border-accent bg-accent-soft text-on-brand rounded-xl enabled:hover:bg-accent enabled:hover:text-on-brand disabled:opacity-40 transition"
          >
            {isLast ? '완성하기' : '다음 글자'}
          </button>
        </div>

        {/* next */}
        {onNext ? (
          <button
            onClick={onNext}
            disabled={!canNext}
            className="flex-none px-2 py-1 text-2xl text-accent disabled:opacity-30 hover:bg-accent-soft/20"
            aria-label="다음 글자"
          >
            <ArrowRight className="text-accent" />
          </button>
        ) : (
          <span className="flex-none w-[40px]" />
        )}
      </div>
    </div>
  );
}
