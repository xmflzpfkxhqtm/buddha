// src/app/(app)/scripture/v2/page.tsx
// Layer 1 — Browse. 임시 경로 (/scripture/v2). 옛 /scripture 는 그대로 보존.
// 안정화 확인 후 옛 페이지와 교체 여부는 별도 PR에서 결정.

'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, ChevronDown, Sparkles, Compass, Tag } from 'lucide-react';
import ScriptureModal from '../../../../../components/ScriptureModal';
import { scriptureCache, hydrateRecommendationsFromLS, persistRecommendationsToLS } from '@/lib/scriptureCache';
import HeroCarousel from './HeroCarousel';
import { titleToReaderPath } from '@/lib/scripturePath';
import { supabase } from '@/lib/supabaseClient';

type GroupSummary = {
  group_key: string;
  display_name: string | null;
  chinese_title: string | null;
  translator: string | null;
  intro: string | null;
  school_tags: string[] | null;
  topic_tags: string[] | null;
  is_featured: boolean | null;
  volume_total: number | null;
  k_code: string | null;
};

type GroupsApiResponse = {
  featured: GroupSummary[];
  topics: { tag: string; groups: GroupSummary[] }[];
};

// 추천 타입은 scriptureCache 에서 공유 import (캐시 슬롯도 거기 정의)
import type { RecommendItem } from '@/lib/scriptureCache';

type RecommendApiResponse = {
  stats: { signal_count: number; threshold: number; is_cold_start: boolean };
  personalized: RecommendItem[];
  explore: RecommendItem[];
};

interface GlobalSearchResult {
  title: string;
  index: number;
  text: string;
}

const TOPIC_INITIAL = 3;
const TOPIC_PAGE = 3;
const GROUPS_PER_TOPIC_DISPLAY = 5;
const FEATURED_DISPLAY = 5;

// "이어 읽기" — Layer 3 가 진입 시 setLastGlobal 로 기록한 마지막 위치 (그대로 표시)
const LAST_GLOBAL_KEY = 'scripture-last-global';

function readLastGlobal(): { groupKey: string; volumeNo: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LAST_GLOBAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.groupKey !== 'string' || !Number.isFinite(parsed?.volumeNo)) return null;
    return { groupKey: parsed.groupKey, volumeNo: Number(parsed.volumeNo) };
  } catch {
    return null;
  }
}

// 옛 page.tsx 와 동일 그룹화 규칙 — 모달 호환용
function getScriptureGroupBase(title: string): string {
  const m = title.match(/_K\d{4}(?:_|$)/u);
  if (m && m.index !== undefined) return title.slice(0, m.index + 6);
  return title.split('_')[0];
}

function getChosung(char: string): string {
  const code = char.charCodeAt(0) - 44032;
  if (code < 0 || code > 11171) return char;
  const baseConsonants = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  const labels: Record<string, string> = {'ㄱ':'가','ㄴ':'나','ㄷ':'다','ㄹ':'라','ㅁ':'마','ㅂ':'바','ㅅ':'사','ㅇ':'아','ㅈ':'자','ㅊ':'차','ㅋ':'카','ㅌ':'타','ㅍ':'파','ㅎ':'하'};
  const cho = baseConsonants[Math.floor(code / 588)];
  return labels[cho] || char;
}

function formatDisplayTitle(rawTitle: string): string {
  if (!rawTitle) return '';
  return rawTitle.replace(/_GPT\d+(\.\d+)?번역/, '').replace(/_/g, ' ');
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// GroupCard 는 표시에 필요한 필드만 요구 — GroupSummary, FavoriteGroup 둘 다 만족
type DisplayableGroup = {
  group_key: string;
  display_name: string | null;
  chinese_title: string | null;
  volume_total: number | null;
};

function GroupCard({ group }: { group: DisplayableGroup }) {
  const href = `/scripture/${encodeURIComponent(group.group_key)}`;
  return (
    <Link
      href={href}
      className="block w-[140px] flex-shrink-0 rounded-xl bg-surface-elevated border border-line p-3 hover:bg-accent/5 active:bg-accent/10 transition-colors"
    >
      <p className="font-semibold text-sm text-accent leading-snug truncate">
        {group.display_name ?? group.group_key}
      </p>
      {group.chinese_title && (
        <p className="mt-1 text-xs text-ink-muted truncate">{group.chinese_title}</p>
      )}
      <p className="mt-2 text-[11px] text-ink-muted">
        {typeof group.volume_total === 'number' && group.volume_total > 0 ? group.volume_total : 1}권
      </p>
    </Link>
  );
}

// 추천 카드 — GroupCard 와 동일 폭, 하단에 [icon] + anchor 텍스트 (2줄).
// 라벨 단어를 아이콘으로 대체해 anchor 에 공간 양보. tooltip 으로 풀텍스트 유지.
function RecommendCard({ item }: { item: RecommendItem }) {
  const href = `/scripture/${encodeURIComponent(item.group_key)}`;
  const isExplore = item.reason.kind === 'explore';
  const anchorText =
    item.reason.kind === 'similar' ? item.reason.anchor_group : item.reason.anchor_tag;
  const tooltipText =
    item.reason.kind === 'similar'
      ? `비슷한 경전: ${anchorText}`
      : item.reason.kind === 'explore'
        ? `새 분야 탐험: ${anchorText}`
        : `관심 분야: ${anchorText}`;
  const Icon =
    item.reason.kind === 'similar' ? Sparkles : item.reason.kind === 'explore' ? Compass : Tag;
  const colorClass = isExplore ? 'text-accent-soft' : 'text-ink-muted';

  return (
    <Link
      href={href}
      className="block w-[140px] flex-shrink-0 rounded-xl bg-surface-elevated border border-line p-3 hover:bg-accent/5 active:bg-accent/10 transition-colors"
    >
      <p className="font-semibold text-sm text-accent leading-snug truncate">
        {item.display_name ?? item.group_key}
      </p>
      {item.chinese_title && (
        <p className="mt-1 text-xs text-ink-muted truncate">{item.chinese_title}</p>
      )}
      <p className="mt-2 text-[11px] text-ink-muted">
        {typeof item.volume_total === 'number' && item.volume_total > 0 ? item.volume_total : 1}권
      </p>
      {/* 1줄 고정 + 긴 anchor 는 ellipsis 로 truncate. min-w-0 로 flex 안에서 span 축소 허용. */}
      <p
        className={`mt-1.5 flex items-center gap-1 text-[10px] leading-tight ${colorClass}`}
        title={tooltipText}
      >
        <Icon size={11} className="shrink-0" aria-hidden />
        <span className="min-w-0 truncate">{anchorText}</span>
      </p>
    </Link>
  );
}

function RecommendHScrollRow({ items }: { items: RecommendItem[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaX;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);
  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    >
      {items.map((it) => (
        <RecommendCard key={it.group_key} item={it} />
      ))}
    </div>
  );
}

// 데이터 도착 전 placeholder. RecommendCard 와 동일 크기·구조 → 레이아웃 안정.
// animate-pulse 는 globals.css 의 Tailwind 기본값.
function RecommendCardSkeleton() {
  return (
    <div className="w-[140px] flex-shrink-0 rounded-xl bg-surface-elevated border border-line p-3">
      <div className="h-[14px] rounded bg-line-strong/60 animate-pulse" />
      <div className="mt-1 h-[12px] w-3/4 rounded bg-line-strong/40 animate-pulse" />
      <div className="mt-2 h-[11px] w-1/3 rounded bg-line-strong/40 animate-pulse" />
      <div className="mt-1.5 h-[10px] w-2/3 rounded bg-line-strong/40 animate-pulse" />
    </div>
  );
}

function RecommendSkeletonRow({ count = 6 }: { count?: number }) {
  return (
    <div className="flex gap-2 overflow-x-hidden pb-2 -mx-4 px-4">
      {Array.from({ length: count }).map((_, i) => (
        <RecommendCardSkeleton key={i} />
      ))}
    </div>
  );
}

function HScrollRow({ groups }: { groups: DisplayableGroup[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // PC 트랙패드 가로 wheel 의 native scroll-target-latch 우회.
  // 첫 행에서 스크롤이 시작되면 브라우저가 그 element 를 잠시 잡아서,
  // 마우스를 다른 행으로 옮겨도 이전 행이 계속 스크롤되는 문제 해결.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // 가로 wheel 일 때만 가로 스크롤로 명시 처리. 세로 wheel 은 페이지 스크롤에 양보.
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaX;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    >
      {groups.map((g) => (
        <div key={g.group_key}>
          <GroupCard group={g} />
        </div>
      ))}
    </div>
  );
}

export default function ScriptureBrowsePage() {
  const router = useRouter();
  const [featured, setFeatured] = useState<GroupSummary[]>([]);
  const [shuffledTopics, setShuffledTopics] = useState<{ tag: string; groups: GroupSummary[] }[]>([]);
  const [displayCount, setDisplayCount] = useState(TOPIC_INITIAL);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [lastReading, setLastReading] = useState<{
    groupKey: string;
    volumeNo: number;        // 표시용 권 번호 (마지막 본 권이 read 면 +1)
    displayName: string;
  } | null>(null);

  // 개인화 추천 (Phase 1B + 1C).
  // 초기값 결정 순서: in-memory cache → localStorage hydrate → null.
  // null = 아직 확인 안 됨 (skeleton), [] = 확인했으나 cold-start/실패 (미렌더), [...] = 렌더.
  const [recommendations, setRecommendations] = useState<RecommendItem[] | null>(() => {
    if (typeof window === 'undefined') return null;
    const hydrated = scriptureCache.recommendations ?? hydrateRecommendationsFromLS();
    return hydrated?.items ?? null;
  });

  // 모달
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [modalTab, setModalTab] = useState<'title' | 'content' | 'global'>('title');
  const [globalResults, setGlobalResults] = useState<GlobalSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [initialFilter, setInitialFilter] = useState('전체');
  const [expandedBase, setExpandedBase] = useState<string | null>(null);
  const [groupedTitles, setGroupedTitles] = useState<Record<string, string[]>>({});
  const emptyRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const usedInitials = useMemo(() => {
    const set = new Set<string>();
    Object.keys(groupedTitles).forEach((base) => {
      set.add(getChosung(base.charAt(0)));
    });
    return set;
  }, [groupedTitles]);

  // groups API — cache hit 시 즉시 적용, miss 시 fetch + 캐시 저장
  useEffect(() => {
    let cancelled = false;

    const apply = (data: GroupsApiResponse) => {
      if (cancelled) return;
      // featured 도 매 로드마다 셔플 후 5개만 노출 (102개 다 노출 기회)
      setFeatured(shuffleInPlace([...(data.featured ?? [])]).slice(0, FEATURED_DISPLAY));
      // 매 로드마다 12개를 한 번 셔플하고, 더보기로 점진 노출.
      const nonEmpty = (data.topics ?? []).filter((t) => (t.groups ?? []).length > 0);
      setShuffledTopics(shuffleInPlace([...nonEmpty]));
      setDisplayCount(TOPIC_INITIAL);
      setLoading(false);

      // "이어 읽기" 카드 — 가장 최근 본 (groupKey, volumeNo) 그대로 표시.
      // read 여부 / 다음 권 자동 진행 같은 추가 로직 없음 (사용자 직관 우선).
      const last = readLastGlobal();
      if (last) {
        const allGroups = [
          ...(data.featured ?? []),
          ...(data.topics ?? []).flatMap((t) => t.groups ?? []),
        ];
        const meta = allGroups.find((g) => g.group_key === last.groupKey);
        setLastReading({
          groupKey: last.groupKey,
          volumeNo: last.volumeNo,
          displayName: meta?.display_name ?? last.groupKey,
        });
      }
    };

    if (scriptureCache.groups) {
      apply(scriptureCache.groups);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const res = await fetch('/api/scripture/groups');
        if (!res.ok) throw new Error('failed');
        const data: GroupsApiResponse = await res.json();
        scriptureCache.groups = data;
        apply(data);
      } catch (e) {
        console.warn('groups 로딩 실패', e);
        if (!cancelled) {
          setErrored(true);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 개인화 추천 fetch.
  // Background refresh 패턴: cache (memory/LS) 가 있어도 항상 백그라운드 fetch 로 fresh 갱신.
  // 단, 같은 user_id 인 hydrated cache 가 있으면 사용자는 이미 보고 있으니 silent update.
  // 비로그인 / cold-start / 실패 시 빈 배열로 LS 저장 — 다음 진입 skeleton 안 깜빡.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data.user;
        if (!user || cancelled) return;

        // 다른 user 의 LS cache 가 hydrate 됐을 수 있음 — discard
        if (scriptureCache.recommendations && scriptureCache.recommendations.userId !== user.id) {
          scriptureCache.recommendations = null;
          setRecommendations(null);
        }

        const res = await fetch(
          `/api/scripture/recommendations?user_id=${encodeURIComponent(user.id)}&limit=10&explore=2`,
        );
        if (!res.ok) return;
        const json: RecommendApiResponse = await res.json();
        if (cancelled) return;
        const combined = json.stats?.is_cold_start
          ? []
          : [...(json.personalized ?? []), ...(json.explore ?? [])];
        persistRecommendationsToLS({ userId: user.id, items: combined });
        setRecommendations(combined);
      } catch {
        // 추천 실패는 silent — 핵심 동선 영향 없음. cache 가 있으면 stale 데이터 유지.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 모달용 title list (검색 컨텍스트)
  useEffect(() => {
    let cancelled = false;
    const applyTitles = (titles: string[]) => {
      if (cancelled) return;
      const map: Record<string, string[]> = {};
      titles.forEach((t) => {
        const base = getScriptureGroupBase(t);
        if (!map[base]) map[base] = [];
        map[base].push(t);
      });
      setGroupedTitles(map);
    };

    if (scriptureCache.titles) {
      applyTitles(scriptureCache.titles);
      return () => {
        cancelled = true;
      };
    }

    fetch('/api/scripture/list')
      .then((res) => res.json())
      .then((data) => {
        const titles: string[] = data.titles || [];
        scriptureCache.titles = titles;
        applyTitles(titles);
      })
      .catch((e) => console.warn('list 로딩 실패', e));

    return () => {
      cancelled = true;
    };
  }, []);

  const handleGlobalSearch = useCallback(async () => {
    if (!search.trim()) return;
    setIsSearching(true);
    setGlobalResults([]);
    try {
      const res = await fetch(`/api/global-search?query=${encodeURIComponent(search)}`);
      const data = await res.json();
      setGlobalResults(data.results || []);
    } catch {
      /* noop */
    } finally {
      setIsSearching(false);
    }
  }, [search]);

  const setSelectedForModal = useCallback(
    (title: string) => {
      router.push(titleToReaderPath(title));
    },
    [router],
  );

  const visibleTopics = useMemo(
    () =>
      shuffledTopics.slice(0, displayCount).map((t) => ({
        tag: t.tag,
        groups: t.groups.slice(0, GROUPS_PER_TOPIC_DISPLAY),
      })),
    [shuffledTopics, displayCount],
  );
  const hasMoreTopics = displayCount < shuffledTopics.length;

  return (
    <main className="pb-20 max-w-[460px] mx-auto bg-surface-elevated min-h-screen">
      {/* 상단 */}
      <div
        className="sticky top-0 z-50 bg-surface-elevated px-4"
        style={{
          paddingTop: 'calc(max(44px, env(safe-area-inset-top)) + 8px)',
          paddingBottom: '8px',
        }}
      >
        <div className="flex items-center justify-between">
          {/* 섹션 루트라 뒤로가기 없음. 좌우 균형용 placeholder. */}
          <div className="w-10 h-10" aria-hidden />
          <span className="text-base font-semibold text-accent">불경</span>
          <button
            type="button"
            aria-label="검색"
            onClick={() => setShowModal(true)}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-accent hover:bg-accent/5 active:bg-accent/10 transition-colors"
          >
            <Search size={22} />
          </button>
        </div>
      </div>

      {loading && (
        <div className="pt-10 text-center text-ink-muted">불러오는 중...</div>
      )}

      {errored && !loading && (
        <div className="pt-10 px-4 text-center">
          <p className="text-ink">목록을 불러오지 못했습니다.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-accent-soft text-on-brand rounded-lg text-sm font-semibold"
          >
            다시 시도
          </button>
        </div>
      )}

      {!loading && !errored && (
        <>
          {/* Hero — 5대 경전 carousel (이미지 없는 컬러 카드 + Ken Burns + auto-rotate) */}
          <HeroCarousel />

          {/* 이어 읽기 — 가장 최근 본 Layer 3 (다 읽었으면 다음 권, 마지막 권까지 끝났으면 숨김) */}
          {lastReading && (
            <section className="pt-4 px-4">
              <Link
                href={`/scripture/${encodeURIComponent(lastReading.groupKey)}/${lastReading.volumeNo}`}
                className="flex items-center gap-2 py-3 px-4 rounded-xl bg-accent-soft/10 border border-accent-soft/30 hover:bg-accent-soft/15 active:bg-accent-soft/20 transition-colors"
              >
                {/* 경전명만 truncate, 권 번호는 항상 보장 */}
                <span className="flex-1 min-w-0 flex items-baseline gap-1.5">
                  <span className="truncate text-base text-ink">{lastReading.displayName}</span>
                  <span className="shrink-0 text-base text-ink">{lastReading.volumeNo}권</span>
                </span>
                <span className="text-sm text-ink-muted shrink-0">이어 읽기</span>
                <span className="text-ink-muted text-sm shrink-0">›</span>
              </Link>
            </section>
          )}

          {/* 개인화 추천 —
              null: skeleton (캐시 없는 첫 진입)
              [] : cold-start / 실패 → 섹션 자체 미렌더
              [...] : 정상 렌더 */}
          {recommendations === null ? (
            <section className="pt-5 px-4">
              <h2 className="text-base font-bold text-accent mb-2">당신을 위한 추천</h2>
              <RecommendSkeletonRow />
            </section>
          ) : recommendations.length > 0 ? (
            <section className="pt-5 px-4">
              <h2 className="text-base font-bold text-accent mb-2">당신을 위한 추천</h2>
              <RecommendHScrollRow items={recommendations} />
            </section>
          ) : null}

          {/* Featured */}
          {featured.length > 0 && (
            <section className="pt-5 px-4">
              <h2 className="text-base font-bold text-accent mb-2">주요 경전</h2>
              <HScrollRow groups={featured} />
            </section>
          )}

          {/* 셔플된 주제 — 더보기 클릭마다 +TOPIC_PAGE. 헤딩 터치 시 Topic Layer */}
          {visibleTopics.map(({ tag, groups }) => (
            <section key={tag} className="pt-5 px-4">
              <Link
                href={`/scripture/topic/${encodeURIComponent(tag)}`}
                className="inline-block mb-2 hover:opacity-80 active:opacity-60 transition-opacity"
              >
                <h2 className="text-base font-bold text-accent">{tag} ›</h2>
              </Link>
              <HScrollRow groups={groups} />
            </section>
          ))}

          {hasMoreTopics && (
            <section className="pt-6 px-4 pb-8 flex justify-center">
              <button
                type="button"
                onClick={() => setDisplayCount((c) => c + TOPIC_PAGE)}
                aria-label="더보기"
                className="flex items-center gap-1 px-4 py-2 rounded-full text-sm font-semibold text-accent-soft hover:bg-accent/5 active:bg-accent/10 transition-colors"
              >
                더보기
                <ChevronDown size={18} />
              </button>
            </section>
          )}
        </>
      )}

      {/* 검색 모달 — Layer 1 에는 본문 컨텍스트가 없으므로 displaySentences/sentenceRefs 는 빈 값 전달 */}
      {showModal && (
        <ScriptureModal
          selected=""
          setSelected={setSelectedForModal}
          onClose={() => setShowModal(false)}
          search={search}
          setSearch={setSearch}
          modalTab={modalTab}
          setModalTab={setModalTab}
          groupedTitles={groupedTitles}
          usedInitials={usedInitials}
          initialFilter={initialFilter}
          setInitialFilter={setInitialFilter}
          expandedBase={expandedBase}
          setExpandedBase={setExpandedBase}
          formatDisplayTitle={formatDisplayTitle}
          getChosung={getChosung}
          globalResults={globalResults}
          handleGlobalSearch={handleGlobalSearch}
          setCurrentIndex={() => { /* Layer 1 에는 본문 인덱스 개념 없음 */ }}
          smoothCenter={() => { /* noop */ }}
          isSearching={isSearching}
          sentenceRefs={emptyRefs}
          setBookmarkPending={() => { /* noop */ }}
          displaySentences={[]}
          setShowModal={setShowModal}
        />
      )}
    </main>
  );
}
