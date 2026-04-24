import { execSync } from 'child_process';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';

const SENTENCE_END_RE = /[.!?。！？]["')\]”’*]*$/u;
const TABLE_LINE_RE = /^\s*\|.*\|\s*$/u;
const TABLE_SEPARATOR_RE = /^\s*\|?[\s:-]+(?:\|[\s:-]+)+\|?\s*$/u;

type NormalizeResult = {
  filePath: string;
  violations: number;
  applied: number;
};

function isStructuralLine(trimmed: string): boolean {
  if (!trimmed) return true;
  if (trimmed.startsWith('```')) return true;
  if (trimmed.startsWith('#')) return true;
  if (trimmed.startsWith('>')) return true;
  if (/^[-*_]{3,}$/u.test(trimmed)) return true;
  if (/^\s*[-*+]\s+/u.test(trimmed)) return true;
  if (/^\s*\d+\.\s+/u.test(trimmed)) return true;
  if (TABLE_LINE_RE.test(trimmed) || TABLE_SEPARATOR_RE.test(trimmed)) return true;
  return false;
}

function isSentenceCandidateLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (isStructuralLine(trimmed)) return false;
  return true;
}

function isSentenceEndingLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || isStructuralLine(trimmed)) return false;
  return SENTENCE_END_RE.test(trimmed);
}

function splitLineIntoSentences(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed || isStructuralLine(trimmed)) return [line];

  const parts: string[] = [];
  let start = 0;
  let cursor = 0;
  let activeEmphasis = 0;

  while (cursor < trimmed.length) {
    const ch = trimmed[cursor];
    if (ch === '*') {
      let run = 1;
      while (cursor + run < trimmed.length && trimmed[cursor + run] === '*') run += 1;
      if (run >= 3) {
        activeEmphasis = activeEmphasis === 3 ? 0 : 3;
      } else if (run === 2) {
        activeEmphasis = activeEmphasis === 2 ? 0 : 2;
      } else {
        activeEmphasis = activeEmphasis === 1 ? 0 : 1;
      }
      cursor += run;
      continue;
    }

    const isSentenceEnd = /[.!?。！？]/u.test(ch);
    if (isSentenceEnd && activeEmphasis === 0) {
      let end = cursor + 1;
      while (end < trimmed.length && /["')\]”’]/u.test(trimmed[end])) end += 1;
      while (end < trimmed.length && trimmed[end] === '*') end += 1;
      const token = trimmed.slice(start, end).trim();
      if (token) parts.push(token);
      start = end;
      while (start < trimmed.length && /\s/u.test(trimmed[start])) start += 1;
      cursor = start;
      continue;
    }

    cursor += 1;
  }

  const tail = trimmed.slice(start).trim();
  if (tail) parts.push(tail);
  return parts.length > 1 ? parts : [line];
}

function isDeletedStatus(status: string): boolean {
  return status[0] === 'D' || status[1] === 'D';
}

function getChangedMarkdownFilesFromGitStatus(): string[] {
  const raw = execSync('git status --porcelain -z', { encoding: 'utf-8' });
  const records = raw.split('\0').filter(Boolean);
  const files = new Set<string>();
  for (const rec of records) {
    const status = rec.slice(0, 2);
    const filePath = rec.slice(3);
    if (!filePath.endsWith('.md')) continue;
    if (isDeletedStatus(status)) continue;
    if (status === '??' || status.trim().length > 0) {
      files.add(filePath);
    }
  }
  return Array.from(files).sort((a, b) => a.localeCompare(b, 'ko-KR', { numeric: true }));
}

function isStandaloneEmphasisCloser(line: string): boolean {
  return /^(\*{1,3})["')\]”’]*$/u.test(line.trim());
}

function attachStandaloneClosers(lines: string[], applyFixes: boolean): { lines: string[]; violations: number; applied: number } {
  const out = [...lines];
  let violations = 0;
  let applied = 0;

  for (let i = 1; i < out.length; i += 1) {
    if (!isStandaloneEmphasisCloser(out[i])) continue;
    let prev = i - 1;
    while (prev >= 0 && out[prev].trim() === '') prev -= 1;
    if (prev < 0) continue;

    const closer = out[i].trim();
    const prevTrimmed = out[prev].trim();
    const likelyBroken =
      /[.!?。！？]["')\]”’]*$/u.test(prevTrimmed) ||
      /[*_]/u.test(prevTrimmed);
    if (!likelyBroken) continue;

    violations += 1;
    if (!applyFixes) continue;

    out[prev] = `${out[prev]}${closer}`;
    out.splice(i, 1);
    applied += 1;
    i -= 1;
  }

  return { lines: out, violations, applied };
}

function normalizeLines(lines: string[], applyFixes: boolean): { lines: string[]; violations: number; applied: number } {
  const closerFix = attachStandaloneClosers(lines, applyFixes);
  const out: string[] = [];
  let violations = 0;
  let applied = 0;
  let inCodeBlock = false;

  for (const line of closerFix.lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      out.push(line);
      continue;
    }
    if (inCodeBlock || !isSentenceCandidateLine(line)) {
      out.push(line);
      continue;
    }

    const split = splitLineIntoSentences(line);
    if (split.length <= 1) {
      out.push(line);
      continue;
    }

    violations += split.length - 1;
    if (applyFixes) {
      applied += split.length - 1;
      split.forEach((sentence, idx) => {
        out.push(sentence);
        if (idx < split.length - 1) {
          out.push('');
        }
      });
    } else {
      out.push(line);
    }
  }

  inCodeBlock = false;
  let i = 0;

  while (i < out.length) {
    const line = out[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      i += 1;
      continue;
    }
    if (inCodeBlock) {
      i += 1;
      continue;
    }
    if (!isSentenceEndingLine(line)) {
      i += 1;
      continue;
    }

    let j = i + 1;
    let blankCount = 0;
    while (j < out.length && out[j].trim() === '') {
      blankCount += 1;
      j += 1;
    }
    if (j >= out.length) break;

    const nextLine = out[j];
    if (!isSentenceCandidateLine(nextLine)) {
      i = j;
      continue;
    }

    if (blankCount !== 1) {
      violations += 1;
      if (applyFixes) {
        out.splice(i + 1, blankCount, '');
        applied += 1;
      }
    }
    i += 1;
  }

  return {
    lines: out,
    violations: violations + closerFix.violations,
    applied: applied + closerFix.applied,
  };
}

async function run(): Promise<void> {
  const mode = process.argv.includes('--write') ? 'write' : 'check';
  const applyFixes = mode === 'write';
  const targets = getChangedMarkdownFilesFromGitStatus();
  const results: NormalizeResult[] = [];

  for (const relPath of targets) {
    const filePath = path.resolve(process.cwd(), relPath);
    const original = await readFile(filePath, 'utf-8');
    const hasFinalNewline = original.endsWith('\n');
    const lines = original.split('\n');
    const normalized = normalizeLines(lines, applyFixes);

    if (applyFixes && normalized.applied > 0) {
      let nextContent = normalized.lines.join('\n');
      if (hasFinalNewline && !nextContent.endsWith('\n')) {
        nextContent += '\n';
      }
      if (!hasFinalNewline && nextContent.endsWith('\n')) {
        nextContent = nextContent.slice(0, -1);
      }
      await writeFile(filePath, nextContent, 'utf-8');
    }

    if (normalized.violations > 0 || normalized.applied > 0) {
      results.push({
        filePath: relPath,
        violations: normalized.violations,
        applied: normalized.applied,
      });
    }
  }

  const totalViolations = results.reduce((sum, r) => sum + r.violations, 0);
  const totalApplied = results.reduce((sum, r) => sum + r.applied, 0);

  console.log(`mode=${mode}`);
  console.log(`targets=${targets.length}`);
  console.log(`files_with_issues=${results.length}`);
  console.log(`violations=${totalViolations}`);
  console.log(`applied=${totalApplied}`);
  for (const r of results) {
    console.log(`${r.filePath}\tviolations=${r.violations}\tapplied=${r.applied}`);
  }
}

void run().catch((error) => {
  console.error(error);
  process.exit(1);
});
