import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

type GlossaryMap = Record<string, string>;

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += ch;
  }

  cells.push(current.trim());
  return cells;
}

function parseGlossaryCsv(csv: string): GlossaryMap {
  const lines = csv.split(/\r?\n/u).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return {};

  const header = parseCsvLine(lines[0]);
  const adoptedIdx = header.findIndex((h) => h === 'adopted');
  const meaningIdx = header.findIndex((h) => h === 'meaning');
  if (adoptedIdx < 0 || meaningIdx < 0) {
    throw new Error('CSV header must include adopted and meaning columns.');
  }

  const map: GlossaryMap = {};
  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i]);
    const adopted = cells[adoptedIdx]?.trim();
    const meaning = cells[meaningIdx]?.trim();
    if (adopted && meaning) {
      map[adopted] = meaning;
    }
  }
  return map;
}

export async function GET() {
  try {
    const glossaryPath = path.join(
      process.cwd(),
      'dictionary',
      'glossary-v0.8.csv',
    );
    const content = await readFile(glossaryPath, 'utf-8');
    const glossary = parseGlossaryCsv(content);
    return NextResponse.json({ glossary });
  } catch (error) {
    console.error('용어사전 CSV 로딩 실패:', error);
    return NextResponse.json(
      { error: '용어사전 CSV를 불러오지 못했습니다.' },
      { status: 500 },
    );
  }
}
