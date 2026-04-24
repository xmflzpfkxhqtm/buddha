import { readdir, readFile, writeFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { extname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const WIKI_LINK = /\[\[([^\]]+)\]\]/g;

function displayTerm(raw: string): string {
  return raw.split('|')[0].trim();
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

async function* walkMdTxtFiles(dataRoot: string): AsyncGenerator<string> {
  const entries = await readdir(dataRoot, { withFileTypes: true });
  for (const ent of entries) {
    const full = join(dataRoot, ent.name);
    if (ent.isDirectory()) {
      yield* walkMdTxtFiles(full);
    } else if (ent.isFile()) {
      const ext = extname(ent.name).toLowerCase();
      if (ext === '.md' || ext === '.txt') {
        yield full;
      }
    }
  }
}

export async function extractWikiTermsToCsv(options?: {
  dataDir?: string;
  outFile?: string;
}): Promise<{ count: number; outFile: string }> {
  const dataDir = options?.dataDir ?? join(process.cwd(), 'data');
  const outFile =
    options?.outFile ?? join(process.cwd(), 'dictionary', 'wiki-terms.csv');

  const terms = new Set<string>();

  for await (const filePath of walkMdTxtFiles(dataDir)) {
    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch (e) {
      console.warn('read fail:', filePath, e);
      continue;
    }
    let m: RegExpExecArray | null;
    WIKI_LINK.lastIndex = 0;
    while ((m = WIKI_LINK.exec(content)) !== null) {
      const t = displayTerm(m[1] ?? '');
      if (t.length > 0) {
        terms.add(t);
      }
    }
  }

  const sorted = Array.from(terms).sort((a, b) =>
    a.localeCompare(b, 'ko-KR', { numeric: true }),
  );

  const outDir = join(process.cwd(), 'dictionary');
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const lines = [
    'term',
    ...sorted.map((t) => escapeCsvCell(t)),
  ];
  await writeFile(outFile, lines.join('\n') + '\n', 'utf-8');
  return { count: sorted.length, outFile };
}

const isMain =
  process.argv[1] &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);

if (isMain) {
  void extractWikiTermsToCsv()
    .then(({ count, outFile }) => {
      console.log(`Wrote ${count} terms to ${outFile}`);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
