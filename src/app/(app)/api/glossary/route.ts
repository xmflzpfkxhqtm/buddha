import { NextResponse } from 'next/server';
import { readFile, readdir } from 'fs/promises';
import path from 'path';

type GlossaryMap = Record<string, string>;

const stripMd = (value: string) =>
  value
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .trim();

const splitRow = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => stripMd(cell.trim()));

const isSeparatorRow = (line: string): boolean =>
  /^\|[\s:\-|]+\|?$/.test(line.trim());

const parseGlossary = (md: string): GlossaryMap => {
  const lines = md.split('\n');
  const map: GlossaryMap = {};

  for (let i = 0; i < lines.length - 2; i += 1) {
    const headerLine = lines[i];
    const separatorLine = lines[i + 1];
    if (!headerLine.trim().startsWith('|') || !isSeparatorRow(separatorLine)) {
      continue;
    }

    const headers = splitRow(headerLine);
    const adoptedIdx = headers.findIndex((h) => h.includes('채택 표기'));
    const descIdx = headers.findIndex((h) => h.includes('뜻/설명') || h === '설명');

    if (adoptedIdx < 0 || descIdx < 0) {
      continue;
    }

    let rowIdx = i + 2;
    while (rowIdx < lines.length && lines[rowIdx].trim().startsWith('|')) {
      const cells = splitRow(lines[rowIdx]);
      const adopted = cells[adoptedIdx];
      const description = cells[descIdx];
      if (adopted && description) {
        map[adopted] = description;
      }
      rowIdx += 1;
    }

    i = rowIdx - 1;
  }

  return map;
};

export async function GET() {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    const files = await readdir(dataDir);
    const glossaryFile =
      files.find((file) => file.endsWith('.md') && file.includes('용어사전')) ||
      files.find((file) => file.endsWith('.md') && file.toLowerCase().includes('v0.8'));

    if (!glossaryFile) {
      return NextResponse.json({ error: '용어사전 파일이 없습니다.' }, { status: 404 });
    }

    const glossaryPath = path.join(dataDir, glossaryFile);
    const content = await readFile(glossaryPath, 'utf-8');
    const glossary = parseGlossary(content);
    return NextResponse.json({ glossary });
  } catch (error) {
    console.error('용어사전 로딩 실패:', error);
    return NextResponse.json({ error: '용어사전을 불러오지 못했습니다.' }, { status: 500 });
  }
}
