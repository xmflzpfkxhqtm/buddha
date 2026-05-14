// app/api/scripture/recommendations/route.ts
// Phase 1A — 개인화 추천 (v1.1 affinity 기반).
// 순수 additive — 기존 /api/scripture, /api/scripture/groups 영향 없음.
//
// 가중치/임계 (코드 상수, 변경 시 commit으로 추적):
//   ★ favorite           = 5.0
//   AI 부처님 묻기 (인용) = 3.0
//   highlight (메모 있음)  = 2.0
//   highlight (메모 없음)  = 1.0
//   최근 30일 보너스      = ×1.5
//   cold-start 임계 N    = 3 (fav + highlight_titles + ask_titles 합)
//   다양성 cap          = school_signature(sorted) 당 최대 2
//   탐험 슬롯           = 마지막 2개 (school overlap = 0 + featured)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const COLD_START_THRESHOLD = 3;
const DEFAULT_LIMIT = 10;
const DEFAULT_EXPLORE = 2;
const MAX_PER_SCHOOL_SIGNATURE = 2;

type GroupRow = {
  group_key: string;
  display_name: string | null;
  chinese_title: string | null;
  school_tags: string[] | null;
  topic_tags: string[] | null;
  is_featured: boolean | null;
  volume_total: number | null;
  k_code: string | null;
};

type Candidate = GroupRow & {
  raw_score: number;
  school_score: number;
  topic_score: number;
  user_school_overlap: number;
};

type Reason =
  | { kind: 'similar'; anchor_group: string }   // personalized — 가장 가까운 사용자 affinity group
  | { kind: 'topic'; anchor_tag: string }       // personalized — fallback (anchor group 식별 어려울 때)
  | { kind: 'explore'; anchor_tag: string };    // explore — affinity 없는 school

type RecommendedItem = GroupRow & { raw_score: number; reason: Reason };

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 같은 score 묶음만 셔플 (점수 desc 정렬 유지)
function shuffleTies<T extends { raw_score: number }>(rows: T[]): T[] {
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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');
    const limit = Math.max(1, Math.min(20, Number(searchParams.get('limit')) || DEFAULT_LIMIT));
    const exploreSlots = Math.max(0, Math.min(limit, Number(searchParams.get('explore')) || DEFAULT_EXPLORE));

    if (!userId) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    }

    // --------------------------------------------------------------------------
    // 신호 통계 (cold-start 판정)
    // --------------------------------------------------------------------------
    const { data: statsRow, error: statsErr } = await supabase.rpc('scripture_rec_signal_stats', {
      uid: userId,
    });
    // RPC 없으면 직접 count (RPC 없는 환경에서도 동작)
    let favCount = 0;
    let highlightTitles = 0;
    let askTitles = 0;
    if (!statsErr && Array.isArray(statsRow) && statsRow[0]) {
      favCount = Number(statsRow[0].fav_count ?? 0);
      highlightTitles = Number(statsRow[0].highlight_titles ?? 0);
      askTitles = Number(statsRow[0].ask_titles ?? 0);
    } else {
      const [favs, hls, asks] = await Promise.all([
        supabase.from('scripture_favorites').select('group_key', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('highlights').select('title', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('temp_answers').select('scripture_title', { count: 'exact', head: true })
          .eq('user_id', userId).not('scripture_title', 'is', null),
      ]);
      favCount = favs.count ?? 0;
      highlightTitles = hls.count ?? 0;
      askTitles = asks.count ?? 0;
    }

    const signalCount = favCount + highlightTitles + askTitles;
    const isColdStart = signalCount < COLD_START_THRESHOLD;

    if (isColdStart) {
      return NextResponse.json(
        {
          stats: { signal_count: signalCount, threshold: COLD_START_THRESHOLD, is_cold_start: true },
          personalized: [],
          explore: [],
        },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    // --------------------------------------------------------------------------
    // 1. 사용자 group affinity (favorites + highlights + asks 가중합)
    //    SQL 한 번에 처리하기 위해 RPC가 있으면 사용, 없으면 다단계 JS 계산
    // --------------------------------------------------------------------------
    type AffinityRow = {
      group_key: string;
      score: number;
      school_tags: string[] | null;
      topic_tags: string[] | null;
      display_name: string | null;
    };

    let affinity: AffinityRow[] = [];
    const { data: affRpc, error: affErr } = await supabase.rpc('scripture_rec_group_affinity', {
      uid: userId,
    });
    if (!affErr && Array.isArray(affRpc)) {
      affinity = (affRpc as AffinityRow[]).map((r) => ({
        ...r,
        score: Number(r.score),
      }));
    } else {
      // Fallback: 신호 별 group_key 합산 (다단계 client-side join)
      affinity = await computeAffinityFallback(userId);
    }

    if (affinity.length === 0) {
      return NextResponse.json(
        {
          stats: { signal_count: signalCount, threshold: COLD_START_THRESHOLD, is_cold_start: false },
          personalized: [],
          explore: [],
        },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    // --------------------------------------------------------------------------
    // 2. tag affinity (school / topic 가중합)
    // --------------------------------------------------------------------------
    const schoolAff = new Map<string, number>();
    const topicAff = new Map<string, number>();
    const userSchools = new Set<string>();

    for (const ga of affinity) {
      (ga.school_tags ?? []).forEach((t) => {
        schoolAff.set(t, (schoolAff.get(t) ?? 0) + ga.score);
        userSchools.add(t);
      });
      (ga.topic_tags ?? []).forEach((t) => {
        topicAff.set(t, (topicAff.get(t) ?? 0) + ga.score);
      });
    }

    // --------------------------------------------------------------------------
    // 3. 후보 group 점수 계산
    // --------------------------------------------------------------------------
    const excluded = new Set(affinity.map((a) => a.group_key));
    // ★한 group도 excluded (group_affinity 에 이미 포함되지만 safety)
    {
      const { data: favs } = await supabase
        .from('scripture_favorites')
        .select('group_key')
        .eq('user_id', userId);
      (favs ?? []).forEach((r) => excluded.add(r.group_key));
    }

    // 전체 group 로드 (페이지네이션)
    const allGroups: GroupRow[] = [];
    const PAGE_SIZE = 1000;
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('scripture_groups')
        .select(
          'group_key, display_name, chinese_title, school_tags, topic_tags, is_featured, volume_total, k_code',
        )
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        console.error('scripture_groups 조회 실패:', error);
        return NextResponse.json({ error: '불러오기 실패' }, { status: 500 });
      }
      if (!data || data.length === 0) break;
      allGroups.push(...(data as GroupRow[]));
      if (data.length < PAGE_SIZE) break;
    }

    const candidates: Candidate[] = [];
    for (const g of allGroups) {
      if (excluded.has(g.group_key)) continue;
      let schoolScore = 0;
      let overlap = 0;
      (g.school_tags ?? []).forEach((t) => {
        const w = schoolAff.get(t);
        if (w) {
          schoolScore += w;
          overlap += 1;
        }
      });
      let topicScore = 0;
      (g.topic_tags ?? []).forEach((t) => {
        topicScore += topicAff.get(t) ?? 0;
      });
      const raw = schoolScore + topicScore;
      if (raw === 0 && !g.is_featured) continue;  // 0점이고 featured 아니면 후보 제외 (탐험 풀도 못 됨)
      candidates.push({
        ...g,
        raw_score: raw,
        school_score: schoolScore,
        topic_score: topicScore,
        user_school_overlap: overlap,
      });
    }

    // --------------------------------------------------------------------------
    // 4. Personalized 풀: raw_score > 0, school signature 다양성 cap
    // --------------------------------------------------------------------------
    const personalizedPool = candidates.filter((c) => c.raw_score > 0);
    shuffleTies(personalizedPool);

    const personalizedTarget = Math.max(0, limit - exploreSlots);
    const sigCount = new Map<string, number>();
    const personalizedPicks: Candidate[] = [];
    for (const c of personalizedPool) {
      const sig = [...(c.school_tags ?? [])].sort().join('|');
      const cnt = sigCount.get(sig) ?? 0;
      if (cnt >= MAX_PER_SCHOOL_SIGNATURE) continue;
      sigCount.set(sig, cnt + 1);
      personalizedPicks.push(c);
      if (personalizedPicks.length >= personalizedTarget) break;
    }

    // --------------------------------------------------------------------------
    // 5. Explore 풀: school overlap 0 + featured
    // --------------------------------------------------------------------------
    const explorePool = candidates.filter((c) => c.user_school_overlap === 0 && c.is_featured);
    shuffleInPlace(explorePool);
    const explorePicks = explorePool.slice(0, exploreSlots);

    // --------------------------------------------------------------------------
    // 6. Reason 생성
    //    personalized — 후보의 tags와 가장 많이 겹치는 user affinity group 을 anchor 로.
    //    overlap_score(anchor, cand) = |school 교집합| × 2 + |topic 교집합|.
    //    동률 시 affinity score 큰 group.
    // --------------------------------------------------------------------------
    function reasonForPersonalized(cand: Candidate): Reason {
      const candSchools = new Set(cand.school_tags ?? []);
      const candTopics = new Set(cand.topic_tags ?? []);

      let bestAnchor: AffinityRow | null = null;
      let bestOverlap = -1;
      let bestAffScore = -1;
      for (const a of affinity) {
        let sOverlap = 0;
        (a.school_tags ?? []).forEach((t) => { if (candSchools.has(t)) sOverlap += 1; });
        let tOverlap = 0;
        (a.topic_tags ?? []).forEach((t) => { if (candTopics.has(t)) tOverlap += 1; });
        const overlap = sOverlap * 2 + tOverlap;
        if (overlap > bestOverlap || (overlap === bestOverlap && a.score > bestAffScore)) {
          bestOverlap = overlap;
          bestAffScore = a.score;
          bestAnchor = a;
        }
      }

      if (bestAnchor && bestOverlap > 0) {
        return { kind: 'similar', anchor_group: bestAnchor.display_name ?? bestAnchor.group_key };
      }
      // school/topic 둘 다 매칭 없음 — topic affinity fallback
      let bestTopic: string | null = null;
      let bestTopicScore = 0;
      (cand.topic_tags ?? []).forEach((t) => {
        const w = topicAff.get(t) ?? 0;
        if (w > bestTopicScore) {
          bestTopicScore = w;
          bestTopic = t;
        }
      });
      return { kind: 'topic', anchor_tag: bestTopic ?? '관심 분야' };
    }

    function reasonForExplore(cand: Candidate): Reason {
      const tag = (cand.school_tags ?? [])[0] ?? (cand.topic_tags ?? [])[0] ?? '새 분야';
      return { kind: 'explore', anchor_tag: tag };
    }

    // --------------------------------------------------------------------------
    // 7. 응답 조립
    // --------------------------------------------------------------------------
    const toItem = (c: Candidate, reason: Reason): RecommendedItem => ({
      group_key: c.group_key,
      display_name: c.display_name,
      chinese_title: c.chinese_title,
      school_tags: c.school_tags,
      topic_tags: c.topic_tags,
      is_featured: c.is_featured,
      volume_total: c.volume_total,
      k_code: c.k_code,
      raw_score: c.raw_score,
      reason,
    });

    return NextResponse.json(
      {
        stats: {
          signal_count: signalCount,
          threshold: COLD_START_THRESHOLD,
          is_cold_start: false,
        },
        personalized: personalizedPicks.map((c) => toItem(c, reasonForPersonalized(c))),
        explore: explorePicks.map((c) => toItem(c, reasonForExplore(c))),
      },
      {
        headers: {
          // random tie-break / explore 때문에 매 호출마다 fresh
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    console.error('recommendations 실패:', error);
    return NextResponse.json({ error: '불러오기 실패' }, { status: 500 });
  }
}

// ============================================================================
// Fallback: RPC 없을 때 JS 측 affinity 계산
// (현재 RPC scripture_rec_group_affinity 정의 없음 — 이 경로가 실제 동작)
// ============================================================================
async function computeAffinityFallback(userId: string) {
  type Sig = { group_key: string; weight: number };
  const sigs: Sig[] = [];
  const RECENT_DAYS = 30;
  const RECENT_MULT = 1.5;
  const recentCutoff = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000;
  const recentWeight = (createdAt: string | null) =>
    createdAt && Date.parse(createdAt) > recentCutoff ? RECENT_MULT : 1.0;

  // 1) favorites — group_key 직접
  {
    const { data } = await supabase
      .from('scripture_favorites')
      .select('group_key, created_at')
      .eq('user_id', userId);
    (data ?? []).forEach((r) => sigs.push({ group_key: r.group_key, weight: 5.0 * recentWeight(r.created_at) }));
  }

  // 2) highlights — title → scriptures.group_key 조회 후 합산
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

  // 3) temp_answers — scripture_title → scriptures.group_key
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

  // 4) group_key 합산 + scripture_groups 메타 join
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
