// app/api/concepts/route.ts
// Phase 6B — 전체 concepts dictionary 반환. Reader 가 mount 시 1회 받아서 메모리 lookup.
// 정적 데이터 (빌드 후 변경 안 됨) — public cache 길게.

import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';

let cachedRaw: string | null = null;

export async function GET() {
  try {
    if (!cachedRaw) {
      const filePath = path.join(process.cwd(), 'dictionary', 'concepts.json');
      cachedRaw = await readFile(filePath, 'utf-8');
    }
    return new NextResponse(cachedRaw, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      },
    });
  } catch (error) {
    console.error('concepts.json 로드 실패:', error);
    return NextResponse.json({ error: '불러오기 실패' }, { status: 500 });
  }
}
