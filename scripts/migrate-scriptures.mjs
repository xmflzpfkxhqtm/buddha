import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

async function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  const raw = await fs.readFile(envPath, 'utf-8');
  const env = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let val = m[2];
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[m[1]] = val;
  }
  return env;
}

async function collectFiles(dir, subfolder) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!/\.(md|txt)$/i.test(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    const content = await fs.readFile(fullPath, 'utf-8');
    const format = entry.name.toLowerCase().endsWith('.md') ? 'md' : 'txt';
    const title = entry.name.replace(/\.(md|txt)$/i, '');
    files.push({ title, filename: entry.name, format, subfolder, content });
  }
  return files;
}

async function main() {
  const env = await loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const roots = [
    { dir: path.join(ROOT, 'data'), subfolder: null },
    { dir: path.join(ROOT, 'data', 'scripture'), subfolder: 'scripture' },
  ];

  const all = [];
  for (const { dir, subfolder } of roots) {
    try {
      const files = await collectFiles(dir, subfolder);
      console.log(`  ${dir}: ${files.length} files`);
      all.push(...files);
    } catch (err) {
      console.warn(`  skip ${dir}: ${err.message}`);
    }
  }

  // Dedup by title: prefer .md over .txt, prefer data/ root over data/scripture/ (hong's newer files)
  const rankFormat = (f) => (f === 'md' ? 2 : 1);
  const rankSubfolder = (s) => (s === null ? 2 : 1); // root > scripture (hong added newer files to root)
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

  // Stats
  const totalBytes = final.reduce((acc, f) => acc + Buffer.byteLength(f.content, 'utf-8'), 0);
  console.log(`Total content size: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);

  // Batch upsert
  const batchSize = 50;
  let done = 0;
  const startedAt = Date.now();
  for (let i = 0; i < final.length; i += batchSize) {
    const batch = final.slice(i, i + batchSize);
    const { error } = await supabase.from('scriptures').upsert(batch, { onConflict: 'title' });
    if (error) {
      console.error(`Batch ${i}..${i + batch.length} failed:`, error.message);
      process.exit(1);
    }
    done += batch.length;
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    process.stdout.write(`\r  ${done}/${final.length} (${elapsed}s)    `);
  }
  process.stdout.write('\n');

  const totalElapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`✅ Migration complete in ${totalElapsed}s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
