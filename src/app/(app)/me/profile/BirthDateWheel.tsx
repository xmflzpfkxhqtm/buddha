// 생년월일 picker — 평소엔 한 행으로 표시, 클릭 시 iOS 스타일 휠이 아래로 펼쳐짐.
// 휠 자체는 CSS scroll-snap 기반 (모바일/Capacitor WKWebView 의 native scroll inertia 활용).

'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

const ITEM_HEIGHT = 36;
const VISIBLE_ITEMS = 5;
const CONTAINER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const SPACER_HEIGHT = (CONTAINER_HEIGHT - ITEM_HEIGHT) / 2;
const SCROLL_DEBOUNCE_MS = 150;
const SNAP_TOLERANCE_PX = 1; // native snap 미완료 시 보정 임계값

function Wheel({
  values,
  selected,
  onChange,
  suffix,
  ariaLabel,
}: {
  values: number[];
  selected: number;
  onChange: (v: number) => void;
  suffix: string;
  ariaLabel: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const programmaticRef = useRef(false);

  // 외부 selected 변화 → scrollTop 동기화
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const idx = values.indexOf(selected);
    if (idx < 0) return;
    const target = idx * ITEM_HEIGHT;
    if (Math.abs(el.scrollTop - target) > 1) {
      programmaticRef.current = true;
      el.scrollTop = target;
      setTimeout(() => { programmaticRef.current = false; }, 50);
    }
  }, [values, selected]);

  const handleScroll = () => {
    if (programmaticRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const el = scrollRef.current;
      if (!el) return;
      const idx = Math.round(el.scrollTop / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(values.length - 1, idx));
      const v = values[clamped];
      const target = clamped * ITEM_HEIGHT;

      // 중앙 정렬 강제 보정 — native scroll-snap 미완료/오차 케이스 대비.
      // instant scrollTop 으로 즉시 스냅 (smooth 는 onScroll 재발화 + 사용자 후속 입력과 충돌).
      if (Math.abs(el.scrollTop - target) > SNAP_TOLERANCE_PX) {
        programmaticRef.current = true;
        el.scrollTop = target;
        setTimeout(() => { programmaticRef.current = false; }, 50);
      }

      if (v !== selected) onChange(v);
    }, SCROLL_DEBOUNCE_MS);
  };

  return (
    <div className="relative flex-1" style={{ height: CONTAINER_HEIGHT }}>
      <div
        aria-hidden
        className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-y border-accent-soft/40 pointer-events-none z-10"
        style={{ height: ITEM_HEIGHT }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 pointer-events-none z-20 bg-gradient-to-b from-surface-elevated to-transparent"
        style={{ height: SPACER_HEIGHT }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 pointer-events-none z-20 bg-gradient-to-t from-surface-elevated to-transparent"
        style={{ height: SPACER_HEIGHT }}
      />
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        role="listbox"
        aria-label={ariaLabel}
        className="h-full overflow-y-scroll snap-y snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden touch-pan-y"
      >
        <div style={{ height: SPACER_HEIGHT }} aria-hidden />
        {values.map((v) => {
          const isSelected = v === selected;
          return (
            <div
              key={v}
              style={{ height: ITEM_HEIGHT }}
              className={`snap-center flex items-center justify-center text-base tabular-nums transition-colors ${
                isSelected ? 'text-ink font-semibold' : 'text-ink-subtle'
              }`}
              role="option"
              aria-selected={isSelected}
            >
              {v}
              {suffix}
            </div>
          );
        })}
        <div style={{ height: SPACER_HEIGHT }} aria-hidden />
      </div>
    </div>
  );
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export default function BirthDateWheel({
  value,
  onChange,
  defaultYear = 1990,
}: {
  value: string;
  onChange: (v: string) => void;
  defaultYear?: number;
}) {
  const [open, setOpen] = useState(false);
  const currentYear = new Date().getFullYear();
  const years = useMemo(
    () => Array.from({ length: currentYear - 1920 + 1 }, (_, i) => 1920 + i),
    [currentYear],
  );
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);

  // value 파싱. 비어있으면 휠 표시용 default — emit 은 사용자가 휠 회전 시점에만.
  const parsed = useMemo(() => {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      return {
        year: parseInt(m[1], 10),
        month: parseInt(m[2], 10),
        day: parseInt(m[3], 10),
      };
    }
    return { year: defaultYear, month: 1, day: 1 };
  }, [value, defaultYear]);

  const days = useMemo(() => {
    const max = daysInMonth(parsed.year, parsed.month);
    return Array.from({ length: max }, (_, i) => i + 1);
  }, [parsed.year, parsed.month]);

  const update = (y: number, mo: number, d: number) => {
    const max = daysInMonth(y, mo);
    const safeD = Math.min(d, max);
    const iso = `${y}-${String(mo).padStart(2, '0')}-${String(safeD).padStart(2, '0')}`;
    onChange(iso);
  };

  const display = value
    ? `${parsed.year}년 ${parsed.month}월 ${parsed.day}일`
    : '';

  return (
    <div>
      {/* Trigger — 닫혔을 때 1행 input 룩 */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="birth-date-wheel"
        className={`w-full h-12 px-4 rounded-lg border bg-surface-elevated text-base flex items-center justify-between transition-colors ${
          open ? 'border-accent' : 'border-line hover:border-accent-soft'
        }`}
      >
        <span className={display ? 'text-ink' : 'text-ink-subtle'}>
          {display || '생년월일을 선택하세요'}
        </span>
        <ChevronDown
          size={20}
          className={`text-ink-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Collapsible 휠 영역 — grid-rows 0fr↔1fr 트릭으로 부드러운 펼침 */}
      <div
        id="birth-date-wheel"
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="mt-2 rounded-lg border border-line bg-surface-elevated px-2 py-1">
            <div className="flex gap-1">
              <Wheel
                values={years}
                selected={parsed.year}
                onChange={(v) => update(v, parsed.month, parsed.day)}
                suffix="년"
                ariaLabel="연도"
              />
              <Wheel
                values={months}
                selected={parsed.month}
                onChange={(v) => update(parsed.year, v, parsed.day)}
                suffix="월"
                ariaLabel="월"
              />
              <Wheel
                values={days}
                selected={parsed.day}
                onChange={(v) => update(parsed.year, parsed.month, v)}
                suffix="일"
                ariaLabel="일"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
