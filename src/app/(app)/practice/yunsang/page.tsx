'use client';

import { useState, useRef, useCallback } from 'react';
import { ChevronRight, RotateCcw } from 'lucide-react';
import {
  KARMA_PAIRS, KARMA_STRENGTH, BODY_MIND, WHEEL_RANGES, OUTCOMES,
  KARMA_PAIR_CATEGORY,
  type KarmaStrength,
} from '@/data/yunsangData';

// ── 애니메이션 CSS ────────────────────────────────────────────
const STYLE = `
  /* 조각 자체: X축 회전(면 결정) + 미세 수직 흔들림 */
  @keyframes toss3d {
    0%   { transform: translateY(0px)   rotateX(0deg); }
    18%  { transform: translateY(-20px) rotateX(var(--s)); }
    100% { transform: translateY(0px)   rotateX(var(--f)); }
  }
  .toss3d {
    animation: toss3d var(--dur,1.4s) cubic-bezier(0.12,0,0.08,1) forwards;
    animation-delay: var(--d,0ms);
  }
  @keyframes land {
    0%   { transform: scaleY(0.82); }
    45%  { transform: scaleY(1.05); }
    100% { transform: scaleY(1); }
  }
  .landed { animation: land 0.22s ease-out forwards; }

  /* 포물선 비행: 손에서 던져져 바닥에 흩어짐 */
  @keyframes throwArc {
    0%   { transform: translate(var(--sx),var(--sy)) rotateZ(0deg) scale(0.84); opacity:0; }
    7%   { opacity:1; }
    36%  { transform: translate(calc(var(--sx)*0.27), calc(var(--sy)*0.27 - var(--pk))) rotateZ(calc(var(--rz)*0.54)) scale(1.06); }
    73%  { transform: translate(calc(var(--sx)*0.05), calc(var(--sy)*0.05 - 8px)) rotateZ(calc(var(--rz)*0.89)) scale(1); }
    87%  { transform: translate(0px, 10px) rotateZ(calc(var(--rz)*1.05)) scaleY(0.78) scaleX(1.05); }
    94%  { transform: translate(0px, -4px) rotateZ(calc(var(--rz)*0.97)) scaleY(1.07) scaleX(0.97); }
    100% { transform: translate(0px, 0px) rotateZ(var(--rz)) scale(1); opacity:1; }
  }
  .throw-arc {
    animation: throwArc var(--td,1.35s) cubic-bezier(0.22,0,0.36,1) forwards;
    animation-delay: var(--tdelay,0ms);
  }
`;

// ── 타입 ──────────────────────────────────────────────────────
type FlowStage =
  | 'intro'
  | 'stage1-ready' | 'stage1-result'
  | 'stage2-ready' | 'stage2-result'
  | 'stage3-ready' | 'stage3-result'
  | 'final';

interface S1Result { index: number; isGood: boolean }
interface S2Result { key: 'body'|'speech'|'mind'; strength: KarmaStrength; isAligned: boolean }

type Face = { label: string; sub?: string; bg: string; textColor: string; markType?: string };
interface ScatterParam { lx: number; ly: number; sx: number; sy: number; rz: number; peak: number; dur: number; delay: number }

// ── 유틸 ──────────────────────────────────────────────────────
function pick<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function rndInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function rndF(min: number, max: number) { return Math.random() * (max - min) + min; }

// ── 3D 목륜 컴포넌트 ───────────────────────────────────────────
// 실물: 새끼손가락 굵기의 4면 직육면체 나무 조각
// CSS preserve-3d: rotateX(0)=face0(위), rotateX(-90)=face1, rotateX(-180)=face2(아래), rotateX(-270)=face3
interface Piece3DProps {
  W: number;        // 길이 방향 (px)
  H: number;        // 단면 한 변 (px) — 정사각형 단면
  faces: [Face, Face, Face, Face]; // 위·앞·아래·뒤 순
  landFace: 0|1|2|3;
  spinning: boolean;
  spins: number;    // 전체 회전 수
  delay: number;    // ms
  landed: boolean;
}

function Piece3D({ W, H, faces, landFace, spinning, spins, delay, landed }: Piece3DProps) {
  const half = H / 2;
  // 최종 회전각: -(spins * 360 + landFace * 90)
  const finalRot = -(spins * 360 + landFace * 90);
  // 초반 빠른 기동을 위한 임시 각도
  const startRot = -(spins * 360 * 0.12);

  const faceStyle = (rotX: number): React.CSSProperties => ({
    position: 'absolute',
    width: W,
    height: H,
    transform: `rotateX(${rotX}deg) translateZ(${half}px)`,
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    overflow: 'hidden',
  });

  return (
    <div style={{ perspective: 280, display: 'inline-block', verticalAlign: 'middle' }}>
      <div
        className={spinning ? 'toss3d' : ''}
        style={{
          width: W,
          height: H,
          position: 'relative',
          transformStyle: 'preserve-3d',
          transform: spinning ? undefined : `translateY(0) rotateX(${finalRot}deg)`,
          ...(spinning ? {
            '--s': `${startRot}deg`,
            '--f': `${finalRot}deg`,
            '--dur': `${1.2 + Math.random() * 0.4}s`,
            '--d': `${delay}ms`,
          } as React.CSSProperties : {}),
        }}
      >
        {([0, -90, -180, -270] as const).map((rotX, fi) => {
          const face = faces[fi];
          return (
            <div key={fi} style={{
              ...faceStyle(rotX),
              background: face.bg,
            }}>
              {/* 나뭇결 */}
              <div style={{
                position: 'absolute', inset: 0, opacity: 0.12,
                background: 'repeating-linear-gradient(90deg,#000 0,transparent 1px,transparent 5px,#000 6px)',
                pointerEvents: 'none',
              }} />
              {face.markType ? (
                <FaceMark type={face.markType} textColor={face.textColor} W={W} H={H} />
              ) : (
                <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', lineHeight: 1.1 }}>
                  <div style={{ fontSize: H * 0.38, fontWeight: 700, color: face.textColor }}>
                    {face.label}
                  </div>
                  {face.sub && (
                    <div style={{ fontSize: H * 0.24, color: face.textColor, opacity: 0.55 }}>
                      {face.sub}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* 옆면 (단면 엣지) - 깊이감 */}
        <div style={{
          position: 'absolute',
          width: H, height: H,
          left: -(H / 2),
          transformStyle: 'preserve-3d',
          transform: `rotateY(-90deg) translateZ(${H / 2}px)`,
          background: '#7a4e1a',
          opacity: 0.7,
          borderRadius: 2,
        }} />
        <div style={{
          position: 'absolute',
          width: H, height: H,
          right: -(H / 2),
          transformStyle: 'preserve-3d',
          transform: `rotateY(90deg) translateZ(${H / 2}px)`,
          background: '#7a4e1a',
          opacity: 0.7,
          borderRadius: 2,
        }} />
      </div>

      {/* 그림자 */}
      <div style={{
        width: W * 0.7,
        height: 4,
        margin: '4px auto 0',
        background: 'rgba(0,0,0,0.15)',
        borderRadius: '50%',
        filter: 'blur(3px)',
        transition: 'opacity 0.3s',
        opacity: spinning ? 0 : 1,
      }} />

      {/* 착지 마커 */}
      {landed && !spinning && (
        <div className="landed" style={{ width: W, textAlign: 'center', marginTop: 2, fontSize: 9, color: '#a07030', fontWeight: 600 }}>
          {faces[landFace].label}
        </div>
      )}
    </div>
  );
}

// 2차 윤 면 마킹 (획·방각)
function FaceMark({ type, textColor, W, H }: { type: string; textColor: string; W: number; H: number }) {
  const stroke = textColor;
  const cy = H / 2;
  return (
    <svg width={W} height={H} style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
      {type === 'good-strong' && (
        <line x1={W*0.15} y1={cy} x2={W*0.85} y2={cy} stroke={stroke} strokeWidth={H*0.22} strokeLinecap="round" />
      )}
      {type === 'good-weak' && (
        <line x1={W*0.32} y1={cy} x2={W*0.68} y2={cy} stroke={stroke} strokeWidth={H*0.1} strokeLinecap="round" />
      )}
      {type === 'evil-strong' && (<>
        <rect x={W*0.12} y={cy - H*0.18} width={W*0.76} height={H*0.36} rx={2} fill={stroke} opacity={0.85} />
        <line x1={W*0.12} y1={cy - H*0.06} x2={W*0.88} y2={cy - H*0.06} stroke="rgba(0,0,0,0.25)" strokeWidth={1} />
        <line x1={W*0.12} y1={cy + H*0.06} x2={W*0.88} y2={cy + H*0.06} stroke="rgba(0,0,0,0.25)" strokeWidth={1} />
      </>)}
      {type === 'evil-weak' && (
        <rect x={W*0.28} y={cy - H*0.12} width={W*0.44} height={H*0.24} rx={2} fill={stroke} opacity={0.45} />
      )}
    </svg>
  );
}

// ── 면 데이터 생성 헬퍼 ───────────────────────────────────────
const WOOD_BG       = 'linear-gradient(to bottom, #e8c87a 0%, #c89040 45%, #b87028 50%, #c89040 55%, #e8c87a 100%)';
const WOOD_SIDE_BG  = 'linear-gradient(to bottom, #d4a050 0%, #a06820 50%, #d4a050 100%)';
const GOOD_BG       = 'linear-gradient(to bottom, #d4e8f8 0%, #a8c8e8 50%, #d4e8f8 100%)';
const EVIL_BG       = 'linear-gradient(to bottom, #f8d4d4 0%, #e89898 50%, #f8d4d4 100%)';

function makeStage1Faces(good: string, goodHanja: string, evil: string, evilHanja: string): [Face,Face,Face,Face] {
  return [
    { label: good,  sub: goodHanja,  bg: GOOD_BG,      textColor: '#1a4a7a' },
    { label: '',    bg: WOOD_SIDE_BG, textColor: 'transparent' },
    { label: evil,  sub: evilHanja,  bg: EVIL_BG,      textColor: '#7a1a1a' },
    { label: '',    bg: WOOD_SIDE_BG, textColor: 'transparent' },
  ];
}

function makeStage2Faces(): [Face,Face,Face,Face][] {
  const STRENGTH_COLORS: Record<KarmaStrength, { bg: string; text: string }> = {
    'good-strong': { bg: GOOD_BG,        text: '#1a4a7a' },
    'good-weak':   { bg: 'linear-gradient(to bottom,#e8f4fc,#c8e4f4,#e8f4fc)', text: '#2a5a8a' },
    'evil-strong': { bg: EVIL_BG,        text: '#7a1a1a' },
    'evil-weak':   { bg: 'linear-gradient(to bottom,#fce8e8,#f4c8c8,#fce8e8)', text: '#8a2a2a' },
  };
  return BODY_MIND.map((_, bi) => {
    const order: KarmaStrength[] = ['good-strong','good-weak','evil-strong','evil-weak'];
    void bi;
    return order.map(s => ({
      label: KARMA_STRENGTH[s].label.split('(')[0],
      bg: STRENGTH_COLORS[s].bg,
      textColor: STRENGTH_COLORS[s].text,
      markType: s,
    })) as [Face,Face,Face,Face];
  });
}

function makeStage3Faces(range: readonly [number,number,number]): [Face,Face,Face,Face] {
  return [
    { label: String(range[0]), bg: WOOD_BG,       textColor: '#5a3000' },
    { label: String(range[1]), bg: WOOD_SIDE_BG,  textColor: '#5a3000' },
    { label: String(range[2]), bg: WOOD_SIDE_BG,  textColor: '#5a3000' },
    { label: '',               bg: WOOD_SIDE_BG,  textColor: 'transparent' }, // 빈 면 — 경전: 3면에 숫자, 1면은 공백
  ];
}

// ── 캔버스 유틸 ───────────────────────────────────────────────
const CANVAS_H = 240;
const HAND_RATIO = 0.80; // 손 위치: 캔버스 높이의 80%

function buildScatter(n: number, pW: number, pH: number, canvasW: number): ScatterParam[] {
  const pad = 10;
  const handX = canvasW / 2;
  const handY = CANVAS_H * HAND_RATIO;
  const maxLy  = handY - pH - pad * 2; // 손 위쪽에만 착지

  return Array.from({ length: n }, (_, i) => {
    const lx = rndF(pad, canvasW - pW - pad);
    const ly = rndF(pad, Math.max(pad + pH, maxLy));
    return {
      lx, ly,
      sx: handX - (lx + pW / 2),
      sy: handY - (ly + pH / 2),
      rz: rndF(-30, 30),
      peak: rndF(85, 165),
      dur: rndF(1.1, 1.45),
      delay: i * 40,
    };
  });
}

function throwVars(p: ScatterParam): React.CSSProperties {
  return {
    '--sx': `${p.sx}px`, '--sy': `${p.sy}px`,
    '--rz': `${p.rz}deg`, '--pk': `${p.peak}px`,
    '--td': `${p.dur}s`, '--tdelay': `${p.delay}ms`,
  } as React.CSSProperties;
}

// ── 스테이지 헤더 ─────────────────────────────────────────────
function StageHeader({ step, title }: { step: number; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="w-7 h-7 rounded-full bg-accent text-on-brand flex items-center justify-center text-xs font-bold shrink-0">{step}</span>
      <h2 className="text-sm font-semibold text-accent">{title}</h2>
    </div>
  );
}

function ThrowBtn({ onClick, disabled, label }: { onClick():void; disabled:boolean; label:string }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`w-full py-4 rounded-2xl font-semibold text-base transition-opacity ${disabled?'opacity-40':''} bg-accent text-on-brand`}>
      {disabled ? '굴리는 중…' : label}
    </button>
  );
}

// ── 메인 ─────────────────────────────────────────────────────
export default function YunsangPage() {
  const [stage,     setStage]     = useState<FlowStage>('intro');
  const [spinning,  setSpinning]  = useState(false);
  const [landed,    setLanded]    = useState(false);

  const [s1Results, setS1Results] = useState<S1Result[]>([]);
  const [s2Results, setS2Results] = useState<S2Result[]>([]);
  const [s2ThrowIdx, setS2ThrowIdx] = useState(0); // 0=신업, 1=구업, 2=의업 순서
  const [s3Rounds,    setS3Rounds]    = useState<number[][]>([]);
  const [s3Total,     setS3Total]     = useState(0);
  const [s3LastRound, setS3LastRound] = useState<(number | null)[]>([]);
  const [s3BlankThrow, setS3BlankThrow] = useState(false);

  const canvasRef   = useRef<HTMLDivElement>(null);
  const spinsRef    = useRef<number[]>([]);
  const s1ScatterRef = useRef<ScatterParam[]>([]);
  const s2ScatterRef = useRef<ScatterParam[]>([]);
  const s3ScatterRef = useRef<ScatterParam[]>([]);

  function prepareThrow(n: number) {
    spinsRef.current = Array.from({ length: n }, () => rndInt(3, 6));
    setLanded(false);
  }

  const canvasW = useCallback(() => canvasRef.current?.clientWidth ?? 380, []);

  const maxDur = useCallback((n: number) => {
    return (n - 1) * 40 + 1900;
  }, []);

  function doThrow(n: number, fn: () => void) {
    prepareThrow(n);
    setSpinning(true);
    setTimeout(() => {
      fn();
      setSpinning(false);
      setLanded(true);
    }, maxDur(n));
  }

  function throwS1() {
    s1ScatterRef.current = buildScatter(10, 60, 18, canvasW());
    doThrow(10, () => {
      setS1Results(KARMA_PAIRS.map((_, i) => ({ index: i, isGood: Math.random() < 0.5 })));
      setStage('stage1-result');
    });
  }

  // 경전: "이 세 개의 윤을 한꺼번에 던져서는 안 되며, 하나하나 해당하는 윤으로 따로 점쳐야 합니다"
  // → 신/구/의 윤을 하나씩 순서대로 던짐
  function checkS2Alignment(wheelKey: 'body' | 'speech' | 'mind', strength: KarmaStrength): boolean {
    const relevant = KARMA_PAIR_CATEGORY
      .map((cat, idx) => cat === wheelKey ? idx : -1)
      .filter(idx => idx >= 0);
    const catResults = s1Results.filter(r => relevant.includes(r.index));
    const hasGood = catResults.some(r => r.isGood);
    const hasEvil = catResults.some(r => !r.isGood);
    const resultIsGood = strength === 'good-strong' || strength === 'good-weak';
    if (hasGood && !hasEvil) return resultIsGood;   // 선만 → 선 결과여야 상응
    if (!hasGood && hasEvil) return !resultIsGood;  // 악만 → 악 결과여야 상응
    return true; // 선악 혼재 → 어느 결과도 상응
  }

  function throwS2() {
    s2ScatterRef.current = buildScatter(1, 80, 24, canvasW());
    doThrow(1, () => {
      const bm = BODY_MIND[s2ThrowIdx];
      const strength = pick<KarmaStrength>(['good-strong','good-weak','evil-strong','evil-weak']);
      const isAligned = checkS2Alignment(bm.key, strength);
      setS2Results(prev => [...prev, { key: bm.key, strength, isAligned }]);
    });
  }

  function nextS2() {
    if (s2ThrowIdx >= BODY_MIND.length - 1) {
      setStage('stage2-result');
    } else {
      setS2ThrowIdx(prev => prev + 1);
      setLanded(false);
    }
  }

  function throwS3() {
    s3ScatterRef.current = buildScatter(6, 48, 16, canvasW());
    doThrow(6, () => {
      // 각 윤은 4면(숫자 3 + 빈 면 1) → 빈 면이 나오면 다시 던져야 함
      const lastRound = WHEEL_RANGES.map(r => {
        const fi = Math.floor(Math.random() * 4);
        return fi < 3 ? r[fi] : null;
      });
      setS3LastRound(lastRound);
      const hasBlank = lastRound.some(v => v === null);
      if (hasBlank) {
        setS3BlankThrow(true);
      } else {
        const nums = lastRound as number[];
        const rounds = [...s3Rounds, nums];
        setS3Rounds(rounds);
        setS3BlankThrow(false);
        if (rounds.length === 3) {
          setS3Total(rounds.flat().reduce((a, b) => a + b, 0));
          setStage('stage3-result');
        }
      }
    });
  }

  function reset() {
    setStage('intro'); setSpinning(false); setLanded(false);
    setS1Results([]); setS2Results([]); setS2ThrowIdx(0); setS3Rounds([]); setS3Total(0);
    setS3LastRound([]); setS3BlankThrow(false);
  }

  const outcome  = OUTCOMES.find(o => o.num === s3Total) ?? OUTCOMES[152];
  const goodCount = s1Results.filter(r => r.isGood).length;

  // S2 랜덤 faces 한 번만 생성 (결과 확정 전에도 faces 구조 필요)
  const s2FacesRef = useRef(makeStage2Faces());

  return (
    <>
      <style>{STYLE}</style>
      <main className="w-full max-w-[460px] px-5 pt-4 pb-8 overflow-y-auto">

        {stage !== 'intro' && (
          <div className="flex justify-end mb-1">
            <button onClick={reset} className="flex items-center gap-1 text-xs text-accent/50 py-1 px-2">
              <RotateCcw size={13} />처음부터
            </button>
          </div>
        )}

        {/* ── 인트로 ── */}
        {stage === 'intro' && (
          <div className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-2xl p-5 border border-amber-200">
              <p className="text-xs font-semibold text-amber-700 mb-1.5">점찰선악업보경(占察善惡業報經)</p>
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">
                &ldquo;장애와 어려움이 있을 때에는 마땅히 목륜상(木輪相)의 법을 써서 지난 세상에 지었던 선악의 업과 현재의 고락과 길흉 등의 일을 점쳐 살펴야 할 것입니다.&rdquo;
              </p>
            </div>
            {[
              { n:'1', t:'1차 윤 — 10개', d:'선업(善業)과 악업(惡業)의 차별' },
              { n:'2', t:'2차 윤 — 3개',  d:'신·구·의(身口意) 업의 강약' },
              { n:'3', t:'3차 윤 — 6개×3회', d:'삼세 과보 189종 중 하나' },
            ].map(x => (
              <div key={x.n} className="flex gap-3 items-start">
                <span className="shrink-0 w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center text-[10px] font-bold text-accent mt-0.5">{x.n}</span>
                <div>
                  <p className="text-sm font-semibold text-accent">{x.t}</p>
                  <p className="text-xs text-accent/60">{x.d}</p>
                </div>
              </div>
            ))}
            <p className="text-xs text-accent/40 leading-relaxed">지극한 마음으로 시방의 모든 부처님과 지장보살마하살께 귀의하고 시작하십시오.</p>
            <button onClick={() => setStage('stage1-ready')}
              className="w-full py-4 rounded-2xl bg-accent text-on-brand font-semibold text-base">
              시작하기
            </button>
          </div>
        )}

        {/* ── 1차 윤 ── */}
        {(stage === 'stage1-ready' || stage === 'stage1-result') && (
          <div className="space-y-5">
            <StageHeader step={1} title="1차 윤 — 선악업의 차별" />
            {stage === 'stage1-ready' && (
              <p className="text-xs text-accent/60 leading-relaxed">
                각 목륜의 한 면에는 선업, 반대 면에는 악업이 새겨져 있습니다.<br />
                10개를 한꺼번에 던져 어느 면이 나오는지 살핍니다.
              </p>
            )}

            {/* 목륜 던지기 캔버스 */}
            <div
              ref={canvasRef}
              className="relative w-full rounded-2xl border border-amber-200 dark:border-amber-800/50 overflow-hidden my-1"
              style={{
                height: CANVAS_H,
                background: 'linear-gradient(170deg,#fdf9f0 0%,#f0e8d0 100%)',
                backgroundImage: [
                  'linear-gradient(rgba(160,120,50,0.06) 1px,transparent 1px)',
                  'linear-gradient(90deg,rgba(160,120,50,0.06) 1px,transparent 1px)',
                  'linear-gradient(170deg,#fdf9f0 0%,#f0e8d0 100%)',
                ].join(','),
                backgroundSize: '20px 20px,20px 20px,100% 100%',
                boxShadow: 'inset 0 -8px 16px rgba(100,60,10,0.08)',
              }}
            >
              {(spinning || landed) && KARMA_PAIRS.map((pair, i) => {
                const p = s1ScatterRef.current[i];
                if (!p) return null;
                const result = s1Results[i];
                const landFace: 0|2 = result ? (result.isGood ? 0 : 2) : 0;
                const faces = makeStage1Faces(pair.good, pair.goodHanja, pair.evil, pair.evilHanja);
                return (
                  <div
                    key={i}
                    className={spinning ? 'throw-arc' : ''}
                    style={{
                      position: 'absolute',
                      left: p.lx,
                      top: p.ly,
                      ...(spinning ? throwVars(p) : {}),
                      ...(!spinning && landed ? {
                        transform: `rotateZ(${p.rz}deg)`,
                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.22))',
                      } : {}),
                    }}
                  >
                    <Piece3D
                      W={60} H={18}
                      faces={faces}
                      landFace={landFace}
                      spinning={spinning}
                      spins={spinsRef.current[i] ?? 4}
                      delay={p.delay}
                      landed={landed && !!result}
                    />
                  </div>
                );
              })}
              {!spinning && !landed && (
                <div className="absolute inset-0 flex items-end justify-center pb-5 text-amber-800/25 text-xs tracking-widest select-none">
                  목륜을 던져보세요
                </div>
              )}
              {/* 손 위치 표시선 */}
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-amber-300/30 dark:bg-amber-700/20" style={{ bottom: `${(1-HAND_RATIO)*CANVAS_H}px` }} />
            </div>

            {stage === 'stage1-result' && (
              <div className="bg-surface-elevated rounded-xl p-4 border border-accent-soft text-sm space-y-1.5">
                <div className="flex gap-4">
                  <span className="text-blue-700 font-semibold">선업 {goodCount}개</span>
                  <span className="text-red-700 font-semibold">악업 {10 - goodCount}개</span>
                </div>
                <p className="text-xs text-accent/60 leading-relaxed">
                  {goodCount > 5 ? '선업이 우세합니다. 지금까지 쌓아온 선근(善根)을 잘 유지하십시오.'
                   : goodCount === 5 ? '선악업이 균형을 이룹니다. 더욱 선업에 힘쓰십시오.'
                   : '악업이 우세합니다. 지장보살을 염(念)하며 참회 수행에 힘쓰십시오.'}
                </p>
              </div>
            )}

            {stage === 'stage1-ready'
              ? <ThrowBtn onClick={throwS1} disabled={spinning} label="목륜 던지기" />
              : <button onClick={() => setStage('stage2-ready')}
                  className="w-full py-4 rounded-2xl bg-accent text-on-brand font-semibold flex items-center justify-center gap-2">
                  2차 윤으로 <ChevronRight size={18} />
                </button>
            }
          </div>
        )}

        {/* ── 2차 윤 ── */}
        {(stage === 'stage2-ready' || stage === 'stage2-result') && (
          <div className="space-y-5">
            <StageHeader step={2} title="2차 윤 — 신·구·의 업의 강약" />

            {/* 현재 던질 카테고리 컨텍스트: 해당 1차 결과 표시 */}
            {stage === 'stage2-ready' && (
              <div className="bg-surface-elevated rounded-xl p-3 border border-accent-soft text-xs space-y-2">
                <p className="font-semibold text-accent">
                  {BODY_MIND[s2ThrowIdx].label} 던지기 ({s2ThrowIdx + 1} / {BODY_MIND.length})
                </p>
                <p className="text-accent/55">1차 윤 — 이 카테고리에 해당하는 업:</p>
                <div className="flex flex-wrap gap-1.5">
                  {s1Results
                    .filter(r => KARMA_PAIR_CATEGORY[r.index] === BODY_MIND[s2ThrowIdx].key)
                    .map(r => (
                      <span key={r.index}
                        className={`px-2 py-0.5 rounded font-medium ${r.isGood ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'}`}>
                        {r.isGood ? KARMA_PAIRS[r.index].good : KARMA_PAIRS[r.index].evil}
                      </span>
                    ))}
                </div>
              </div>
            )}

            {/* 목륜 던지기 캔버스 — 경전: "하나하나 해당하는 윤으로 따로 점쳐야" → 한 번에 1개씩 */}
            <div
              ref={canvasRef}
              className="relative w-full rounded-2xl border border-amber-200 dark:border-amber-800/50 overflow-hidden my-1"
              style={{
                height: CANVAS_H,
                background: 'linear-gradient(170deg,#fdf9f0 0%,#f0e8d0 100%)',
                backgroundImage: [
                  'linear-gradient(rgba(160,120,50,0.06) 1px,transparent 1px)',
                  'linear-gradient(90deg,rgba(160,120,50,0.06) 1px,transparent 1px)',
                  'linear-gradient(170deg,#fdf9f0 0%,#f0e8d0 100%)',
                ].join(','),
                backgroundSize: '20px 20px,20px 20px,100% 100%',
                boxShadow: 'inset 0 -8px 16px rgba(100,60,10,0.08)',
              }}
            >
              {stage === 'stage2-ready' && (spinning || landed) && (() => {
                const p = s2ScatterRef.current[0];
                if (!p) return null;
                const result = s2Results[s2Results.length - 1];
                const faces = s2FacesRef.current[s2ThrowIdx];
                const strengthOrder: KarmaStrength[] = ['good-strong','good-weak','evil-strong','evil-weak'];
                const landFace = (result && landed) ? (strengthOrder.indexOf(result.strength) as 0|1|2|3) : 0;
                return (
                  <div
                    className={spinning ? 'throw-arc' : ''}
                    style={{
                      position: 'absolute',
                      left: p.lx,
                      top: p.ly,
                      ...(spinning ? throwVars(p) : {}),
                      ...(!spinning && landed ? {
                        transform: `rotateZ(${p.rz}deg)`,
                        filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.24))',
                      } : {}),
                    }}
                  >
                    <Piece3D
                      W={80} H={24}
                      faces={faces}
                      landFace={landFace}
                      spinning={spinning}
                      spins={spinsRef.current[0] ?? 4}
                      delay={p.delay}
                      landed={landed && !!result}
                    />
                  </div>
                );
              })()}
              {!spinning && !landed && (
                <div className="absolute inset-0 flex items-end justify-center pb-5 text-amber-800/25 text-xs tracking-widest select-none">
                  목륜을 던져보세요
                </div>
              )}
              <div className="absolute left-0 right-0 h-[1px] bg-amber-300/30 dark:bg-amber-700/20" style={{ bottom: `${(1-HAND_RATIO)*CANVAS_H}px` }} />
            </div>

            {/* 누적 결과 (던질 때마다 추가됨) */}
            {s2Results.length > 0 && (
              <div className="bg-surface-elevated rounded-xl p-4 border border-accent-soft space-y-2.5">
                {s2Results.map((r, idx) => {
                  const bm = BODY_MIND.find(b => b.key === r.key)!;
                  const info = KARMA_STRENGTH[r.strength];
                  const isLatest = idx === s2Results.length - 1;
                  return (
                    <div key={r.key} className={`flex items-start gap-2 text-sm transition-opacity ${isLatest ? 'opacity-100' : 'opacity-60'}`}>
                      <span className="font-semibold text-accent w-16 shrink-0">{bm.label}</span>
                      <div className="flex-1">
                        <span className={`font-semibold ${info.color}`}>{info.label}</span>
                        {!r.isAligned && (
                          <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">⚠ 서로 호응하지 않음</span>
                        )}
                        <p className="text-xs text-accent/55 mt-0.5">{info.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 정합 불일치 경고 (마지막 결과가 호응하지 않을 때) */}
            {stage === 'stage2-ready' && landed && s2Results.length > 0 && !s2Results[s2Results.length - 1].isAligned && (
              <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 border border-amber-200">
                1차 윤상의 결과와 서로 호응하지 않습니다. 지극한 마음으로 점찰해야 합니다.
              </p>
            )}

            {/* 버튼 */}
            {stage === 'stage2-ready' && !landed && (
              <ThrowBtn onClick={throwS2} disabled={spinning} label={`${BODY_MIND[s2ThrowIdx].label} 던지기`} />
            )}
            {stage === 'stage2-ready' && landed && (
              <button onClick={nextS2}
                className="w-full py-4 rounded-2xl bg-accent text-on-brand font-semibold flex items-center justify-center gap-2">
                {s2ThrowIdx < BODY_MIND.length - 1
                  ? <>{BODY_MIND[s2ThrowIdx + 1].label} 던지기 <ChevronRight size={18} /></>
                  : <>결과 확인 <ChevronRight size={18} /></>}
              </button>
            )}
            {stage === 'stage2-result' && (
              <button onClick={() => setStage('stage3-ready')}
                className="w-full py-4 rounded-2xl bg-accent text-on-brand font-semibold flex items-center justify-center gap-2">
                3차 윤으로 <ChevronRight size={18} />
              </button>
            )}
          </div>
        )}

        {/* ── 3차 윤 ── */}
        {(stage === 'stage3-ready' || stage === 'stage3-result') && (
          <div className="space-y-5">
            <StageHeader step={3} title={`3차 윤 — ${s3Rounds.length}/3회`} />
            {s3Rounds.length === 0 && !s3BlankThrow && (
              <p className="text-xs text-accent/60 leading-relaxed">
                6개의 목륜을 세 번 던집니다. 각 목륜은 3면에 숫자, 1면은 비어있습니다.<br />
                빈 면이 나오면 다시 던지고, 세 번의 합산으로 189종 과보 중 하나가 정해집니다.
              </p>
            )}
            {s3BlankThrow && !spinning && (
              <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 border border-amber-200 text-center">
                빈 면이 나왔습니다. 지극한 마음으로 다시 던지십시오.
              </p>
            )}

            {/* 목륜 던지기 캔버스 */}
            <div
              ref={canvasRef}
              className="relative w-full rounded-2xl border border-amber-200 dark:border-amber-800/50 overflow-hidden my-1"
              style={{
                height: CANVAS_H,
                background: 'linear-gradient(170deg,#fdf9f0 0%,#f0e8d0 100%)',
                backgroundImage: [
                  'linear-gradient(rgba(160,120,50,0.06) 1px,transparent 1px)',
                  'linear-gradient(90deg,rgba(160,120,50,0.06) 1px,transparent 1px)',
                  'linear-gradient(170deg,#fdf9f0 0%,#f0e8d0 100%)',
                ].join(','),
                backgroundSize: '20px 20px,20px 20px,100% 100%',
                boxShadow: 'inset 0 -8px 16px rgba(100,60,10,0.08)',
              }}
            >
              {(spinning || landed) && WHEEL_RANGES.map((range, i) => {
                const p = s3ScatterRef.current[i];
                if (!p) return null;
                const val = s3LastRound[i]; // number | null | undefined
                const faces = makeStage3Faces(range);
                const faceIdx: 0|1|2|3 = typeof val === 'number'
                  ? range.indexOf(val) as 0|1|2
                  : val === null ? 3 : 0; // 3 = 빈 면
                return (
                  <div
                    key={i}
                    className={spinning ? 'throw-arc' : ''}
                    style={{
                      position: 'absolute',
                      left: p.lx,
                      top: p.ly,
                      ...(spinning ? throwVars(p) : {}),
                      ...(!spinning && landed ? {
                        transform: `rotateZ(${p.rz}deg)`,
                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.22))',
                      } : {}),
                    }}
                  >
                    <Piece3D
                      W={48} H={16}
                      faces={faces}
                      landFace={faceIdx as 0|1|2|3}
                      spinning={spinning}
                      spins={spinsRef.current[i] ?? 4}
                      delay={p.delay}
                      landed={landed && val !== undefined}
                    />
                  </div>
                );
              })}
              {!spinning && !landed && (
                <div className="absolute inset-0 flex items-end justify-center pb-5 text-amber-800/25 text-xs tracking-widest select-none">
                  목륜을 던져보세요
                </div>
              )}
              <div className="absolute left-0 right-0 h-[1px] bg-amber-300/30 dark:bg-amber-700/20" style={{ bottom: `${(1-HAND_RATIO)*CANVAS_H}px` }} />
            </div>

            {s3Rounds.length > 0 && (
              <div className="bg-surface-elevated rounded-xl p-3 border border-accent-soft space-y-1.5">
                {s3Rounds.map((round, ri) => (
                  <div key={ri} className="flex items-center gap-2 text-xs">
                    <span className="text-accent/50 w-10">{ri+1}회</span>
                    <div className="flex gap-1 flex-wrap flex-1">
                      {round.map((v, vi) => (
                        <span key={vi} className="px-1.5 py-0.5 bg-amber-100 rounded text-amber-900 font-mono">{v}</span>
                      ))}
                    </div>
                    <span className="font-medium text-accent">{round.reduce((a,b)=>a+b,0)}</span>
                  </div>
                ))}
                {s3Rounds.length > 1 && (
                  <div className="flex justify-between pt-1 border-t border-accent-soft/50 text-sm font-semibold text-accent">
                    <span>합산</span><span>{s3Rounds.flat().reduce((a,b)=>a+b,0)}</span>
                  </div>
                )}
              </div>
            )}

            {stage === 'stage3-ready' && (
              <ThrowBtn onClick={throwS3} disabled={spinning}
                label={s3Rounds.length===0?'1회 던지기':s3Rounds.length===1?'2회 던지기':'3회 던지기'} />
            )}
            {stage === 'stage3-result' && (
              <button onClick={() => setStage('final')}
                className="w-full py-4 rounded-2xl bg-accent text-on-brand font-semibold flex items-center justify-center gap-2">
                과보 확인하기 <ChevronRight size={18} />
              </button>
            )}
          </div>
        )}

        {/* ── 최종 결과 ── */}
        {stage === 'final' && (
          <div className="space-y-5 pb-4">
            <p className="text-center text-xs text-accent/40">제 {s3Total}번 과보 · {outcome.category}</p>
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-2xl p-6 border border-amber-200 text-center">
              <p className="text-base font-semibold text-amber-900 dark:text-amber-100 leading-relaxed">{outcome.title}</p>
            </div>
            <div className="bg-surface-elevated rounded-2xl p-5 border border-accent-soft space-y-2">
              <p className="text-[11px] font-semibold text-accent/50 uppercase tracking-wider">해설</p>
              <p className="text-sm text-accent leading-relaxed">{outcome.guidance}</p>
            </div>
            <div className="bg-surface-elevated rounded-xl p-4 border border-accent-soft text-xs text-accent/70 space-y-1">
              <p className="font-semibold text-accent/50 mb-1">점찰 요약</p>
              <p>1차: 선업 {goodCount}개 / 악업 {10-goodCount}개</p>
              {s2Results.map(r => {
                const bm=BODY_MIND.find(b=>b.key===r.key)!;
                const info=KARMA_STRENGTH[r.strength];
                return <p key={r.key}>{bm.label}: <span className={info.color}>{info.label}</span></p>;
              })}
              <p>3차: 합산 {s3Total}번 → {outcome.title}</p>
            </div>
            <button onClick={reset}
              className="w-full py-3 rounded-2xl border border-accent-soft text-accent font-medium flex items-center justify-center gap-2">
              <RotateCcw size={16} />다시 점치기
            </button>
          </div>
        )}
      </main>
    </>
  );
}
