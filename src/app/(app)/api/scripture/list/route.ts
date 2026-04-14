// app/api/scripture/list/route.ts
import { NextResponse } from 'next/server';
import { readdir } from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    const roots = [path.join(process.cwd(), 'data'), path.join(process.cwd(), 'data', 'scripture')];
    const entries = new Map<string, { title: string; priority: number }>();

    for (const root of roots) {
      let files: string[] = [];
      try {
        files = await readdir(root);
      } catch {
        continue;
      }

      files
        .filter((file) => file.endsWith('.md') || file.endsWith('.txt'))
        .filter((file) => !file.includes('용어사전'))
        .forEach((file) => {
          const isMd = file.endsWith('.md');
          const baseTitle = file.replace(/\.(md|txt)$/u, '');
          const normalizedTitle = baseTitle
            .trim()
            .replace(/\uFEFF/g, '')
            .replace(/\s/g, '')
            .normalize('NFC');

          // 같은 제목이 .md/.txt 둘 다 있으면 .md 우선
          const nextPriority = isMd ? 2 : 1;
          const prev = entries.get(normalizedTitle);
          if (!prev || nextPriority > prev.priority) {
            entries.set(normalizedTitle, { title: normalizedTitle, priority: nextPriority });
          }
        });
    }

    const titles = Array.from(entries.values()).map((entry) => entry.title).sort((a, b) => a.localeCompare(b, 'ko-KR', { numeric: true }));

    return NextResponse.json({ titles });
  } catch (error) {
    console.error('파일 목록 불러오기 실패:', error);
    return NextResponse.json({ error: '불러오기 실패' }, { status: 500 });
  }
}
