import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { cleanScriptureTitle } from '@/utils/chunking';
import { scriptureTitleFromRelativePath } from '@/utils/scripturePaths';

export const isScriptureDataFile = (fileName: string) =>
  (fileName.endsWith('.txt') || fileName.endsWith('.md')) &&
  !fileName.includes('용어사전');

export function shouldSkipScriptureWalkDir(name: string): boolean {
  return name === 'backup' || name === '.git';
}

/** `data/scripture` 이하 모든 .md/.txt 상대경로(posix) */
export function listScriptureDataFilesRecursive(dirAbs: string): string[] {
  const out: string[] = [];
  function walk(abs: string, relPosix: string) {
    if (!fs.existsSync(abs)) return;
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (shouldSkipScriptureWalkDir(entry.name)) continue;
      const nextRel = relPosix ? `${relPosix}/${entry.name}` : entry.name;
      const absNext = path.join(abs, entry.name);
      if (entry.isDirectory()) {
        walk(absNext, nextRel);
      } else if (entry.isFile() && isScriptureDataFile(entry.name)) {
        out.push(nextRel);
      }
    }
  }
  walk(dirAbs, '');
  return out;
}

/** 임베딩 스킵 판단용: `data/` 평면 + `data/scripture/**` 에 이미 있는 canonical 제목 키 */
export function buildCanonicalTitleKeysForEmbed(): Set<string> {
  const set = new Set<string>();
  const dataRoot = path.join(process.cwd(), 'data');
  if (fs.existsSync(dataRoot)) {
    for (const name of fs.readdirSync(dataRoot)) {
      if (!isScriptureDataFile(name) || name.includes('용어사전')) continue;
      set.add(cleanScriptureTitle(scriptureTitleFromRelativePath(name)));
    }
  }
  const scriptureRoot = path.join(dataRoot, 'scripture');
  if (fs.existsSync(scriptureRoot)) {
    for (const rel of listScriptureDataFilesRecursive(scriptureRoot)) {
      set.add(cleanScriptureTitle(scriptureTitleFromRelativePath(rel)));
    }
  }
  return set;
}

function isDeletedStatus(status: string): boolean {
  return status[0] === 'D' || status[1] === 'D';
}

export function collectChangedScriptureFiles(dataDir: string): string[] {
  const raw = fs.existsSync(path.join(process.cwd(), '.git'))
    ? execSync('git status --porcelain -z', { encoding: 'utf-8' })
    : '';
  const records = raw.split('\0');
  const bySource = new Map<string, string>();

  for (let i = 0; i < records.length; i += 1) {
    const rec = records[i];
    if (!rec) continue;
    const status = rec.slice(0, 2);
    const filePath = rec.slice(3);

    if ((status[0] === 'R' || status[0] === 'C') && i + 1 < records.length) {
      i += 1;
    }

    if (isDeletedStatus(status)) continue;
    if (!filePath.startsWith('data/scripture/')) continue;
    if (!isScriptureDataFile(filePath)) continue;

    const relFromScripture = filePath.slice('data/scripture/'.length).replace(/\\/g, '/');
    const source = cleanScriptureTitle(scriptureTitleFromRelativePath(relFromScripture));
    const existing = bySource.get(source);
    if (
      !existing ||
      (relFromScripture.toLowerCase().endsWith('.md') && existing.toLowerCase().endsWith('.txt'))
    ) {
      const fullPath = path.join(dataDir, ...relFromScripture.split('/'));
      if (fs.existsSync(fullPath)) bySource.set(source, relFromScripture);
    }
  }
  return Array.from(bySource.values());
}
