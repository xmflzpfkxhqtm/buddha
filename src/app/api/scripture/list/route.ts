// app/api/scripture/list/route.ts
import { NextResponse } from 'next/server';
import { readdir } from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    const dirPath = path.join(process.cwd(), 'data', 'scripture');
    const files = await readdir(dirPath);
    const titles = files
      .filter((file) => file.endsWith('.txt'))
      .map((file) =>
        file
          .replace('.txt', '')
          .trim()
          .replace(/\uFEFF/g, '')        // BOM 제거
          .replace(/\s/g, '')            // 공백 제거
          .normalize('NFC')              // 유니코드 정규화
      );

    return NextResponse.json({ titles });
  } catch (error) {
    console.error('파일 목록 불러오기 실패:', error);
    return NextResponse.json({ error: '불러오기 실패' }, { status: 500 });
  }
}
