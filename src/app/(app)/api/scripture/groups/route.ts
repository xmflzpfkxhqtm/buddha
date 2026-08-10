// app/api/scripture/groups/route.ts
// Layer 1 (Browse) 용. 기존 /api/scripture, /api/scripture/list 는 동결, 이 라우트는 순수 additive.
import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { type ScriptureGroupRow } from '@/types/scripture';

export const runtime = 'nodejs';

const PAGE_SIZE = 1000;
const PER_TOPIC_LIMIT = 12;

// 주제 태그 vocabulary (12개) — Layer 1 디자인 확정값
const TOPIC_TAGS = [
  '좌선/명상',
  '염불/정토',
  '다라니/주력',
  '참회와 발원',
  '죽음과 천도',
  '부처의 생애',
  '비유와 이야기',
  '계율과 행지',
  '보시와 공덕',
  '보살의 길',
  '공과 지혜',
  '밀교 의식',
] as const;

type GroupRow = ScriptureGroupRow;

export async function GET() {
  try {
    const rows: GroupRow[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('scripture_groups')
        .select(
          'group_key, display_name, chinese_title, translator, intro, school_tags, topic_tags, is_featured, volume_total, k_code',
        )
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.error('scripture_groups 조회 실패:', error);
        return NextResponse.json({ error: '불러오기 실패' }, { status: 500 });
      }
      if (!data || data.length === 0) break;
      rows.push(...(data as GroupRow[]));
      if (data.length < PAGE_SIZE) break;
    }

    const cmp = (a: GroupRow, b: GroupRow) => {
      const fa = a.is_featured ? 1 : 0;
      const fb = b.is_featured ? 1 : 0;
      if (fa !== fb) return fb - fa;
      const na = a.display_name ?? a.group_key;
      const nb = b.display_name ?? b.group_key;
      return na.localeCompare(nb, 'ko-KR', { numeric: true });
    };

    const featured = rows.filter((r) => r.is_featured).sort(cmp);

    // 12개 topic 모두 반환 — 프론트가 매 로드마다 3개 랜덤 선택.
    // 각 topic 당 최대 PER_TOPIC_LIMIT, 프론트가 그중 4~5개 다시 랜덤 선택.
    const topics = TOPIC_TAGS.map((tag) => {
      const groups = rows
        .filter((r) => (r.topic_tags ?? []).includes(tag))
        .sort(cmp)
        .slice(0, PER_TOPIC_LIMIT);
      return { tag, groups };
    });

    return NextResponse.json(
      { featured, topics },
      {
        headers: {
          // groups는 LLM 메타 갱신 시점에만 바뀜 — 사실상 정적
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        },
      },
    );
  } catch (error) {
    console.error('scripture_groups 조회 실패:', error);
    return NextResponse.json({ error: '불러오기 실패' }, { status: 500 });
  }
}
