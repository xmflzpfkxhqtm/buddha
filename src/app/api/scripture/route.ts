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
    const filePath = path.join(process.cwd(), 'data', `${safeTitle}.txt`);
    const content = await readFile(filePath, 'utf-8');

    return NextResponse.json({ content });
  } catch (error) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
