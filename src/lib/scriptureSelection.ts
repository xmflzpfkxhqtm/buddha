// scripture reader 의 native text selection 분석 / character offset 계산.
// 각 sentence span 은 `data-index="<globalIndex>"` 속성을 가진다는 가정.

export type SelectionRange = {
  startSentence: number;
  startOffset: number;       // start sentence 안 절대 character offset
  endSentence: number;
  endOffset: number;         // end sentence 안 절대 character offset
  startSentenceText: string;
  endSentenceText: string;
};

/** 임의의 DOM Node 에서 가장 가까운 [data-index] sentence element 찾기 */
function findSentenceEl(node: Node | null): HTMLElement | null {
  let cur: Node | null = node;
  while (cur) {
    if (cur.nodeType === 1) {
      const el = cur as HTMLElement;
      if (el.dataset?.index !== undefined) return el;
    }
    cur = cur.parentNode;
  }
  return null;
}

/**
 * sentenceEl 안에서 (node, offsetInNode) 위치의 절대 character offset.
 * inline term 등으로 sentence 안에 여러 text node 가 split 된 경우에도 정확.
 */
function getAbsoluteOffsetWithin(rootEl: HTMLElement, node: Node, offsetInNode: number): number {
  // node 자체가 sentence element 면 — element 시작 위치 (자식 element 기준 offset 처리)
  if (node === rootEl) {
    if (offsetInNode === 0) return 0;
    // offsetInNode = child node index. 그 child 까지의 모든 text 길이 합.
    let total = 0;
    for (let i = 0; i < offsetInNode && i < node.childNodes.length; i++) {
      total += node.childNodes[i].textContent?.length ?? 0;
    }
    return total;
  }
  let total = 0;
  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const tn = walker.currentNode;
    if (tn === node) return total + offsetInNode;
    total += tn.textContent?.length ?? 0;
  }
  return total; // 못 찾으면 끝
}

/**
 * 현재 window selection 을 분석해서 SelectionRange 반환.
 * - selection 이 collapsed / 없음 / sentence boundary 밖 → null
 * - 역방향 selection 자동 swap
 */
export function getSelectionRange(containerEl: HTMLElement | null): SelectionRange | null {
  if (typeof window === 'undefined') return null;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);

  // selection 이 본문 컨테이너 안에 있는지 확인
  if (containerEl && !containerEl.contains(range.commonAncestorContainer)) return null;

  const startEl = findSentenceEl(range.startContainer);
  const endEl = findSentenceEl(range.endContainer);
  if (!startEl || !endEl) return null;

  const sIdx = parseInt(startEl.dataset.index ?? '', 10);
  const eIdx = parseInt(endEl.dataset.index ?? '', 10);
  if (!Number.isFinite(sIdx) || !Number.isFinite(eIdx)) return null;

  const sOff = getAbsoluteOffsetWithin(startEl, range.startContainer, range.startOffset);
  const eOff = getAbsoluteOffsetWithin(endEl, range.endContainer, range.endOffset);

  // 역방향 swap (start 가 end 보다 뒤이면)
  let startSentence = sIdx;
  let endSentence = eIdx;
  let startOffset = sOff;
  let endOffset = eOff;
  let startSentenceText = startEl.textContent ?? '';
  let endSentenceText = endEl.textContent ?? '';
  const isReversed =
    sIdx > eIdx || (sIdx === eIdx && sOff > eOff);
  if (isReversed) {
    startSentence = eIdx;
    endSentence = sIdx;
    startOffset = eOff;
    endOffset = sOff;
    startSentenceText = endEl.textContent ?? '';
    endSentenceText = startEl.textContent ?? '';
  }

  // 같은 sentence 안에서 collapsed 처럼 (start === end) 이면 무효
  if (startSentence === endSentence && startOffset === endOffset) return null;

  return {
    startSentence,
    startOffset,
    endSentence,
    endOffset,
    startSentenceText,
    endSentenceText,
  };
}

/** selection bounding rect — popover 위치 계산용 */
export function getSelectionRect(): DOMRect | null {
  if (typeof window === 'undefined') return null;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  return sel.getRangeAt(0).getBoundingClientRect();
}

/** browser selection 해제 */
export function clearBrowserSelection(): void {
  if (typeof window === 'undefined') return;
  window.getSelection()?.removeAllRanges();
}

// ============================================================================
// 시각 렌더링용 — 각 sentence 안의 highlight character ranges 계산
// ============================================================================

export type StoredHighlight = {
  id: string;
  start_sentence: number;
  end_sentence: number;
  start_char_offset: number | null;     // null = 옛 형식 (sentence 전체)
  end_char_offset: number | null;
  memo: string | null;
  highlight_text: string | null;        // 사용자가 정확히 선택한 텍스트 (preview / 묻기 인용)
};

export type SentenceHighlightPiece = {
  id: string;
  start: number;
  end: number;
  hasMemo: boolean;
};

export type StoredHighlight2 = StoredHighlight; // alias 유지용 (외부 import 호환)

/**
 * highlights → sentence index → 그 sentence 안 character ranges 목록.
 * NULL offset (옛 형식) 은 sentence 전체로 간주.
 * memo 가 비어있지 않으면 hasMemo = true.
 */
export function buildSentenceHighlightMap(
  highlights: StoredHighlight[],
  sentenceLengthOf: (idx: number) => number,
): Map<number, SentenceHighlightPiece[]> {
  const map = new Map<number, SentenceHighlightPiece[]>();
  for (const h of highlights) {
    const hasMemo = !!(h.memo && h.memo.trim());
    for (let i = h.start_sentence; i <= h.end_sentence; i++) {
      const len = sentenceLengthOf(i);
      const isLegacy = h.start_char_offset === null || h.end_char_offset === null;
      let start = 0;
      let end = len;
      if (!isLegacy) {
        if (i === h.start_sentence) start = h.start_char_offset!;
        if (i === h.end_sentence) end = h.end_char_offset!;
      }
      if (end > start) {
        const list = map.get(i) ?? [];
        list.push({ id: h.id, start, end, hasMemo });
        map.set(i, list);
      }
    }
  }
  return map;
}

/**
 * 한 sentence 의 piece 들을 character offset 기반 disjoint segment 로 분해.
 * Overlap 처리: 두 piece 가 겹치는 영역은 highlightIds 에 둘 다 포함.
 *
 * 예: text "abcdefgh", piece1 [0,4] memo, piece2 [2,6] no-memo
 *   → segments: [0,2 ids=[1] memoIds=[1]], [2,4 ids=[1,2] memoIds=[1]],
 *               [4,6 ids=[2] memoIds=[]], [6,8 ids=[]]
 */
export type RenderSegment = {
  start: number;
  end: number;
  highlightIds: string[];   // 이 segment 위에 활성 highlight ids
  memoIds: string[];        // memoIds.length > 0 이면 underline + popup
};

export function buildRenderSegments(
  pieces: SentenceHighlightPiece[],
  textLen: number,
): RenderSegment[] {
  if (textLen === 0) return [];
  if (pieces.length === 0) {
    return [{ start: 0, end: textLen, highlightIds: [], memoIds: [] }];
  }

  const offsets = new Set<number>([0, textLen]);
  for (const p of pieces) {
    if (p.start >= 0 && p.start <= textLen) offsets.add(p.start);
    if (p.end >= 0 && p.end <= textLen) offsets.add(p.end);
  }
  const sorted = [...offsets].sort((a, b) => a - b);

  const segments: RenderSegment[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const s = sorted[i];
    const e = sorted[i + 1];
    if (s === e) continue;
    const active = pieces.filter((p) => p.start < e && p.end > s);
    segments.push({
      start: s,
      end: e,
      highlightIds: active.map((p) => p.id),
      memoIds: active.filter((p) => p.hasMemo).map((p) => p.id),
    });
  }
  return segments;
}
