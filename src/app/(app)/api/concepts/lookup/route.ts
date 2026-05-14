// app/api/concepts/lookup/route.ts
// Phase 6B — surface form → ConceptEntry 매핑.
// 기존 /api/glossary 는 동결 유지 (Capacitor 옛 캐시 호환). 이 라우트는 additive.
//
// GET  ?surface=공            — 단건
// POST { surfaces: ['공',...] } — 다건
//
// 응답: surface → entry 매핑. entry 없으면 null.
// 본문 매칭 surface 가 entry.korean 또는 entry.korean_variants 중 하나면 hit.

import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import type { ConceptDictionary, ConceptEntry } from '@/lib/concepts';
import { buildLookupIndex } from '@/lib/concepts';

export const runtime = 'nodejs';

// 모듈 스코프 캐시 — 빌드 후 처음 호출 시 1회 로드, 이후 메모리.
// concepts.json 변경 시 서버 재시작 필요 (정적 데이터 가정).
let cachedDict: ConceptDictionary | null = null;
let cachedIndex: Map<string, ConceptEntry> | null = null;

async function loadDict(): Promise<{ dict: ConceptDictionary; index: Map<string, ConceptEntry> }> {
  if (cachedDict && cachedIndex) {
    return { dict: cachedDict, index: cachedIndex };
  }
  const filePath = path.join(process.cwd(), 'dictionary', 'concepts.json');
  const raw = await readFile(filePath, 'utf-8');
  const dict = JSON.parse(raw) as ConceptDictionary;
  const index = buildLookupIndex(dict);
  cachedDict = dict;
  cachedIndex = index;
  return { dict, index };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const surface = searchParams.get('surface');
    if (!surface) {
      return NextResponse.json({ error: 'surface required' }, { status: 400 });
    }
    const { index } = await loadDict();
    const entry = index.get(surface) ?? null;
    return NextResponse.json(
      { surface, entry },
      {
        headers: {
          // 정적 데이터 — 빌드 사이 캐시 가능
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      },
    );
  } catch (error) {
    console.error('concepts lookup GET 실패:', error);
    return NextResponse.json({ error: 'lookup 실패' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { surfaces?: string[] };
    const surfaces = body.surfaces ?? [];
    if (surfaces.length === 0) {
      return NextResponse.json({ entries: {} });
    }
    const { index } = await loadDict();
    const entries: Record<string, ConceptEntry | null> = {};
    for (const s of surfaces) {
      entries[s] = index.get(s) ?? null;
    }
    return NextResponse.json(
      { entries },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      },
    );
  } catch (error) {
    console.error('concepts lookup POST 실패:', error);
    return NextResponse.json({ error: 'lookup 실패' }, { status: 500 });
  }
}
