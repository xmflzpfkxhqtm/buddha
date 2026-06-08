'use client';

import { useState, useEffect, useRef } from 'react';
import { BookOpen, Star, X, Minus, Plus } from 'lucide-react';

// ── 타입 ─────────────────────────────────────────────────────
interface MeditationEntry {
  id: string;
  duration: number;
  mood: 1 | 2 | 3 | 4 | 5;
  memo: string;
  date: string;
}

const STORAGE_KEY = 'meditation_journal';
function loadEntries(): MeditationEntry[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); }
  catch { return []; }
}
function saveEntry(e: MeditationEntry) {
  const prev = loadEntries();
  localStorage.setItem(STORAGE_KEY, JSON.stringify([e, ...prev].slice(0, 100)));
}

// ── 상수 ─────────────────────────────────────────────────────
type Phase = 'idle' | 'preparing' | 'running' | 'paused' | 'done';

function fmt(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

const BELL_TAIL_CUT = 7; // 파일 끝 무음 구간을 이만큼 앞당겨 타이머 시작 (초)

function playBell(): Promise<void> {
  return new Promise(resolve => {
    const audio = new Audio('/sounds/moktak.wav');

    // 메타데이터 로드 후 실제 길이 기준으로 앞당겨 resolve
    audio.addEventListener('loadedmetadata', () => {
      const ms = Math.max(300, (audio.duration - BELL_TAIL_CUT) * 1000);
      setTimeout(resolve, ms);
    }, { once: true });

    // 메타데이터 로드 실패 시 ended 폴백
    audio.addEventListener('ended', () => resolve(), { once: true });

    audio.play().catch(() => {
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 432; osc.type = 'sine';
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3);
        osc.start(); osc.stop(ctx.currentTime + 3);
        setTimeout(resolve, (3 - BELL_TAIL_CUT) * 1000);
      } catch { resolve(); }
    });
  });
}

// ── 컴포넌트 ─────────────────────────────────────────────────
export default function MeditationPage() {
  const [selectedMin, setSelectedMin] = useState(10);
  const [remaining,   setRemaining]   = useState(10 * 60);
  const [phase,       setPhase]       = useState<Phase>('idle');
  const [editing,     setEditing]     = useState(false);
  const [inputVal,    setInputVal]    = useState('10');
  const [showHistory, setShowHistory] = useState(false);
  const [mood,  setMood]  = useState<1|2|3|4|5>(3);
  const [memo,  setMemo]  = useState('');
  const [entries, setEntries] = useState<MeditationEntry[]>([]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalRef    = useRef(selectedMin * 60);

  useEffect(() => { setEntries(loadEntries()); }, []);

  function applyMin(min: number) {
    const clamped = Math.min(Math.max(min, 1), 180);
    setSelectedMin(clamped);
    setRemaining(clamped * 60);
    setInputVal(String(clamped));
  }

  function adjust(delta: number) { applyMin(selectedMin + delta); }

  function commitInput() {
    const v = parseInt(inputVal);
    applyMin(isNaN(v) ? selectedMin : v);
    setEditing(false);
  }

  // 시작: 종소리 재생 완료 후 타이머 시작
  async function start() {
    totalRef.current = selectedMin * 60;
    setRemaining(totalRef.current);
    setPhase('preparing');
    await playBell();
    setPhase('running');
  }

  // 일시정지 / 재개
  function togglePause() {
    setPhase(p => p === 'running' ? 'paused' : 'running');
  }

  // 종료
  function stop() {
    clearInterval(intervalRef.current!);
    setPhase('done');
  }

  // 타이머 틱
  useEffect(() => {
    if (phase === 'running') {
      intervalRef.current = setInterval(() => {
        setRemaining(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            playBell();
            setPhase('done');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current!);
    }
    return () => clearInterval(intervalRef.current!);
  }, [phase]);

  // 일지 저장
  function saveJournal() {
    saveEntry({ id: Date.now().toString(), duration: totalRef.current - remaining, mood, memo, date: new Date().toISOString() });
    setEntries(loadEntries());
    setMemo(''); setMood(3);
    setPhase('idle');
    setRemaining(selectedMin * 60);
  }

  function skipJournal() {
    setPhase('idle');
    setRemaining(selectedMin * 60);
  }

  // 원형 진행률
  const R    = 96;
  const circ = 2 * Math.PI * R;
  const prog = phase === 'idle' ? 0 : (totalRef.current - remaining) / totalRef.current;

  const isPreparing = phase === 'preparing';
  const isActive    = phase === 'running' || phase === 'paused';

  // ── Done 화면 ────────────────────────────────────────────
  if (phase === 'done') {
    return (
      <main className="w-full max-w-[460px] px-6 pt-8 pb-6 flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-1">
          <p className="text-4xl">🙏</p>
          <p className="text-lg font-semibold text-accent mt-2">
            {fmt(totalRef.current - remaining)} 명상을 마쳤습니다
          </p>
          <p className="text-sm text-accent/50">오늘도 수고하셨습니다</p>
        </div>

        <div className="w-full space-y-4">
          <div>
            <p className="text-sm font-medium text-accent mb-2">오늘의 기분</p>
            <div className="flex gap-2">
              {([1,2,3,4,5] as const).map(n => (
                <button key={n} onClick={() => setMood(n)}>
                  <Star size={30} className={mood >= n ? 'fill-amber-400 text-amber-400' : 'text-accent/20'} />
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="메모 (선택)"
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-accent-soft bg-surface-elevated text-accent text-sm outline-none resize-none"
          />
        </div>

        <div className="w-full flex gap-3">
          <button onClick={skipJournal} className="flex-1 py-3 rounded-2xl border border-accent-soft text-accent/60 text-sm">
            건너뛰기
          </button>
          <button onClick={saveJournal} className="flex-2 flex-[2] py-3 rounded-2xl bg-accent text-on-brand font-semibold">
            저장하기
          </button>
        </div>
      </main>
    );
  }

  // ── 메인 / 실행 화면 ─────────────────────────────────────
  return (
    <main className="w-full max-w-[460px] px-6 pt-4 pb-6 flex flex-col items-center">
      {/* 기록 버튼 */}
      <div className="w-full flex justify-end mb-6">
        <button onClick={() => setShowHistory(true)} className="flex items-center gap-1 text-xs text-accent/50 py-1">
          <BookOpen size={14} />
          기록
        </button>
      </div>

      {/* 원형 타이머 */}
      <div className="relative w-[220px] h-[220px] mb-8">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 220 220">
          <circle cx="110" cy="110" r={R} fill="none" strokeWidth="6"
            className="text-accent-soft/20" stroke="currentColor" />
          <circle cx="110" cy="110" r={R} fill="none" strokeWidth="6"
            className="text-accent transition-all duration-1000"
            stroke="currentColor"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - prog)}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <span className="text-5xl font-light font-mono text-accent tracking-tight">
            {fmt(remaining)}
          </span>
          {phase === 'paused' && (
            <span className="text-xs text-accent/50">일시정지</span>
          )}
        </div>
      </div>

      {/* 시간 설정 (idle 때만) */}
      {!isActive && !isPreparing && (
        <>
        {/* 프리셋 */}
        <div className="flex gap-2 mb-4">
          {[5, 10, 20, 30, 50, 60].map(m => (
            <button
              key={m}
              onClick={() => applyMin(m)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                selectedMin === m
                  ? 'bg-accent text-on-brand'
                  : 'bg-surface-elevated border border-accent-soft text-accent/70'
              }`}
            >
              {m}분
            </button>
          ))}
        </div>

        {/* 스테퍼 */}
        <div className="flex items-center gap-5 mb-10">
          <button
            onClick={() => adjust(-1)}
            onDoubleClick={() => adjust(-5)}
            className="w-11 h-11 rounded-full bg-surface-elevated border border-accent-soft flex items-center justify-center text-accent active:scale-95 transition-transform"
          >
            <Minus size={18} />
          </button>

          {editing ? (
            <input
              type="number"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onBlur={commitInput}
              onKeyDown={e => e.key === 'Enter' && commitInput()}
              autoFocus
              className="w-20 text-center text-2xl font-medium text-accent bg-transparent border-b-2 border-accent outline-none"
            />
          ) : (
            <button
              onClick={() => { setInputVal(String(selectedMin)); setEditing(true); }}
              className="w-20 text-center text-2xl font-medium text-accent"
            >
              {selectedMin}분
            </button>
          )}

          <button
            onClick={() => adjust(1)}
            onDoubleClick={() => adjust(5)}
            className="w-11 h-11 rounded-full bg-surface-elevated border border-accent-soft flex items-center justify-center text-accent active:scale-95 transition-transform"
          >
            <Plus size={18} />
          </button>
        </div>
        </>
      )}

      {/* 컨트롤 */}
      {isPreparing ? (
        <p className="text-sm text-accent/40 animate-pulse">잠시 후 시작됩니다…</p>
      ) : !isActive ? (
        <button
          onClick={start}
          className="w-40 h-14 rounded-full bg-accent text-on-brand text-lg font-semibold"
        >
          시작
        </button>
      ) : (
        <div className="flex gap-4 mt-2">
          <button
            onClick={togglePause}
            className="w-28 h-12 rounded-full border border-accent-soft text-accent text-sm font-medium"
          >
            {phase === 'running' ? '일시정지' : '재개'}
          </button>
          <button
            onClick={stop}
            className="w-28 h-12 rounded-full bg-accent/10 text-accent text-sm font-medium"
          >
            종료
          </button>
        </div>
      )}

      {/* 기록 모달 */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="w-full max-w-[460px] bg-surface rounded-t-3xl p-6 pb-10 max-h-[75vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-accent">명상 기록</h2>
              <button onClick={() => setShowHistory(false)}><X size={20} className="text-accent" /></button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-3">
              {entries.length === 0 ? (
                <p className="text-center text-accent/40 py-12 text-sm">아직 기록이 없습니다</p>
              ) : entries.map(e => (
                <div key={e.id} className="bg-surface-elevated rounded-xl p-4 border border-accent-soft">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-accent">{fmt(e.duration)}</span>
                    <span className="text-xs text-accent/40">
                      {new Date(e.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex gap-0.5">
                    {([1,2,3,4,5] as const).map(n => (
                      <Star key={n} size={12} className={e.mood >= n ? 'fill-amber-400 text-amber-400' : 'text-accent/15'} />
                    ))}
                  </div>
                  {e.memo && <p className="text-xs text-accent/60 mt-1 line-clamp-2">{e.memo}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
