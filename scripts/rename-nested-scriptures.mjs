#!/usr/bin/env node
// data/scripture/<folder>/ 안의 파일에서 <folder>_ prefix 또는 base(_K\d+ 뗀) prefix 를
// 제거해 파일명을 짧게 만든다. _KNNNN 정보는 폴더명에 살아있으므로 별도 보존 불필요.
//
// 사용:
//   node scripts/rename-nested-scriptures.mjs            # dry-run
//   node scripts/rename-nested-scriptures.mjs --apply    # git mv 실행
//   node scripts/rename-nested-scriptures.mjs --apply --no-git   # 일반 mv
//
// macOS NFD/NFC 차이에 안전하도록 비교 시 NFC 정규화한다.

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SCRIPTURE_DIR = path.join(ROOT, 'data', 'scripture');

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const USE_GIT = !args.has('--no-git');

const nfc = (s) => s.normalize('NFC');
const stripKSuffix = (folderName) => folderName.replace(/_K\d+$/, '');

function shouldSkipDir(name) {
  return name === 'backup' || name === '.git';
}

function planRenamesIn(folderAbs) {
  const folderName = nfc(path.basename(folderAbs));
  const base = stripKSuffix(folderName);
  const renames = [];
  const skipped = [];

  const entries = fs.readdirSync(folderAbs, { withFileTypes: true });
  const targetNames = new Map();

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const original = entry.name;
    const nameNFC = nfc(original);
    const m = nameNFC.match(/^(.*)\.(md|txt)$/i);
    if (!m) continue;
    const stem = m[1];
    const ext = m[2];

    let newStem = null;
    if (stem.startsWith(folderName + '_')) {
      newStem = stem.slice(folderName.length + 1);
    } else if (folderName !== base && stem.startsWith(base + '_')) {
      newStem = stem.slice(base.length + 1);
    } else if (stem === folderName || stem === base) {
      skipped.push({ reason: 'single-volume-equal-folder', name: original });
      continue;
    } else {
      skipped.push({ reason: 'no-prefix-match', name: original });
      continue;
    }

    if (!newStem) {
      skipped.push({ reason: 'empty-after-strip', name: original });
      continue;
    }

    const newName = `${newStem}.${ext}`;
    if (newName === nameNFC) continue;
    const dup = targetNames.get(newName);
    if (dup) {
      skipped.push({ reason: `target-collision-with:${dup}`, name: original });
      continue;
    }
    targetNames.set(newName, original);
    renames.push({ from: original, to: newName });
  }

  return { renames, skipped, folderName };
}

function gitMove(absFrom, absTo) {
  execFileSync('git', ['mv', absFrom, absTo], { cwd: ROOT, stdio: 'inherit' });
}

function plainMove(absFrom, absTo) {
  fs.renameSync(absFrom, absTo);
}

function main() {
  if (!fs.existsSync(SCRIPTURE_DIR)) {
    console.error(`scripture dir not found: ${SCRIPTURE_DIR}`);
    process.exit(1);
  }

  const subdirs = fs
    .readdirSync(SCRIPTURE_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !shouldSkipDir(e.name))
    .map((e) => path.join(SCRIPTURE_DIR, e.name));

  let totalRenames = 0;
  const allSkipped = [];

  for (const folderAbs of subdirs) {
    const { renames, skipped, folderName } = planRenamesIn(folderAbs);
    if (renames.length === 0 && skipped.length === 0) continue;

    if (renames.length > 0) {
      console.log(`\n[${folderName}] ${renames.length} rename(s)`);
      for (const { from, to } of renames) {
        console.log(`  ${from}  ->  ${to}`);
        if (APPLY) {
          const absFrom = path.join(folderAbs, from);
          const absTo = path.join(folderAbs, to);
          if (USE_GIT) gitMove(absFrom, absTo);
          else plainMove(absFrom, absTo);
        }
      }
      totalRenames += renames.length;
    }

    if (skipped.length > 0) {
      for (const s of skipped) {
        allSkipped.push({ folder: folderName, ...s });
      }
    }
  }

  console.log('\n===== summary =====');
  console.log(`total renames ${APPLY ? 'applied' : 'planned'}: ${totalRenames}`);
  console.log(`skipped (manual review needed): ${allSkipped.length}`);
  if (allSkipped.length > 0) {
    console.log('--- skipped detail ---');
    for (const s of allSkipped) {
      console.log(`  [${s.folder}] ${s.name}  (reason: ${s.reason})`);
    }
  }
  if (!APPLY) console.log('\n(dry-run) re-run with --apply to perform git mv');
}

main();
