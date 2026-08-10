// app/api/highlights/resolve-batch/route.ts
// Phase 5B — 사용자 highlight 의 *현재 본문 기준 좌표* 를 cascade 로 재계산해 반환.
// Forward-only 원칙: 옛 본문 보존 안 함. 위치 못 찾으면 orphaned 로 표시, memo/highlight_text 보존.
//
// Cascade (성공 시 stop):
//   0. resolved_version == content_version → 캐시 hit (DB 그대로)
//   1. 캐시된 좌표 위치 텍스트가 highlight_text 와 정확 일치 → ok
//   2. highlight_text 가 현재 본문 어디든 정확 일치 → rematched
//   3. Normalize (공백·구두점) 후 fuzzy → rematched
//   4. anchor_start_text 50자 prefix 매칭 → rematched
//   (5. embedding cosine — Phase 5F, 추후)
//   실패 → orphaned
//
// 매칭 결과는 highlights 기존 좌표 컬럼 (start_sentence, start_char_offset, end_sentence,
// end_char_offset) 을 갱신 + anchor_status / resolved_version 업데이트.
//
// Input:  GET ?user_id=<uuid>&title=<title>  또는  POST { user_id, titles[] }
// Output: { highlights: [{ id, start_sentence, ..., anchor_status, resolved_version }] }

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { parseMarkdownToBlocks } from '@/lib/scriptureContent';
import { type HighlightDbRow } from '@/types/highlights';

export const runtime = 'nodejs';

type HighlightRow = HighlightDbRow;
type ResolvedHighlight = HighlightRow;

type ResolveStats = {
  total: number;
  ok: number;
  rematched: number;
  orphaned: number;
  cache_hits: number;
};

// 정규화: 공백 압축, 구두점 normalize. 본문 검색 fuzzy 용.
function normalizeForMatch(s: string): string {
  return s
    .replace(/[\s ]+/g, ' ')
    .replace(/[“”„‟]/g, '"')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[，、]/g, ',')
    .replace(/[。．]/g, '.')
    .replace(/[…]/g, '...')
    .trim();
}

// 한 sentence 안에서 substring 의 char offset 찾기.
// 못 찾으면 [-1, -1]. 길이 ≥ 2 만 시도 (단일 글자 highlight 는 의미 없음).
function findOffsetIn(sentence: string, text: string): [number, number] {
  if (!text || text.length < 1) return [-1, -1];
  const idx = sentence.indexOf(text);
  if (idx >= 0) return [idx, idx + text.length];
  // normalized 시도
  const normSent = normalizeForMatch(sentence);
  const normText = normalizeForMatch(text);
  if (!normText) return [-1, -1];
  const normIdx = normSent.indexOf(normText);
  if (normIdx >= 0) {
    // 정확한 raw offset 복원은 어려우므로 sentence 전체 길이로 fallback (좌표 정확도 < but 위치는 맞음)
    // 추후 character-by-character alignment 가능 — 일단 sentence 단위 hit 로 처리
    return [normIdx, normIdx + normText.length];
  }
  return [-1, -1];
}

// 전체 본문에서 highlight_text 위치 찾기 — sentence 단위로 검색.
// 한 sentence 안에 완전히 들어가는 경우만 처리. multi-sentence span 은 단순화 위해 향후 처리.
function findInFlatSentences(
  flatSentences: string[],
  highlightText: string,
): { sentenceIdx: number; startOffset: number; endOffset: number } | null {
  if (!highlightText) return null;

  // 1. exact 위치
  for (let i = 0; i < flatSentences.length; i++) {
    const idx = flatSentences[i].indexOf(highlightText);
    if (idx >= 0) {
      return { sentenceIdx: i, startOffset: idx, endOffset: idx + highlightText.length };
    }
  }
  // 2. normalized 위치
  const normTarget = normalizeForMatch(highlightText);
  if (!normTarget || normTarget.length < 2) return null;
  for (let i = 0; i < flatSentences.length; i++) {
    const normSent = normalizeForMatch(flatSentences[i]);
    const idx = normSent.indexOf(normTarget);
    if (idx >= 0) {
      // normalized 매칭 → raw offset 복원 어려우므로 best-effort 로 sentence 시작 위치 사용.
      // (sentence-level 매칭 의미 — UI 가 sentence highlight 로 약간 wider 보일 수 있음, 의미 보존)
      return { sentenceIdx: i, startOffset: 0, endOffset: flatSentences[i].length };
    }
  }
  return null;
}

// anchor_start_text (50자 prefix) 로 sentence 매칭. 본문 미세 윤문에 robust.
function findByAnchorPrefix(
  flatSentences: string[],
  anchorPrefix: string,
): number {
  if (!anchorPrefix || anchorPrefix.length < 10) return -1;
  const prefix = anchorPrefix.slice(0, 50);
  for (let i = 0; i < flatSentences.length; i++) {
    if (flatSentences[i].startsWith(prefix)) return i;
  }
  // normalized
  const normPrefix = normalizeForMatch(prefix);
  if (normPrefix.length < 10) return -1;
  for (let i = 0; i < flatSentences.length; i++) {
    if (normalizeForMatch(flatSentences[i]).startsWith(normPrefix)) return i;
  }
  return -1;
}

// 한 highlight 재앵커링. mutation 없음 (caller 가 DB 반영).
function resolveOne(
  h: HighlightRow,
  flatSentences: string[],
  contentVersion: number,
): { row: HighlightRow; changed: boolean; cacheHit: boolean } {
  // 0. 캐시 hit
  if (h.resolved_version === contentVersion && h.anchor_status !== 'pending') {
    return { row: h, changed: false, cacheHit: true };
  }

  const text = h.highlight_text ?? '';

  // 1. 캐시된 좌표 위치 텍스트가 highlight_text 와 정확 일치 (윤문 없음)
  if (
    text &&
    h.start_sentence >= 0 &&
    h.start_sentence < flatSentences.length &&
    h.start_char_offset != null &&
    h.end_char_offset != null
  ) {
    const sent = flatSentences[h.start_sentence];
    const sliced = sent.slice(h.start_char_offset, h.end_char_offset);
    if (sliced === text) {
      return {
        row: { ...h, anchor_status: 'ok', resolved_version: contentVersion },
        changed: true,
        cacheHit: false,
      };
    }
  }

  // 2. highlight_text 전체 본문 검색
  if (text) {
    const found = findInFlatSentences(flatSentences, text);
    if (found) {
      return {
        row: {
          ...h,
          start_sentence: found.sentenceIdx,
          end_sentence: found.sentenceIdx,
          start_char_offset: found.startOffset,
          end_char_offset: found.endOffset,
          anchor_status: 'rematched',
          resolved_version: contentVersion,
        },
        changed: true,
        cacheHit: false,
      };
    }
  }

  // 3. (normalized 검색은 findInFlatSentences 안에서 처리)

  // 4. anchor_start_text 50자 prefix 매칭
  const anchorPrefix = h.anchor_start_text ?? '';
  const prefixSentIdx = findByAnchorPrefix(flatSentences, anchorPrefix);
  if (prefixSentIdx >= 0) {
    // sentence 는 찾았으나 정확 offset 모름 — sentence 시작/끝 으로 fallback
    const sentLen = flatSentences[prefixSentIdx].length;
    // text 가 있으면 sentence 안에서 한 번 더 시도
    if (text) {
      const [s, e] = findOffsetIn(flatSentences[prefixSentIdx], text);
      if (s >= 0) {
        return {
          row: {
            ...h,
            start_sentence: prefixSentIdx,
            end_sentence: prefixSentIdx,
            start_char_offset: s,
            end_char_offset: e,
            anchor_status: 'rematched',
            resolved_version: contentVersion,
          },
          changed: true,
          cacheHit: false,
        };
      }
    }
    return {
      row: {
        ...h,
        start_sentence: prefixSentIdx,
        end_sentence: prefixSentIdx,
        start_char_offset: 0,
        end_char_offset: sentLen,
        anchor_status: 'rematched',
        resolved_version: contentVersion,
      },
      changed: true,
      cacheHit: false,
    };
  }

  // Orphaned — memo/highlight_text 는 유지, 좌표만 invalid
  return {
    row: {
      ...h,
      anchor_status: 'orphaned',
      resolved_version: contentVersion,
    },
    changed: true,
    cacheHit: false,
  };
}

async function resolveForTitle(
  userId: string,
  title: string,
): Promise<{ highlights: ResolvedHighlight[]; stats: ResolveStats }> {
  // 1. 현재 본문 + 버전
  const { data: scrip, error: scripErr } = await supabase
    .from('scriptures')
    .select('content, content_version')
    .eq('title', title)
    .maybeSingle();

  if (scripErr || !scrip) {
    return {
      highlights: [],
      stats: { total: 0, ok: 0, rematched: 0, orphaned: 0, cache_hits: 0 },
    };
  }

  const contentVersion = scrip.content_version ?? 1;
  const { flatSentences } = parseMarkdownToBlocks(scrip.content ?? '');

  // 2. 사용자 highlights
  const { data: rows } = await supabase
    .from('highlights')
    .select(
      'id, user_id, title, start_sentence, end_sentence, start_char_offset, end_char_offset, anchor_start_text, anchor_end_text, highlight_text, memo, anchor_status, resolved_version, created_at',
    )
    .eq('user_id', userId)
    .eq('title', title)
    .order('created_at', { ascending: false });

  const highlights = (rows ?? []) as HighlightRow[];
  const stats: ResolveStats = {
    total: highlights.length,
    ok: 0,
    rematched: 0,
    orphaned: 0,
    cache_hits: 0,
  };

  if (highlights.length === 0) {
    return { highlights: [], stats };
  }

  // 3. cascade 실행 + DB persist (변경된 row 만)
  const resolved: ResolvedHighlight[] = [];
  const updates: { id: string; row: HighlightRow }[] = [];
  for (const h of highlights) {
    const { row, changed, cacheHit } = resolveOne(h, flatSentences, contentVersion);
    resolved.push(row);
    if (cacheHit) stats.cache_hits += 1;
    if (changed) updates.push({ id: h.id, row });
    if (row.anchor_status === 'ok') stats.ok += 1;
    else if (row.anchor_status === 'rematched') stats.rematched += 1;
    else if (row.anchor_status === 'orphaned') stats.orphaned += 1;
  }

  // 변경된 row 들 DB 반영 (병렬). 실패는 silent — 다음 호출에 다시 시도.
  if (updates.length > 0) {
    await Promise.all(
      updates.map(({ id, row }) =>
        supabase
          .from('highlights')
          .update({
            start_sentence: row.start_sentence,
            end_sentence: row.end_sentence,
            start_char_offset: row.start_char_offset,
            end_char_offset: row.end_char_offset,
            anchor_status: row.anchor_status,
            resolved_version: row.resolved_version,
          })
          .eq('id', id),
      ),
    );
  }

  return { highlights: resolved, stats };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');
    const title = searchParams.get('title');

    if (!userId || !title) {
      return NextResponse.json({ error: 'user_id and title required' }, { status: 400 });
    }

    const { highlights, stats } = await resolveForTitle(userId, title);
    return NextResponse.json(
      { highlights, stats },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('resolve-batch GET 실패:', error);
    return NextResponse.json({ error: 'resolve 실패' }, { status: 500 });
  }
}

// 다중 title 처리 — /me/highlights 같은 곳에서 사용
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { user_id?: string; titles?: string[] };
    const userId = body.user_id;
    const titles = body.titles ?? [];

    if (!userId || titles.length === 0) {
      return NextResponse.json({ error: 'user_id and titles[] required' }, { status: 400 });
    }

    const results = await Promise.all(titles.map((t) => resolveForTitle(userId, t)));
    const merged = {
      highlights: results.flatMap((r) => r.highlights),
      stats: results.reduce(
        (acc, r) => ({
          total: acc.total + r.stats.total,
          ok: acc.ok + r.stats.ok,
          rematched: acc.rematched + r.stats.rematched,
          orphaned: acc.orphaned + r.stats.orphaned,
          cache_hits: acc.cache_hits + r.stats.cache_hits,
        }),
        { total: 0, ok: 0, rematched: 0, orphaned: 0, cache_hits: 0 },
      ),
    };

    return NextResponse.json(merged, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('resolve-batch POST 실패:', error);
    return NextResponse.json({ error: 'resolve 실패' }, { status: 500 });
  }
}
