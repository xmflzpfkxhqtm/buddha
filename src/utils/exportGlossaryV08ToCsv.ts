import { existsSync, mkdirSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

type ParsedRow = {
  adopted: string;
  meaning: string;
  hanja: string;
};

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function splitMarkdownRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
    return [];
  }
  return trimmed
    .slice(1, -1)
    .split('|')
    .map((part) => part.trim());
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.every((cell) => /^:?-{3,}:?$/u.test(cell.replace(/\s/g, '')));
}

function cleanAdopted(value: string): string {
  return value.replace(/\*\*/g, '').trim();
}

function parseGlossaryTables(content: string): ParsedRow[] {
  const lines = content.split(/\r?\n/u);
  const rows: ParsedRow[] = [];
  let headers: string[] | null = null;

  for (const line of lines) {
    const cells = splitMarkdownRow(line);
    if (cells.length === 0) {
      headers = null;
      continue;
    }

    if (isSeparatorRow(cells)) {
      continue;
    }

    if (!headers) {
      headers = cells;
      continue;
    }

    const hanjaIdx = headers.findIndex((h) => h.includes('한문'));
    const adoptedIdx = headers.findIndex((h) => h.includes('채택 표기'));
    const meaningIdx = headers.findIndex(
      (h) => h.includes('뜻/설명') || h === '설명',
    );

    if (hanjaIdx < 0 || adoptedIdx < 0 || meaningIdx < 0) {
      continue;
    }
    if (
      cells.length <= hanjaIdx ||
      cells.length <= adoptedIdx ||
      cells.length <= meaningIdx
    ) {
      continue;
    }

    const row: ParsedRow = {
      adopted: cleanAdopted(cells[adoptedIdx]),
      meaning: cells[meaningIdx].trim(),
      hanja: cells[hanjaIdx].trim(),
    };

    if (row.adopted && row.meaning && row.hanja) {
      rows.push(row);
    }
  }

  return rows;
}

export async function exportGlossaryV08ToCsv(options?: {
  inputFile?: string;
  outFile?: string;
}): Promise<{ count: number; outFile: string }> {
  const inputFile =
    options?.inputFile ?? join(process.cwd(), 'data', '용어사전_v0.8.md');
  const outFile =
    options?.outFile ?? join(process.cwd(), 'dictionary', 'glossary-v0.8.csv');

  const content = await readFile(inputFile, 'utf-8');
  const rows = parseGlossaryTables(content);

  const outDir = join(process.cwd(), 'dictionary');
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const csvLines = [
    'adopted,meaning,hanja',
    ...rows.map((row) =>
      [
        escapeCsvCell(row.adopted),
        escapeCsvCell(row.meaning),
        escapeCsvCell(row.hanja),
      ].join(','),
    ),
  ];

  await writeFile(outFile, `${csvLines.join('\n')}\n`, 'utf-8');
  return { count: rows.length, outFile };
}

const isMain =
  process.argv[1] &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);

if (isMain) {
  void exportGlossaryV08ToCsv()
    .then(({ count, outFile }) => {
      console.log(`Wrote ${count} rows to ${outFile}`);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
