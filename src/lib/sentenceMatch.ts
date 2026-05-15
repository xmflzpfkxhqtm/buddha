// 문장 유사도 매칭 — 본문 신역 등으로 hardcoded index 가 drift 된 경우,
// anchor sentence text 와 가장 가까운 현재 본문 sentence 의 index 를 찾는다.
// 문자 bigram Jaccard 기준 — 한국어 paraphrase 에서 character-level overlap 이
// token-level 보다 안정적 (어미·조사 변화 흡수).

function bigrams(s: string): Set<string> {
  const out = new Set<string>();
  const clean = s.replace(/\s+/g, '');
  for (let i = 0; i <= clean.length - 2; i++) {
    out.add(clean.slice(i, i + 2));
  }
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/**
 * 후보 sentence 배열에서 target 과 character bigram Jaccard 유사도 최고인 index 반환.
 * 모든 후보가 너무 짧거나 target 이 비었으면 -1.
 */
export function findBestMatchIndex(target: string, candidates: string[]): number {
  const t = target?.trim();
  if (!t || candidates.length === 0) return -1;
  const tgrams = bigrams(t);
  if (tgrams.size === 0) return -1;
  let best = -1;
  let bestScore = -1;
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (!c || c.length < 4) continue;
    const score = jaccard(tgrams, bigrams(c));
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}
