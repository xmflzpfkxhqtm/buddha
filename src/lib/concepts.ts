// src/lib/concepts.ts
// 경전 개념 entry 타입 — Sanskrit-grounded concept system (docs/concepts-system.md 예정).
// dictionary/concepts.json 이 진실 source. 빌드/배포 시 DB sync 는 추후.

export type ConceptType =
  | 'concept'      // 추상 개념 (공, 보살, 반야, 무아 등) — 항상 마크 가능
  | 'proper_noun'  // 인물·존재 (수보리, 아난, 비사문 등) — 권당 첫 등장만
  | 'place'        // 장소 (사위국, 기수급고독원, 영축산 등) — 그룹당 첫 등장만
  | 'sutra_name'   // 경전명 (반야심경, 화엄경 등) — 그룹당 첫 등장만
  | 'practice'     // 수행법 (좌선, 염불, 다라니 등) — 항상 마크
  | 'other';

export type DensityPolicy =
  | 'always'              // 매 occurrence 마다 마크
  | 'first_per_volume'    // 한 권(title) 안에서 첫 등장만
  | 'first_per_scripture' // 한 그룹(group_key) 안에서 첫 등장만
  | 'never';              // 마크 안 함 (entry 는 있되 inline 강조 X)

export type ConceptEntry = {
  id: string;                   // canonical, kebab-case (예: 'sunyata', 'subhuti')
  korean: string;               // '공' — 대표 표기
  korean_variants: string[];    // ['공', '공성', '공함']  — 본문 lookup 키
  hanja?: string;               // '空'
  hanja_variants?: string[];
  sanskrit?: string;            // 'śūnyatā' (IAST)
  sanskrit_devanagari?: string; // 'शून्यता'
  pali?: string;
  pronunciation_ko?: string;    // '슈냐타' — 한글 발음 가이드
  etymology?: string;           // 'śūnya (비어 있음) + -tā (-성)' — 어원 분석
  explanation: string;          // 현대어 설명 (산스크리트 어원 기반)
  type: ConceptType;
  density_policy: DensityPolicy;
  related?: string[];           // 관련 concept id 들
  references?: { title: string; sentence?: string }[];
  confidence?: number;          // 0~1 — curator 검토 신뢰도. 1=human-verified
  updated_at?: string;          // ISO 8601
};

export type ConceptDictionary = {
  version: string;              // semver — schema 변경 시 bump
  generated_at: string;
  entries: ConceptEntry[];
};

// ============================================================================
// Lookup index — surface form (variants 포함) → entry
// ============================================================================
export type LookupIndex = Map<string, ConceptEntry>;

export function buildLookupIndex(dict: ConceptDictionary): LookupIndex {
  const index: LookupIndex = new Map();
  for (const entry of dict.entries) {
    index.set(entry.korean, entry);
    for (const v of entry.korean_variants ?? []) {
      // 이미 다른 entry 에 등록된 surface 가 있으면 첫 entry 우선 (충돌 회피)
      if (!index.has(v)) index.set(v, entry);
    }
  }
  return index;
}

// ============================================================================
// Density 판정 — 렌더 시점에 한 occurrence 가 *시각적으로 마크되어야 하는지*.
// 호출자가 occurrence 누적 상태 (Set) 를 유지.
// ============================================================================
export type DensityState = {
  // 권(title) 단위 누적 — first_per_volume 판정용
  perVolume: Set<string>;
  // 그룹(group_key) 단위 누적 — first_per_scripture / sutra_name / place 판정용
  perScripture: Set<string>;
};

export function makeDensityState(): DensityState {
  return { perVolume: new Set(), perScripture: new Set() };
}

/**
 * 한 occurrence 를 처리한 뒤 *마크해야 하는지* 반환.
 * 부수효과: 마크 결정 시 누적 set 에 entry.id 등록.
 */
export function shouldMark(entry: ConceptEntry, state: DensityState): boolean {
  switch (entry.density_policy) {
    case 'always':
      return true;
    case 'never':
      return false;
    case 'first_per_volume': {
      if (state.perVolume.has(entry.id)) return false;
      state.perVolume.add(entry.id);
      return true;
    }
    case 'first_per_scripture': {
      if (state.perScripture.has(entry.id)) return false;
      state.perScripture.add(entry.id);
      return true;
    }
    default:
      return true;
  }
}
