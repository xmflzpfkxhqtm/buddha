import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query')?.trim();

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  const dataDir = path.join(process.cwd(), 'data'); // ✅ /data 폴더
  const files = await fs.readdir(dataDir);

  const results: { title: string; index: number; text: string }[] = [];

  for (const file of files) {
    if (!file.endsWith('.txt')) continue; // ✅ txt 파일만
    const title = file.replace('.txt', '');

    const filePath = path.join(dataDir, file);
    const content = await fs.readFile(filePath, 'utf-8');

    const lines = content.split(/\n+/); // ✅ 줄 단위로 나누기

    lines.forEach((line, index) => {
      if (line.includes(query)) {
        results.push({ title, index, text: line });
      }
    });
  }

  return NextResponse.json({ results });
}
