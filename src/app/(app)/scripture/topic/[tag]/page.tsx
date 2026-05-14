// src/app/(app)/scripture/topic/[tag]/page.tsx
// Topic Layer — 특정 태그가 포함된 모든 그룹 리스트.
// 진입점: Layer 1 의 토픽 헤딩, Layer 2 의 태그 칩.
// 그룹 클릭 → Layer 2 (/scripture/[group]).

'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronDown } from 'lucide-react';
import { scriptureCache, type ScriptureTopicResponse } from '@/lib/scriptureCache';

const PAGE_SIZE = 50;

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

export default function ScriptureTopicPage() {
  const router = useRouter();
  const params = useParams<{ tag: string }>();
  const tagParam = params?.tag ?? '';
  const tag = useMemo(() => {
    try {
      return decodeURIComponent(tagParam).normalize('NFC');
    } catch {
      return tagParam;
    }
  }, [tagParam]);

  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    if (!tag) return;
    let cancelled = false;
    setErrored(false);

    const apply = (data: ScriptureTopicResponse) => {
      if (cancelled) return;
      setGroups(data.groups ?? []);
      setDisplayCount(PAGE_SIZE); // 태그 변경 시 처음부터
      setLoading(false);
    };

    const cached = scriptureCache.topicByTag.get(tag);
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
        const res = await fetch(`/api/scripture/topic/${encodeURIComponent(tag)}`);
        if (!res.ok) throw new Error('failed');
        const data: ScriptureTopicResponse = await res.json();
        scriptureCache.topicByTag.set(tag, data);
        apply(data);
      } catch (e) {
        console.warn('topic 로딩 실패', e);
        if (!cancelled) {
          setErrored(true);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tag]);

  const visibleGroups = groups.slice(0, displayCount);
  const hasMore = displayCount < groups.length;

  const goBack = () => {
    // 어디서 들어왔든 자연스럽게 직전 화면으로. history 없으면 Layer 1 fallback.
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/scripture/v2');
    }
  };

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
            onClick={goBack}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-accent hover:bg-accent/5 active:bg-accent/10 transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <span className="text-base font-semibold text-accent truncate">
            {tag}
          </span>
        </div>
      </div>

      {loading && (
        <div className="pt-10 text-center text-ink-muted">불러오는 중...</div>
      )}

      {!loading && errored && (
        <div className="pt-10 text-center">
          <p className="text-ink">목록을 불러오지 못했습니다.</p>
          <button
            type="button"
            onClick={() => router.push('/scripture/v2')}
            className="mt-4 px-4 py-2 bg-accent-soft text-on-brand rounded-lg text-sm font-semibold"
          >
            경전으로
          </button>
        </div>
      )}

      {!loading && !errored && (
        <section className="pt-3 pb-10">
          <p className="text-sm text-ink-muted mb-2">총 {groups.length}개 경전</p>
          <ul className="divide-y divide-line border-y border-line">
            {visibleGroups.map((g) => {
              const href = `/scripture/${encodeURIComponent(g.group_key)}`;
              const volTotal =
                typeof g.volume_total === 'number' && g.volume_total > 0 ? g.volume_total : 1;
              return (
                <li key={g.group_key}>
                  <Link
                    href={href}
                    className="flex items-center gap-3 py-3 hover:bg-accent/5 active:bg-accent/10 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-base text-accent font-semibold truncate">
                        {g.display_name ?? g.group_key}
                      </p>
                      {g.chinese_title && (
                        <p className="text-xs text-ink-muted truncate">{g.chinese_title}</p>
                      )}
                    </div>
                    <span className="text-ink-muted text-sm whitespace-nowrap">{volTotal}권</span>
                    <span className="text-ink-muted text-sm">›</span>
                  </Link>
                </li>
              );
            })}
            {groups.length === 0 && (
              <li className="py-6 text-center text-ink-muted text-sm">
                해당 태그에 속한 경전이 없습니다.
              </li>
            )}
          </ul>

          {hasMore && (
            <div className="pt-6 flex justify-center">
              <button
                type="button"
                onClick={() => setDisplayCount((c) => c + PAGE_SIZE)}
                aria-label="더보기"
                className="flex items-center gap-1 px-4 py-2 rounded-full text-sm font-semibold text-accent-soft hover:bg-accent/5 active:bg-accent/10 transition-colors"
              >
                더보기
                <ChevronDown size={18} />
              </button>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
