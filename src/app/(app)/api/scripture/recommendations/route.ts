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
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import {
  type GroupRow,
  type Candidate,
  type Reason,
  type RecommendedItem,
  type AffinityRow,
  shuffleInPlace,
  shuffleTies,
  computeAffinityFallback,
} from '@/lib/recommendations';

export const runtime = 'nodejs';

const COLD_START_THRESHOLD = 3;
const DEFAULT_LIMIT = 10;
const DEFAULT_EXPLORE = 2;
const MAX_PER_SCHOOL_SIGNATURE = 2;

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

