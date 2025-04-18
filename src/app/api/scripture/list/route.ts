import { NextResponse } from 'next/server';
import { readdir } from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    const dirPath = path.join(process.cwd(), 'data');
    const files = await readdir(dirPath);
    const titles = files
      .filter((file) => file.endsWith('.txt'))
      .map((file) => file.replace('.txt', ''));
    return NextResponse.json({ titles });
  } catch (error) {
    return NextResponse.json({ error: '불러오기 실패' }, { status: 500 });
  }
}
