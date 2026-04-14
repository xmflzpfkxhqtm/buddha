// app/api/read/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get('title');

  if (!title) {
    return NextResponse.json({ error: 'No title provided' }, { status: 400 });
  }

  try {
    const safeTitle = path.basename(title); // 디렉터리 탈출 방지
    const roots = [path.join(process.cwd(), 'data'), path.join(process.cwd(), 'data', 'scripture')];
    const extensions = ['.md', '.txt'];

    for (const root of roots) {
      for (const ext of extensions) {
        const filePath = path.join(root, `${safeTitle}${ext}`);
        try {
          const content = await readFile(filePath, 'utf-8');
          return NextResponse.json({
            content,
            format: ext === '.md' ? 'md' : 'txt',
            sourceFile: path.basename(filePath),
          });
        } catch {
          // 다음 후보 파일 검사
        }
      }
    }

    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  } catch (error) {
    console.error('파일을 찾을 수 없습니다:', error);
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}