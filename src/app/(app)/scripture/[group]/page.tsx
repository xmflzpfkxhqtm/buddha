// src/app/(app)/scripture/[group]/page.tsx
// Layer 2 — 그룹 상세 + 권 리스트.
// 읽음 상태(✓ 읽음 / ◐ 읽는중 / 빈)는 localStorage 누적. Layer 3 가 진입·끝 도달 시 기록.

'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronDown, Star } from 'lucide-react';
import { scriptureCache, type ScriptureGroupDetailResponse } from '@/lib/scriptureCache';
import { useScriptureFavoritesStore } from '@/stores/useScriptureFavoritesStore';
import { supabase } from '@/lib/supabaseClient';

const VOLUME_THRESHOLD = 30;
const VOLUME_PAGE = 30;
const LAST_VOLUME_PREFIX = 'scripture-last:';

type GroupMeta = {
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

type VolumeRow = {
  title: string;
  volume_no: number | null;
  filename: string | null;
};

type ReadState = 'read' | 'reading' | null;

const READ_STATE_PREFIX = 'scripture-read:';

function getReadState(groupKey: string, volumeNo: number): ReadState {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(`${READ_STATE_PREFIX}${groupKey}:${volumeNo}`);
    return v === 'read' || v === 'reading' ? v : null;
  } catch {
    return null;
  }
}

function getLastVolume(groupKey: string): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(`${LAST_VOLUME_PREFIX}${groupKey}`);
    if (!v) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export default function ScriptureGroupPage() {
  const router = useRouter();
  const params = useParams<{ group: string }>();
  const groupKeyParam = params?.group ?? '';
  const groupKey = useMemo(() => {
    try {
      return decodeURIComponent(groupKeyParam).normalize('NFC');
    } catch {
      return groupKeyParam;
    }
  }, [groupKeyParam]);

  const [group, setGroup] = useState<GroupMeta | null>(null);
  const [volumes, setVolumes] = useState<VolumeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [readStates, setReadStates] = useState<Record<number, ReadState>>({});
  const [lastVolume, setLastVolumeState] = useState<number | null>(null);
  const [displayCount, setDisplayCount] = useState(VOLUME_THRESHOLD);
  const [userId, setUserId] = useState<string | null>(null);
  const [favToast, setFavToast] = useState<string | null>(null);

  const isFavorited = useScriptureFavoritesStore((s) => s.keys.has(groupKey));
  const loadFavorites = useScriptureFavoritesStore((s) => s.load);
  const addFavorite = useScriptureFavoritesStore((s) => s.add);
  const removeFavorite = useScriptureFavoritesStore((s) => s.remove);

  // 사용자 정보 + 즐겨찾기 캐시 로드
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) loadFavorites(uid);
    });
  }, [loadFavorites]);

  // 토스트 자동 닫힘
  useEffect(() => {
    if (!favToast) return;
    const t = setTimeout(() => setFavToast(null), 1800);
    return () => clearTimeout(t);
  }, [favToast]);

  const handleToggleFavorite = async () => {
    if (!userId) {
      setFavToast('로그인 후 이용할 수 있습니다.');
      return;
    }
    if (!group) return;
    if (isFavorited) {
      const r = await removeFavorite(userId, groupKey);
      if (r.ok) setFavToast('즐겨찾기에서 삭제했습니다.');
    } else {
      const r = await addFavorite(userId, {
        group_key: groupKey,
        display_name: group.display_name,
        chinese_title: group.chinese_title,
        volume_total: group.volume_total,
        k_code: group.k_code,
      });
      if (r.ok) setFavToast('즐겨찾기에 추가했습니다.');
    }
  };

  // 그룹 + 권 리스트 로드 — cache hit 시 즉시
  useEffect(() => {
    if (!groupKey) return;
    let cancelled = false;
    setNotFound(false);

    const apply = (data: ScriptureGroupDetailResponse) => {
      if (cancelled) return;
      setGroup(data.group ?? null);
      const vols = data.volumes ?? [];
      setVolumes(vols);
      const states: Record<number, ReadState> = {};
      vols.forEach((v) => {
        if (typeof v.volume_no === 'number') {
          states[v.volume_no] = getReadState(groupKey, v.volume_no);
        }
      });
      setReadStates(states);
      setLastVolumeState(getLastVolume(groupKey));
      setDisplayCount(VOLUME_THRESHOLD); // 그룹 변경 시 처음부터
      setLoading(false);
    };

    const cached = scriptureCache.groupByKey.get(groupKey);
    if (cached) {
      setLoading(false);
      apply(cached);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/scripture/group/${encodeURIComponent(groupKey)}`);
        if (!res.ok) {
          if (!cancelled) {
            setNotFound(true);
            setLoading(false);
          }
          return;
        }
        const data: ScriptureGroupDetailResponse = await res.json();
        scriptureCache.groupByKey.set(groupKey, data);
        apply(data);
      } catch (e) {
        console.warn('group 로딩 실패', e);
        if (!cancelled) {
          setNotFound(true);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupKey]);

  const totalVolumes = group?.volume_total ?? volumes.length;
  const tags = useMemo(() => {
    const all = [...(group?.school_tags ?? []), ...(group?.topic_tags ?? [])];
    return Array.from(new Set(all)).filter(Boolean);
  }, [group]);

  const visibleVolumes = useMemo(
    () => (volumes.length > VOLUME_THRESHOLD ? volumes.slice(0, displayCount) : volumes),
    [volumes, displayCount],
  );
  const hasMoreVolumes = volumes.length > VOLUME_THRESHOLD && displayCount < volumes.length;
  const showContinueReading = lastVolume !== null && volumes.length >= 2;
  const lastVolumeState: ReadState =
    lastVolume !== null ? readStates[lastVolume] ?? null : null;

  return (
    <main className="px-4 pb-20 max-w-[460px] mx-auto bg-surface-elevated min-h-screen [overflow-wrap:anywhere]">
      {/* 상단 nav */}
      <div
        className="sticky top-0 z-50 bg-surface-elevated"
        style={{
          paddingTop: 'calc(max(44px, env(safe-area-inset-top)) + 8px)',
          paddingBottom: '8px',
        }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="뒤로"
            onClick={() => router.push('/scripture/v2')}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-accent hover:bg-accent/5 active:bg-accent/10 transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <span className="text-base font-semibold text-accent truncate">
            {group?.display_name ?? groupKey}
          </span>
        </div>
      </div>

      {loading && (
        <div className="pt-10 text-center text-ink-muted">불러오는 중...</div>
      )}

      {!loading && notFound && (
        <div className="pt-10 text-center">
          <p className="text-ink">그룹을 찾을 수 없습니다.</p>
          <button
            type="button"
            onClick={() => router.push('/scripture/v2')}
            className="mt-4 px-4 py-2 bg-accent-soft text-on-brand rounded-lg text-sm font-semibold"
          >
            경전 목록으로
          </button>
        </div>
      )}

      {/* Toast */}
      {favToast && (
        <div
          role="status"
          className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[60] px-4 py-2 rounded-full bg-ink text-surface-elevated text-sm shadow-lg animate-fade-opacity"
        >
          {favToast}
        </div>
      )}

      {!loading && !notFound && group && (
        <>
          {/* 그룹 메타 */}
          <section className="pt-3 pb-6">
            <div className="flex items-start gap-3">
              <h1 className="text-2xl font-bold text-accent break-keep flex-1">
                {group.display_name}
              </h1>
              <button
                type="button"
                onClick={handleToggleFavorite}
                aria-label={isFavorited ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                aria-pressed={isFavorited}
                className="shrink-0 -mr-1 -mt-1 w-10 h-10 flex items-center justify-center rounded-lg text-accent hover:bg-accent/5 active:bg-accent/10 transition-colors"
              >
                <Star
                  size={24}
                  className="transition-colors"
                  fill={isFavorited ? 'currentColor' : 'none'}
                  strokeWidth={isFavorited ? 1.5 : 2}
                />
              </button>
            </div>
            {group.chinese_title && (
              <p className="mt-1 text-sm text-ink-muted">{group.chinese_title}</p>
            )}
            {group.translator && (
              <p className="mt-1 text-sm text-ink-muted">{group.translator}</p>
            )}
            {tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/scripture/topic/${encodeURIComponent(tag)}`}
                    className="px-3 py-1.5 rounded-full bg-accent-soft/20 text-accent-soft text-sm font-semibold border border-accent-soft/40 hover:bg-accent-soft/30 active:bg-accent-soft/40 transition-colors"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            )}
            {group.intro && (
              <p className="mt-4 text-base leading-relaxed text-ink whitespace-pre-wrap break-keep font-maruburi">
                {group.intro}
              </p>
            )}
          </section>

          {/* 이어 읽기 — 마지막 진입 권 1개. 권수 ≥ 2 일 때만 */}
          {showContinueReading && (
            <section className="pb-5">
              <h2 className="text-sm font-semibold text-ink-muted mb-2">이어 읽기</h2>
              <Link
                href={`/scripture/${encodeURIComponent(groupKey)}/${lastVolume}`}
                className="flex items-center gap-3 py-3 px-3 rounded-xl bg-accent-soft/10 border border-accent-soft/30 hover:bg-accent-soft/15 active:bg-accent-soft/20 transition-colors"
              >
                <span className="w-6 flex items-center justify-center text-base">
                  {lastVolumeState === 'read' ? (
                    <span aria-label="읽음" className="text-accent">●</span>
                  ) : (
                    <span aria-label="읽는중" className="text-accent-soft">◐</span>
                  )}
                </span>
                <span className="flex-1 text-base text-ink">{lastVolume}권</span>
                <span className="text-ink-muted text-sm">›</span>
              </Link>
            </section>
          )}

          {/* 권 리스트 */}
          <section className="pb-10">
            <h2 className="text-sm font-semibold text-ink-muted mb-2">
              {`권 목록 (${totalVolumes}권)`}
            </h2>
            <ul className="divide-y divide-line border-y border-line">
              {visibleVolumes.map((v) => {
                const volNo = typeof v.volume_no === 'number' ? v.volume_no : 1;
                const state = readStates[volNo];
                const href = `/scripture/${encodeURIComponent(groupKey)}/${volNo}`;
                return (
                  <li key={`${v.title}-${volNo}`}>
                    <Link
                      href={href}
                      className="flex items-center gap-3 py-3 hover:bg-accent/5 active:bg-accent/10 transition-colors"
                    >
                      <span className="w-6 flex items-center justify-center text-base">
                        {state === 'read' ? (
                          <span aria-label="읽음" className="text-accent">●</span>
                        ) : state === 'reading' ? (
                          <span aria-label="읽는중" className="text-accent-soft">◐</span>
                        ) : (
                          <span aria-hidden className="text-transparent">·</span>
                        )}
                      </span>
                      <span className="flex-1 text-base text-ink">
                        {`${volNo}권`}
                      </span>
                      <span className="text-ink-muted text-sm">›</span>
                    </Link>
                  </li>
                );
              })}
              {volumes.length === 0 && (
                <li className="py-6 text-center text-ink-muted text-sm">
                  표시할 권이 없습니다.
                </li>
              )}
            </ul>

            {hasMoreVolumes && (
              <div className="pt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => setDisplayCount((c) => c + VOLUME_PAGE)}
                  aria-label="더보기"
                  className="flex items-center gap-1 px-4 py-2 rounded-full text-sm font-semibold text-accent-soft hover:bg-accent/5 active:bg-accent/10 transition-colors"
                >
                  더보기
                  <ChevronDown size={18} />
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
