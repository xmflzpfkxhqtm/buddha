// src/lib/scriptureCache.ts
// scripture 페이지들이 공유하는 client-side in-memory 캐시.
// 페이지 unmount/remount 사이에 데이터를 보존해 두 번째 진입부터 즉시 렌더.
// 페이지 reload 시 초기화 (24h CDN cache 가 backend cold start 비용 흡수).
// 모듈 스코프 + 'use client' 컴포넌트에서만 import → 브라우저 탭 단위로 격리.

export type ScriptureGroupSummary = {
  group_key: string;
  display_name: string | null;
  chinese_title: string | null;
  translator: string | null;
  intro: string | null;
  school_tags: string[] | null;
  topic_tags: string[] | null;
  is_featured: boolean | null;
  volume_total: number | null;
  k_code: string | null;
};

export type ScriptureVolumeRow = {
  title: string;
  volume_no: number | null;
  filename: string | null;
};

export type ScriptureGroupsResponse = {
  featured: ScriptureGroupSummary[];
  topics: { tag: string; groups: ScriptureGroupSummary[] }[];
};

export type ScriptureGroupDetailResponse = {
  group: ScriptureGroupSummary;
  volumes: ScriptureVolumeRow[];
};

export type ScriptureTopicResponse = {
  tag: string;
  groups: ScriptureGroupSummary[];
};

// Concept dictionary cache — 정적 (배포 사이 안 바뀜), 한 번 받아 메모리.
import type { ConceptDictionary } from './concepts';
export type { ConceptDictionary };

// 개인화 추천 응답 (Phase 1 — docs/recommendations.md 참고)
export type RecommendReason =
  | { kind: 'similar'; anchor_group: string }
  | { kind: 'topic'; anchor_tag: string }
  | { kind: 'explore'; anchor_tag: string };

export type RecommendItem = {
  group_key: string;
  display_name: string | null;
  chinese_title: string | null;
  school_tags: string[] | null;
  topic_tags: string[] | null;
  is_featured: boolean | null;
  volume_total: number | null;
  k_code: string | null;
  reason: RecommendReason;
};

// items=[] = cold-start 또는 후보 없음 (재요청 방지용으로 빈 배열도 cache)
export type RecommendCache = { userId: string; items: RecommendItem[] };

export const scriptureCache = {
  groups: null as ScriptureGroupsResponse | null,
  titles: null as string[] | null,
  glossary: null as Record<string, string> | null,
  groupByKey: new Map<string, ScriptureGroupDetailResponse>(),
  topicByTag: new Map<string, ScriptureTopicResponse>(),
  contentByTitle: new Map<string, string>(),
  recommendations: null as RecommendCache | null,
  conceptsDict: null as ConceptDictionary | null,
};

// ============================================================================
// 추천 결과 localStorage persist — 페이지 reload / 앱 재시작 사이 cache 유지.
// 모듈 스코프 cache (위 객체) 가 reset 되는 reload 직후, mount 시점에 hydrate 됨.
// background refresh 패턴: cache 즉시 렌더 + 백그라운드 fetch 로 silent 업데이트.
// ============================================================================
const RECS_LS_KEY = 'scripture-recommendations-v1';

export function hydrateRecommendationsFromLS(): RecommendCache | null {
  if (typeof window === 'undefined') return null;
  if (scriptureCache.recommendations) return scriptureCache.recommendations;
  try {
    const raw = window.localStorage.getItem(RECS_LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.userId !== 'string' || !Array.isArray(parsed?.items)) return null;
    scriptureCache.recommendations = parsed as RecommendCache;
    return scriptureCache.recommendations;
  } catch {
    return null;
  }
}

export function persistRecommendationsToLS(cache: RecommendCache): void {
  if (typeof window === 'undefined') return;
  scriptureCache.recommendations = cache;
  try {
    window.localStorage.setItem(RECS_LS_KEY, JSON.stringify(cache));
  } catch {
    // quota / private mode 등 — 무시 (모듈 캐시는 이미 set 됨)
  }
}
