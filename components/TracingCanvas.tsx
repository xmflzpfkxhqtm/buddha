'use client';

import { useRef, useState, useEffect } from 'react';
type Point = [number, number];
import getStroke from 'perfect-freehand';
import {ArrowLeft, ArrowRight} from 'lucide-react';

interface Props {
    char: string;
    initialSvg?: string | null;
    guideChars: string[];               // 윗줄 7칸
    prevSvgs: (string|null)[];          // 아랫줄 7칸
    onFinish(svg: string): void;        // 저장(50px 기준 SVG)
    onClear(): void;                    // 다시 쓰기
    onPrev?: () => void;
    onNext?: () => void;
    canPrev?: boolean;
    canNext?: boolean;
    lang: 'kor' | 'han';          // ★ 추가

  }
  
  /* 셀 크기 · 확대배율 */
  const CELL  = 50;     // 한 칸 50×50 표시
  const SCALE = 6;      // 드로잉 캔버스는 4배(200×200)
  
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
  }: Props) {
    /* ───── 상태: 현재 글자 누적 d(소형 좌표) */
    const [dSmallList, setDSmallList] = useState<string[]>([]);
    useEffect(() => {
      setDSmallList(
        initialSvg
          ? [...initialSvg.matchAll(/d="([^"]+)"/g)].map(m => m[1])
          : []
      );
    }, [char, initialSvg]);
  
    /* ───── 캔버스 레퍼런스 */
    const baseRef = useRef<HTMLCanvasElement>(null);  // guide+확정
    const liveRef = useRef<HTMLCanvasElement>(null);  // 현재 stroke
  
    /* ───── 캔버스 렌더 (guide + prev + 확정 stroke) */
    useEffect(() => {
      const W = CELL * SCALE;  // 200
      const H = W;
      const base = baseRef.current!;
      base.width = W;
      base.height = H;
      const ctx = base.getContext('2d')!;
      ctx.clearRect(0, 0, W, H);
  
      /* 1) 가이드 글자 (큰 폰트) */
      const guideFont = lang === 'kor' ? "'MaruBuri'" : "'Yuji Mai'";
      ctx.font = `${CELL * SCALE * 0.7}px ${guideFont}, serif`;      ctx.textAlign   = 'center';
       ctx.textBaseline= 'alphabetic';
       ctx.globalAlpha = 0.18;
      
       const m   = ctx.measureText(char);
       const h   = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
       const y   = (H + h) / 2 - m.actualBoundingBoxDescent;  // ↓ 가운데
       ctx.fillText(char, W / 2, y);
       ctx.globalAlpha = 1;
  
      /* 2) 확정 stroke – dSmall × SCALE */
      dSmallList.forEach(dSmall => {
        ctx.save();
        ctx.scale(SCALE, SCALE);           // 좌표계 50→200
        ctx.fill(new Path2D(dSmall));
        ctx.restore();
      });
  
      /* live 레이어 리셋 */
      const live = liveRef.current!;
      live.width = W;
      live.height = H;
      live.getContext('2d')!.clearRect(0, 0, W, H);
    }, [char, dSmallList]);
  
    /* ───── 드로잉 로직 (대형 좌표계) */
    const points = useRef<Point[]>([]);
    const drawing = useRef(false);
    const liveCtx = () => liveRef.current!.getContext('2d')!;
  
    const handleDown = (e: React.PointerEvent) => {
      drawing.current = true;
      points.current = [[e.nativeEvent.offsetX, e.nativeEvent.offsetY]];
      liveCtx().beginPath();
      liveCtx().moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
      liveCtx().lineWidth = 4;
      liveCtx().lineCap = 'round';
    };
  
    const handleMove = (e: React.PointerEvent) => {
      if (!drawing.current) return;
      points.current.push([e.nativeEvent.offsetX, e.nativeEvent.offsetY]);
      liveCtx().lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
      liveCtx().stroke();
    };
  
    const finishStroke = () => {
      if (!drawing.current || points.current.length === 0) return;
      drawing.current = false;
  
      /* ❶ live 클리어 */
      liveCtx().clearRect(0, 0, CELL * SCALE, CELL * SCALE);
  
      /* ❷ points(200px) → dSmall(50px) */
      const ptsSmall = points.current.map(([x, y]) => [x / SCALE, y / SCALE] as Point);
      const options = {
        // 1. 기본 두께 ↑: 획의 가장 두꺼운 부분을 결정합니다. 붓글씨는 어느 정도 두께감이 있으므로 값을 키웁니다. (캔버스 크기(CELL)에 비례하여 조절 필요)
        size: 5, // 예시 값, 4~10 사이에서 테스트해보세요.
      
        // 2. 굵기 변화 민감도 (Thinning) ↑: 속도 변화에 따른 굵기 차이를 더 크게 만듭니다. 0에 가까울수록 굵기가 일정해지고, 1에 가까울수록 변화가 커집니다.
        thinning: 0.2, // 기존 0.7보다 약간 높여서 변화를 강조합니다. 0.7 ~ 0.9 사이에서 조절해보세요.
      
        // 3. 부드러움 (Smoothing) ↓: 값을 낮추면 코너가 덜 둥글게 처리되어 조금 더 각진 느낌을 줄 수 있습니다. 너무 낮추면 각져 보일 수 있습니다.
        smoothing: 0.2, // 기존 0.9보다 낮춰봅니다. 0.5 ~ 0.7 사이에서 테스트해보세요.
      
        // 4. 떨림 보정 (Streamline) ↓: 값을 약간 낮추면 손의 미세한 떨림이나 의도적인 꺾임이 조금 더 반영될 수 있습니다. 너무 낮추면 지저분해 보일 수 있습니다.
        streamline: 0.4, // 기존 0.45에서 약간 낮춰봅니다. 0.35 ~ 0.5 사이에서 테스트해보세요.
      
        // 5. 압력 곡선 (Easing): 기존 sin 곡선은 부드러운 시작/끝을 만듭니다. 붓글씨는 시작/끝이 더 명확할 수 있으므로, 기본값(t => t)이나 다른 곡선을 시도해볼 수 있습니다.
        // easing: t => t, // 직선적인 압력 변화 (시도해볼 옵션 1)
        easing: (t: number) => t * t, // 천천히 시작해서 빠르게 두꺼워짐 (시도해볼 옵션 2)
        // easing: t => Math.sin((t * Math.PI) / 2), // 기존 옵션 (부드러운 시작) - 유지해도 괜찮습니다.
      
        // 6. 시작/끝 가늘기 (Taper) ↑: 붓의 시작과 끝 표현을 위해 taper 값을 크게 줍니다. 0에 가까우면 거의 가늘어지지 않고, 100에 가까우면 매우 가늘게 시작/끝납니다.
        start: {
          taper: 10, // 시작 부분을 훨씬 가늘게 (기존 0.02 -> 80)
          cap: true  // 시작 부분을 둥글게 처리 (붓 느낌)
        },
        end: {
          taper: 10, // 끝 부분도 훨씬 가늘게 (기존 0.02 -> 80)
          cap: true   // 끝 부분을 둥글게 처리
        },
      
        // simulatePressure는 기본값이 true이므로 명시적으로 적지 않아도 됩니다. (속도에 따른 굵기 변화 활성화)
        // simulatePressure: true,
      };
      
      const outline = getStroke(ptsSmall, options);
                  const dSmall = outline
        .map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`)
        .join(' ') + ' Z';
  
      /* ❸ base 레이어에 dSmall × SCALE 로 fill */
      const bctx = baseRef.current!.getContext('2d')!;
      bctx.save();
      bctx.scale(SCALE, SCALE);
      bctx.fill(new Path2D(dSmall));
      bctx.restore();
  
      setDSmallList(list => [...list, dSmall]);
      points.current = [];
    };
  
    /* ───── 컨트롤 */
    const handleClear = () => {
      setDSmallList([]);
      onClear();
    };
    const handleFinish = () => {
      if (dSmallList.length === 0) return;
      const svgSmall = dSmallList.map(d => `<path d="${d}" fill="black"/>`).join('');
      onFinish(svgSmall);         // 부모에는 50px 기준 SVG 전달
      setDSmallList([]);
    };
  
    /* ───── 렌더 ───── */
    return (
      <div className="w-full flex flex-col items-center gap-2">
        {/* 윗줄 가이드 */}
        <div className="grid grid-cols-7 gap-1">
          {guideChars.map((g, i) => (
            <div
              key={i}
              className={`w-[50px] h-[50px] flex items-center justify-center text-2xl ${lang === 'kor' ? "font-['MaruBuri']" : "font-['Yuji_Mai']"} text-red-dark`}
            >
              {g}
            </div>
          ))}
        </div>
  
        {/* 아랫줄 결과 */}
        <div className="grid grid-cols-7 gap-1">
          {prevSvgs.map((svg, i) => (
            <div key={i} className="w-[50px] h-[50px] border-1 border-red-light relative rounded">
              {svg && (
                <svg
                  className="absolute inset-0"
                  viewBox={`0 0 ${CELL} ${CELL}`}
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
              )}
            </div>
          ))}
        </div>
  
        {/* 드로잉 칸 200×200 */}
        <div className="flex justify-center">
          <div
            className="relative my-8 border-2 border-red-light rounded-lg shadow-md"
            style={{ width: CELL * SCALE, height: CELL * SCALE }}
          >
            <canvas ref={baseRef} className="absolute inset-0" />
            <canvas
              ref={liveRef}
              className="absolute inset-0 select-none touch-none"
              onPointerDown={handleDown}
              onPointerMove={handleMove}
              onPointerUp={finishStroke}
              onPointerLeave={finishStroke}
            />
          </div>
        </div>
  
        {/* 버튼 */}
        <div className="flex items-center w-full mt-2">
          {/* ← 이전 (flex-none : 줄어들지도 늘어나지도 않음) */}
          {onPrev ? (
            <button
              onClick={onPrev}
              disabled={!canPrev}
              className="flex-none px-2 py-1 text-2xl text-red-dark disabled:opacity-30 hover:bg-red-100"
              aria-label="이전 글자"
            >
              <ArrowLeft className="text-red" />
            </button>
          ) : (
            <span className="flex-none w-[40px]" />
          )}

          {/* 가운데 버튼 그룹 (flex-auto + justify-center) */}
          <div className="flex-auto flex justify-center gap-4">
            <button
              onClick={handleClear}
              className="px-4 py-2 font-bold border border-red-light bg-white text-red-dark rounded-xl hover:bg-red hover:text-white transition"
            >
              다시 쓰기
            </button>
            <button
              onClick={handleFinish}
              disabled={dSmallList.length === 0}
              className="px-4 py-2 font-bold border border-red bg-red-light text-white rounded-xl enabled:hover:bg-red enabled:hover:text-white disabled:opacity-40 transition"
            >
              다음 글자
            </button>
          </div>

          {/* 다음 → */}
          {onNext ? (
            <button
              onClick={onNext}
              disabled={!canNext}
              className="flex-none px-2 py-1 text-2xl text-red-dark disabled:opacity-30 hover:bg-red-100"
              aria-label="다음 글자"
            >
              <ArrowRight className="text-red" />
              </button>
          ) : (
            <span className="flex-none w-[40px]" />
          )}
        </div>

      </div>
    );
  }
  