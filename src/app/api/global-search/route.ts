// app/api/global-search/route.ts
import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query')?.trim();

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  const dataDir = path.join(process.cwd(), 'data');
  const files = await fs.readdir(dataDir);

  const results: { title: string; index: number; text: string }[] = [];

  for (const file of files) {
    if (!file.endsWith('.txt')) continue;
    const title = file.replace('.txt', '');

    const filePath = path.join(dataDir, file);
    const content = await fs.readFile(filePath, 'utf-8');

    const paragraphs = content.split(/\n\s*\n/);

    const sentences = paragraphs
      .map((p) => 
        p
          .split(/(?<=[.!?]["”'’]?)\s+/) // ✅ 문장 단위 쪼개기
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      )
      .flat();

    sentences.forEach((sentence, index) => {
      if (sentence.includes(query)) {
        results.push({ title, index, text: sentence });
      }
    });
  }

  return NextResponse.json({ results });
}
