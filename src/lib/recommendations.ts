import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';

export type GroupRow = {
  group_key: string;
  display_name: string | null;
  chinese_title: string | null;
  school_tags: string[] | null;
  topic_tags: string[] | null;
  is_featured: boolean | null;
  volume_total: number | null;
  k_code: string | null;
};

export type Candidate = GroupRow & {
  raw_score: number;
  school_score: number;
  topic_score: number;
  user_school_overlap: number;
};

export type Reason =
  | { kind: 'similar'; anchor_group: string }
  | { kind: 'topic'; anchor_tag: string }
  | { kind: 'explore'; anchor_tag: string };

export type RecommendedItem = GroupRow & { raw_score: number; reason: Reason };

export type AffinityRow = {
  group_key: string;
  score: number;
  school_tags: string[] | null;
  topic_tags: string[] | null;
  display_name: string | null;
};

export function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function shuffleTies<T extends { raw_score: number }>(rows: T[]): T[] {
  rows.sort((a, b) => b.raw_score - a.raw_score);
  let i = 0;
  while (i < rows.length) {
    let j = i + 1;
    while (j < rows.length && rows[j].raw_score === rows[i].raw_score) j++;
    const slice = rows.slice(i, j);
    shuffleInPlace(slice);
    for (let k = 0; k < slice.length; k++) rows[i + k] = slice[k];
    i = j;
  }
  return rows;
}

export async function computeAffinityFallback(userId: string): Promise<AffinityRow[]> {
  type Sig = { group_key: string; weight: number };
  const sigs: Sig[] = [];
  const RECENT_DAYS = 30;
  const RECENT_MULT = 1.5;
  const recentCutoff = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000;
  const recentWeight = (createdAt: string | null) =>
    createdAt && Date.parse(createdAt) > recentCutoff ? RECENT_MULT : 1.0;

  {
    const { data } = await supabase
      .from('scripture_favorites')
      .select('group_key, created_at')
      .eq('user_id', userId);
    (data ?? []).forEach((r) => sigs.push({ group_key: r.group_key, weight: 5.0 * recentWeight(r.created_at) }));
  }

  {
    const { data } = await supabase
      .from('highlights')
      .select('title, memo, created_at')
      .eq('user_id', userId);
    if (data && data.length > 0) {
      const titles = [...new Set(data.map((r) => r.title))];
      const { data: scrip } = await supabase
        .from('scriptures')
        .select('title, group_key')
        .in('title', titles);
      const titleToGroup = new Map((scrip ?? []).map((s) => [s.title, s.group_key]));
      data.forEach((h) => {
        const gk = titleToGroup.get(h.title);
        if (!gk) return;
        const memoBoost = h.memo && h.memo.length > 0 ? 2.0 : 1.0;
        sigs.push({ group_key: gk, weight: memoBoost * recentWeight(h.created_at) });
      });
    }
  }

  {
    const { data } = await supabase
      .from('temp_answers')
      .select('scripture_title, created_at')
      .eq('user_id', userId)
      .not('scripture_title', 'is', null);
    if (data && data.length > 0) {
      const titles = [...new Set(data.map((r) => r.scripture_title).filter(Boolean) as string[])];
      const { data: scrip } = await supabase
        .from('scriptures')
        .select('title, group_key')
        .in('title', titles);
      const titleToGroup = new Map((scrip ?? []).map((s) => [s.title, s.group_key]));

      const groupCounts = new Map<string, { count: number; recentMult: number }>();
      data.forEach((a) => {
        const gk = titleToGroup.get(a.scripture_title!);
        if (!gk) return;
        const cur = groupCounts.get(gk) ?? { count: 0, recentMult: 0 };
        cur.count += 1;
        cur.recentMult += recentWeight(a.created_at);
        groupCounts.set(gk, cur);
      });
      groupCounts.forEach((v, gk) => {
        sigs.push({ group_key: gk, weight: 3.0 * v.count * (v.recentMult / v.count) });
      });
    }
  }

  const scoreByGroup = new Map<string, number>();
  sigs.forEach((s) => {
    scoreByGroup.set(s.group_key, (scoreByGroup.get(s.group_key) ?? 0) + s.weight);
  });
  if (scoreByGroup.size === 0) return [];

  const { data: meta } = await supabase
    .from('scripture_groups')
    .select('group_key, display_name, school_tags, topic_tags')
    .in('group_key', [...scoreByGroup.keys()]);
  return (meta ?? []).map((m) => ({
    group_key: m.group_key,
    display_name: m.display_name,
    school_tags: m.school_tags,
    topic_tags: m.topic_tags,
    score: scoreByGroup.get(m.group_key) ?? 0,
  }));
}
