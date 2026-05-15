// 즐겨찾기한 경전(그룹) 세로 리스트.
// /me 메뉴에서 진입. 데이터는 useScriptureFavoritesStore (RLS 자동 user-scoping).
// 마크업은 Topic Layer (/scripture/topic/[tag]) 와 동일 패턴 — 일관성 우선.

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useScriptureFavoritesStore } from '@/stores/useScriptureFavoritesStore';

export default function ScriptureFavoritesPage() {
  const router = useRouter();
  const groups = useScriptureFavoritesStore((s) => s.groups);
  const loaded = useScriptureFavoritesStore((s) => s.loaded);
  const loading = useScriptureFavoritesStore((s) => s.loading);
  const load = useScriptureFavoritesStore((s) => s.load);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (!uid) {
        router.replace('/login');
        return;
      }
      load(uid);
    });
  }, [load, router]);

  return (
    <main className="px-4 pb-20 max-w-[460px] mx-auto bg-surface-elevated min-h-screen [overflow-wrap:anywhere]">
      {loading && !loaded && (
        <div className="pt-10 text-center text-ink-muted">불러오는 중...</div>
      )}

      {loaded && groups.length === 0 && (
        <div className="pt-10 text-center text-ink-muted">
          <p>아직 즐겨찾기한 경전이 없습니다.</p>
          <p className="mt-1 text-sm">경전 페이지에서 ★ 표시를 눌러 추가하세요.</p>
        </div>
      )}

      {loaded && groups.length > 0 && (
        <section className="pt-3 pb-10">
          <p className="text-sm text-ink-muted mb-2">총 {groups.length}개 경전</p>
          <ul className="divide-y divide-line border-y border-line">
            {groups.map((g) => {
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
          </ul>
        </section>
      )}
    </main>
  );
}
