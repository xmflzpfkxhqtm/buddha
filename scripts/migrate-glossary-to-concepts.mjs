// Phase 6A — dictionary/glossary-v0.8.csv (247행) → dictionary/concepts.json
// 마이그 정책: 현 동작 보존 (모든 entry type='concept', density='always')
// 추후 curator 가 type/density 수동 분류.
//
// 사용: node scripts/migrate-glossary-to-concepts.mjs

import fs from 'fs/promises';
import path from 'path';

const CSV_PATH = path.join(process.cwd(), 'dictionary', 'glossary-v0.8.csv');
const OUT_PATH = path.join(process.cwd(), 'dictionary', 'concepts.json');

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
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

// canonical id 생성 — 한국어를 영문 슬러그로. 사람 검토 후 의미 있는 id 로 교체 권장.
// 임시로 한국어 자체를 slug 화 (hangul → roman 변환 없이 그대로, 중복만 회피).
function makeIdFromKorean(korean, seenIds) {
  // 1차 시도: korean 그대로 + url-safe 변환
  const base = korean.replace(/[\s/]+/g, '-').toLowerCase();
  let id = base;
  let counter = 2;
  while (seenIds.has(id)) {
    id = `${base}-${counter}`;
    counter += 1;
  }
  seenIds.add(id);
  return id;
}

async function main() {
  const csv = await fs.readFile(CSV_PATH, 'utf-8');
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    console.error('빈 CSV');
    process.exit(1);
  }

  const header = parseCsvLine(lines[0]);
  const adoptedIdx = header.findIndex((h) => h === 'adopted');
  const meaningIdx = header.findIndex((h) => h === 'meaning');
  const hanjaIdx = header.findIndex((h) => h === 'hanja');

  if (adoptedIdx < 0 || meaningIdx < 0) {
    console.error('header 에 adopted / meaning 필요');
    process.exit(1);
  }

  const seenIds = new Set();
  const entries = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const korean = cells[adoptedIdx]?.trim();
    const meaning = cells[meaningIdx]?.trim();
    const hanja = hanjaIdx >= 0 ? cells[hanjaIdx]?.trim() : undefined;
    if (!korean || !meaning) continue;

    const id = makeIdFromKorean(korean, seenIds);

    entries.push({
      id,
      korean,
      korean_variants: [korean],         // 추후 curator 가 ['공','공성','공함'] 같은 변형 추가
      hanja: hanja || undefined,
      // sanskrit / sanskrit_devanagari / pronunciation_ko / etymology — 추후 LLM+curation
      explanation: meaning,              // 현 meaning 텍스트가 1차 explanation
      type: 'concept',                   // 안전 default — 추후 분류
      density_policy: 'always',          // 현 동작 보존
      confidence: 0.3,                   // 1차 마이그 — 사람 검증 X
      updated_at: new Date().toISOString(),
    });
  }

  const dict = {
    version: '1.0.0',
    generated_at: new Date().toISOString(),
    entries,
  };

  await fs.writeFile(OUT_PATH, JSON.stringify(dict, null, 2), 'utf-8');

  console.log(`✅ ${entries.length} entries → ${OUT_PATH}`);
  console.log('\n분포:');
  console.log(`  type=concept:     ${entries.length} (전부 default — 추후 분류 필요)`);
  console.log(`  density=always:   ${entries.length} (전부 default)`);
  const withHanja = entries.filter((e) => e.hanja).length;
  console.log(`  with hanja:       ${withHanja}/${entries.length}`);
  console.log('\n다음 단계:');
  console.log('  1. proper_noun/place 후보 수동 분류 (수보리, 사위국 등)');
  console.log('  2. korean_variants 보강 (공/공성/공함 같은 변형)');
  console.log('  3. Sanskrit/어원/풍부한 설명 LLM 1차 + curation');
}

await main();
