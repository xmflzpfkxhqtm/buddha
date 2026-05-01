import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/** `data/scripture/foo/bar.md` → `foo_bar` (DB title / API 키). macOS NFD 파일명을 NFC 로 통일. */
function scriptureTitleFromRelativePath(relativePath) {
  const posix = relativePath.replace(/\\/g, '/');
  const withoutExt = posix.replace(/\.(md|txt)$/i, '');
  return withoutExt.split('/').filter(Boolean).join('_').normalize('NFC');
}

function shouldSkipDir(name) {
  return name === 'backup' || name === '.git';
}

/** `dir` 바로 아래 파일만 (기존 data/ 루트 동작 유지) */
async function collectFlatFiles(dir, subfolder) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!/\.(md|txt)$/i.test(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    const content = await fs.readFile(fullPath, 'utf-8');
    const format = entry.name.toLowerCase().endsWith('.md') ? 'md' : 'txt';
    const rel = entry.name.replace(/\\/g, '/').normalize('NFC');
    const title = scriptureTitleFromRelativePath(rel);
    files.push({ title, filename: rel, format, subfolder, scripture_group: null, content });
  }
  return files;
}

/** `data/scripture` 이하 재귀 (폴더별 경전 배치 지원) */
async function collectRecursiveScripture(dir, subfolder) {
  const files = [];
  async function walk(abs, relPosix, group) {
    const entries = await fs.readdir(abs, { withFileTypes: true });
    for (const entry of entries) {
      if (shouldSkipDir(entry.name)) continue;
      const nextRel = relPosix ? `${relPosix}/${entry.name}` : entry.name;
      const absNext = path.join(abs, entry.name);
      if (entry.isDirectory()) {
        // 첫 단계 디렉터리만 그룹 키로 사용 (NFC 정규화)
        const nextGroup = group ?? entry.name.normalize('NFC');
        await walk(absNext, nextRel, nextGroup);
      } else if (entry.isFile() && /\.(md|txt)$/i.test(entry.name) && !entry.name.includes('용어사전')) {
        const content = await fs.readFile(absNext, 'utf-8');
        const format = entry.name.toLowerCase().endsWith('.md') ? 'md' : 'txt';
        const title = scriptureTitleFromRelativePath(nextRel);
        files.push({
          title,
          filename: nextRel.replace(/\\/g, '/').normalize('NFC'),
          format,
          subfolder,
          scripture_group: group ?? null,
          content,
        });
      }
    }
  }
  await walk(dir, '', null);
  return files;
}

async function loadEnv() {
  for (const name of ['.env', '.env.local']) {
    const envPath = path.join(ROOT, name);
    try {
      const raw = await fs.readFile(envPath, 'utf-8');
      const env = {};
      for (const line of raw.split('\n')) {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
        if (!m) continue;
        let val = m[2];
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        env[m[1]] = val;
      }
      if (Object.keys(env).length) return env;
    } catch {
      /* try next */
    }
  }
  return {};
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const CLEAN_STALE = args.has('--clean');

  const env = await loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env or .env.local');
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const all = [];

  const dataRoot = path.join(ROOT, 'data');
  try {
    const files = await collectFlatFiles(dataRoot, null);
    console.log(`  ${dataRoot} (flat): ${files.length} files`);
    all.push(...files);
  } catch (err) {
    console.warn(`  skip ${dataRoot}: ${err.message}`);
  }

  const scriptureDir = path.join(ROOT, 'data', 'scripture');
  try {
    const files = await collectRecursiveScripture(scriptureDir, 'scripture');
    console.log(`  ${scriptureDir} (recursive): ${files.length} files`);
    all.push(...files);
  } catch (err) {
    console.warn(`  skip ${scriptureDir}: ${err.message}`);
  }

  // Dedup by title: prefer .md over .txt, prefer data/ root over data/scripture/
  const rankFormat = (f) => (f === 'md' ? 2 : 1);
  const rankSubfolder = (s) => (s === null ? 2 : 1);
  const byTitle = new Map();
  for (const item of all) {
    const prev = byTitle.get(item.title);
    if (!prev) {
      byTitle.set(item.title, item);
      continue;
    }
    const prevScore = rankFormat(prev.format) * 10 + rankSubfolder(prev.subfolder);
    const curScore = rankFormat(item.format) * 10 + rankSubfolder(item.subfolder);
    if (curScore > prevScore) byTitle.set(item.title, item);
  }

  const final = [...byTitle.values()];
  console.log(`Total after dedup: ${final.length} (from ${all.length})`);

  const totalBytes = final.reduce((acc, f) => acc + Buffer.byteLength(f.content, 'utf-8'), 0);
  console.log(`Total content size: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);

  const batchSize = 50;
  const maxRetries = 3;
  let done = 0;
  const startedAt = Date.now();
  for (let i = 0; i < final.length; i += batchSize) {
    const batch = final.slice(i, i + batchSize);
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      const { error } = await supabase.from('scriptures').upsert(batch, { onConflict: 'title' });
      if (!error) { lastError = null; break; }
      lastError = error;
      if (attempt < maxRetries) {
        const waitMs = 1000 * 2 ** (attempt - 1);
        process.stdout.write('\n');
        console.warn(`Batch ${i}..${i + batch.length} attempt ${attempt} failed (${error.code ?? '-'}), retrying in ${waitMs}ms...`);
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
    if (lastError) {
      process.stdout.write('\n');
      console.error(`Batch ${i}..${i + batch.length} failed after ${maxRetries} attempts:`);
      console.error(JSON.stringify(lastError, null, 2));
      process.exit(1);
    }
    done += batch.length;
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    process.stdout.write(`\r  ${done}/${final.length} (${elapsed}s)    `);
  }
  process.stdout.write('\n');

  if (CLEAN_STALE) {
    const liveTitles = new Set(final.map((f) => f.title));
    console.log('Scanning for stale rows in DB...');
    const staleIds = [];
    const pageSize = 1000;
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from('scriptures')
        .select('id, title')
        .range(from, from + pageSize - 1);
      if (error) {
        console.error('Stale scan failed:', error.message);
        process.exit(1);
      }
      if (!data || data.length === 0) break;
      for (const row of data) {
        if (!liveTitles.has(row.title)) staleIds.push(row.id);
      }
      if (data.length < pageSize) break;
      from += pageSize;
    }
    console.log(`Stale rows to delete: ${staleIds.length}`);
    for (let i = 0; i < staleIds.length; i += 500) {
      const chunk = staleIds.slice(i, i + 500);
      const { error } = await supabase.from('scriptures').delete().in('id', chunk);
      if (error) {
        console.error('Stale delete failed:', error.message);
        process.exit(1);
      }
    }
    if (staleIds.length > 0) console.log(`Deleted ${staleIds.length} stale rows.`);
  }

  const totalElapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`✅ Migration complete in ${totalElapsed}s${CLEAN_STALE ? ' (with stale cleanup)' : ''}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
