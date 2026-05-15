// src/app/(app)/scripture/[group]/[volume]/page.tsx
// Layer 3 (Reader) — 미니멀 nav + 플로팅 TTS.
// 옛 /scripture/page.tsx 는 그대로 두고 이 파일에서 helpers 를 인라인 복제 (단일 서버 운영 안전 전략).

'use client';
import { ReactNode, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { useHighlightStore } from '@/stores/useHighlightStore';
import { useChromeStore } from '@/stores/useChromeStore';
import { useReaderSettingsStore } from '@/stores/useReaderSettingsStore';
import AskHighlightModal, { type AskCitation as AskModalCitation } from '../../../../../../components/AskHighlightModal';
import ConceptSheet from '../../../../../../components/ConceptSheet';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';
import { supabase } from '@/lib/supabaseClient';
import { Capacitor } from '@capacitor/core';
import { ChevronLeft, Search, Trash2, MessageSquarePlus, MessageCircleQuestion } from 'lucide-react';
import ScriptureModal from '../../../../../../components/ScriptureModal';
import HighlightSheet, { type HighlightSheetTarget } from '../../../../../../components/HighlightSheet';
import FloatingActionBar from '../../../../../../components/FloatingActionBar';
import { scriptureCache, type ScriptureGroupDetailResponse } from '@/lib/scriptureCache';
import { titleToReaderPath } from '@/lib/scripturePath';
import {
  getSelectionRange,
  getSelectionRect,
  clearBrowserSelection,
  buildSentenceHighlightMap,
  buildRenderSegments,
  type StoredHighlight,
  type SelectionRange,
  type SentenceHighlightPiece,
} from '@/lib/scriptureSelection';
import {
  parseMarkdownToBlocks,
  type MarkdownBlock,
} from '@/lib/scriptureContent';
import {
  buildLookupIndex,
  makeDensityState,
  shouldMark,
  type ConceptDictionary,
  type ConceptEntry,
  type DensityState,
  type LookupIndex,
} from '@/lib/concepts';

const WebTTSPlayer = dynamic(() => import('../../../../../../components/WebTTSPlayer'), { ssr: false });
const NativeTTSPlayer = dynamic(() => import('../../../../../../components/NativeTTSPlayer'), { ssr: false });

// ============================================================
// 타입
// ============================================================

interface GlobalSearchResult {
  title: string;
  index: number;
  text: string;
}

// MarkdownBlock, ReadUnit 은 src/lib/scriptureContent 에서 import (위 import 절).

type GroupMeta = {
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

type VolumeRow = {
  title: string;
  volume_no: number | null;
  filename: string | null;
};

// 마크다운/문장 파서는 src/lib/scriptureContent.ts 로 추출 (resolve API 와 공유).

// ============================================================
// 문자열 유틸 (옛 page.tsx 와 동일)
// ============================================================

const getChosung = (char: string): string => {
  const code = char.charCodeAt(0) - 44032;
  if (code < 0 || code > 11171) return char;
  const baseConsonants = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  const labels: Record<string, string> = {'ㄱ':'가','ㄴ':'나','ㄷ':'다','ㄹ':'라','ㅁ':'마','ㅂ':'바','ㅅ':'사','ㅇ':'아','ㅈ':'자','ㅊ':'차','ㅋ':'카','ㅌ':'타','ㅍ':'파','ㅎ':'하'};
  const cho = baseConsonants[Math.floor(code / 588)];
  return labels[cho] || char;
};

const resolveActualTitle = (title: string, list: string[]): string | null => {
  if (list.includes(title)) return title;
  if (title.endsWith('_GPT4.1번역')) {
    const fallback = title.replace('_GPT4.1번역', '_1권_GPT4.1번역');
    if (list.includes(fallback)) return fallback;
  }
  const candidate = list.find((t) => t.startsWith(title));
  return candidate || null;
};

function formatDisplayTitle(rawTitle: string): string {
  if (!rawTitle) return '';
  return rawTitle.replace(/_GPT\d+(\.\d+)?번역/, '').replace(/_/g, ' ');
}

function getScriptureGroupBase(title: string): string {
  const m = title.match(/_K\d{4}(?:_|$)/u);
  if (m && m.index !== undefined) {
    return title.slice(0, m.index + 6);
  }
  return title.split('_')[0];
}

// 읽음 상태 — Layer 2 에서 읽고, Layer 3 에서 기록.
const READ_STATE_PREFIX = 'scripture-read:';
const LAST_VOLUME_PREFIX = 'scripture-last:';
// Layer 1 "이어 읽기" 용 — 전체 중 가장 최근 본 (그룹, 권).
const LAST_GLOBAL_KEY = 'scripture-last-global';

function setReadStateIfHigher(groupKey: string, volumeNo: number, next: 'reading' | 'read') {
  if (typeof window === 'undefined') return;
  if (!groupKey || !Number.isFinite(volumeNo)) return;
  try {
    const key = `${READ_STATE_PREFIX}${groupKey}:${volumeNo}`;
    const prev = window.localStorage.getItem(key);
    // 'read' 는 절대 downgrade 하지 않음
    if (prev === 'read') return;
    window.localStorage.setItem(key, next);
  } catch {
    /* localStorage 미가용/쿼터 초과 무시 */
  }
}

// "이어 읽기" 용 — 마지막 진입 권 (Layer 2 가 읽음)
function setLastVolume(groupKey: string, volumeNo: number) {
  if (typeof window === 'undefined') return;
  if (!groupKey || !Number.isFinite(volumeNo)) return;
  try {
    window.localStorage.setItem(`${LAST_VOLUME_PREFIX}${groupKey}`, String(volumeNo));
  } catch {
    /* noop */
  }
}

// Layer 1 "이어 읽기" 카드용 — 전체 중 가장 최근 본 위치 1개.
function setLastGlobal(groupKey: string, volumeNo: number) {
  if (typeof window === 'undefined') return;
  if (!groupKey || !Number.isFinite(volumeNo)) return;
  try {
    window.localStorage.setItem(
      LAST_GLOBAL_KEY,
      JSON.stringify({ groupKey, volumeNo, viewedAt: Date.now() }),
    );
  } catch {
    /* noop */
  }
}

// ============================================================
// 페이지 본체
// ============================================================

export default function ScriptureReaderPage() {
  const router = useRouter();
  const params = useParams<{ group: string; volume: string }>();
  const groupKeyParam = params?.group ?? '';
  const volumeParam = params?.volume ?? '';
  const groupKey = useMemo(() => {
    try {
      return decodeURIComponent(groupKeyParam).normalize('NFC');
    } catch {
      return groupKeyParam;
    }
  }, [groupKeyParam]);
  const volumeNo = useMemo(() => {
    const n = parseInt(volumeParam, 10);
    return Number.isFinite(n) ? n : NaN;
  }, [volumeParam]);

  // 상태
  const [groupMeta, setGroupMeta] = useState<GroupMeta | null>(null);
  const [volumes, setVolumes] = useState<VolumeRow[]>([]);
  const [resolvedTitle, setResolvedTitle] = useState('');
  const [isTTSSpeaking, setIsTTSSpeaking] = useState(false);
  const [contentBlocks, setContentBlocks] = useState<MarkdownBlock[]>([]);
  const [displaySentences, setDisplaySentences] = useState<string[]>([]);
  const [ttsSentences, setTtsSentences] = useState<string[]>([]);
  // 화면 렌더링되는 sentence 의 원본 text (괄호 포함) — highlight character offset 기준.
  // ttsSentences 는 괄호 제거된 짧은 text 라 length 가 화면과 다름.
  const [displayTexts, setDisplayTexts] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  // 본문 highlight 들 (character 단위 range)
  const [highlights, setHighlights] = useState<StoredHighlight[]>([]);
  // 본문에 시각화 못 한 (orphaned) highlight 개수 — footer 노출용.
  const [orphanCount, setOrphanCount] = useState(0);
  // 현재 native selection 상태 — FloatingActionBar 표시용
  const [selection, setSelection] = useState<SelectionRange | null>(null);
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  // sheet target — selection range + 기존 highlight (메모 모드)
  const [sheetTarget, setSheetTarget] = useState<HighlightSheetTarget | null>(null);
  // 본문 컨테이너 ref — selection 이 본문 안인지 검증용
  const contentRef = useRef<HTMLDivElement>(null);
  // selection clear 후 발생하는 selectionchange 1회 무시 — native action menu 차단용
  // (WebView 의 Copy/공유 popover 는 live selection 에 묶여 있어 selection 을 비우면 사라짐.
  //  단, 그 비움 행위가 selectionchange 를 트리거 → FAB 가 같이 dismiss 되는 걸 막아야 함.)
  const ignoreNextSelectionChangeRef = useRef(false);
  // highlight 클릭 시 떠 있는 액션 popup (X 제거 + 메모, 메모 있으면 본문 미리보기)
  const [highlightPopup, setHighlightPopup] = useState<{
    highlightId: string;
    memo: string | null;
    rect: DOMRect;
  } | null>(null);
  // 메모 있는 highlight 삭제 시 confirmation modal
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // 모든 full-screen modal/sheet 동안 body 스크롤 잠금 (뒷 본문 스크롤 방지)
  // sheetTarget / askModalOpen 은 각 컴포넌트 내부에서 자체 lock. 여기는 reader 자체 modal 들.
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [modalTab, setModalTab] = useState<'title' | 'content' | 'global'>('title');
  const [globalResults, setGlobalResults] = useState<GlobalSearchResult[]>([]);
  const [fontSize, setFontSize] = useState<'base' | 'lg' | 'xl'>('lg');
  const fontSizeClass = { base: 'text-base', lg: 'text-lg', xl: 'text-xl' }[fontSize];
  const [userId, setUserId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [showMessage, setShowMessage] = useState(false);
  const [bookmarkPending, setBookmarkPending] = useState<{ title: string; index: number } | null>(null);
  const [initialFilter, setInitialFilter] = useState('전체');
  const sentenceRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [list, setList] = useState<string[]>([]);
  const [groupedTitles, setGroupedTitles] = useState<Record<string, string[]>>({});
  const [expandedBase, setExpandedBase] = useState<string | null>(null);
  // 신규 concepts dictionary (Phase 6B). 이전 glossaryMap 대체.
  // null = 아직 로드 안 됨, 빈 dict = 로드됐으나 entry 없음
  const [conceptsDict, setConceptsDict] = useState<ConceptDictionary | null>(
    () => scriptureCache.conceptsDict,
  );
  const conceptsIndex: LookupIndex = useMemo(
    () => (conceptsDict ? buildLookupIndex(conceptsDict) : new Map()),
    [conceptsDict],
  );
  // termPopup 에 ConceptEntry 전체 보관 (Phase 6D 풍부한 sheet 에 사용)
  const [termPopup, setTermPopup] = useState<{ surface: string; entry: ConceptEntry | null } | null>(null);
  // body 스크롤 잠금 — 어떤 full-screen modal 이라도 열려있으면 뒷 본문 스크롤 방지
  useBodyScrollLock(!!termPopup || !!confirmDeleteId || showMessage);
  const [platformInfo, setPlatformInfo] = useState<{ platform: string | null; isNative: boolean }>({ platform: null, isNative: false });
  const [chromeVisible, setChromeVisible] = useState(true);
  const lastScrollY = useRef(0);

  const { title: pendingTitle, index: pendingIndex, clearHighlight: clearBookmark } = useHighlightStore();

  const clampIndex = useCallback(
    (idx: number) => {
      if (ttsSentences.length === 0) return 0;
      return Math.min(Math.max(idx, 0), ttsSentences.length - 1);
    },
    [ttsSentences.length],
  );

  const smoothCenter = useCallback((idx: number, instant = false) => {
    sentenceRefs.current[idx]?.scrollIntoView({
      block: 'center',
      inline: 'nearest',
      behavior: instant ? 'instant' : 'smooth',
    });
  }, []);

  // 플랫폼 감지
  useEffect(() => {
    const currentPlatform = Capacitor.getPlatform();
    setPlatformInfo({ platform: currentPlatform, isNative: currentPlatform !== 'web' });
  }, []);

  // 사용자
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.id) setUserId(data.user.id);
    });
  }, []);

  // Concepts dictionary (Phase 6B) — 정적 데이터, cache hit 시 즉시.
  // 기존 /api/glossary 는 동결 (Capacitor 옛 캐시 호환), 이 라우트는 신규.
  useEffect(() => {
    let cancelled = false;
    if (scriptureCache.conceptsDict) {
      setConceptsDict(scriptureCache.conceptsDict);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        const res = await fetch('/api/concepts');
        if (!res.ok) return;
        const data = (await res.json()) as ConceptDictionary;
        if (cancelled) return;
        scriptureCache.conceptsDict = data;
        setConceptsDict(data);
      } catch (e) {
        console.warn('concepts 로딩 실패', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 모달용 title list — cache hit 시 즉시
  useEffect(() => {
    let cancelled = false;
    const applyTitles = (titles: string[]) => {
      if (cancelled) return;
      setList(titles);
      const map: Record<string, string[]> = {};
      titles.forEach((t) => {
        const base = getScriptureGroupBase(t);
        if (!map[base]) map[base] = [];
        map[base].push(t);
      });
      setGroupedTitles(map);
    };
    if (scriptureCache.titles) {
      applyTitles(scriptureCache.titles);
      return () => {
        cancelled = true;
      };
    }
    fetch('/api/scripture/list')
      .then((res) => res.json())
      .then((data) => {
        const titles: string[] = data.titles || [];
        scriptureCache.titles = titles;
        applyTitles(titles);
      })
      .catch((e) => console.warn('list 로딩 실패', e));
    return () => {
      cancelled = true;
    };
  }, []);

  const usedInitials = useMemo(() => {
    const set = new Set<string>();
    Object.keys(groupedTitles).forEach((base) => {
      set.add(getChosung(base.charAt(0)));
    });
    return set;
  }, [groupedTitles]);

  // 그룹 + 권 리스트 → resolvedTitle. cache hit 시 즉시 (Layer 2 진입 후 Layer 3 로 가면 항상 hit)
  useEffect(() => {
    if (!groupKey || !Number.isFinite(volumeNo)) return;
    let cancelled = false;

    const apply = (data: ScriptureGroupDetailResponse) => {
      if (cancelled) return;
      setGroupMeta(data.group ?? null);
      const vols = data.volumes ?? [];
      setVolumes(vols);
      const matched = vols.find((v) => v.volume_no === volumeNo);
      if (matched) {
        setResolvedTitle(matched.title);
      } else {
        setResolvedTitle('');
        setContentBlocks([]);
        setDisplaySentences(['해당 권을 찾을 수 없습니다.']);
        setTtsSentences([]);
      }
    };

    const cached = scriptureCache.groupByKey.get(groupKey);
    if (cached) {
      apply(cached);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const res = await fetch(`/api/scripture/group/${encodeURIComponent(groupKey)}`);
        if (!res.ok) {
          if (!cancelled) {
            setContentBlocks([]);
            setDisplaySentences(['해당 그룹을 찾을 수 없습니다.']);
            setTtsSentences([]);
          }
          return;
        }
        const data: ScriptureGroupDetailResponse = await res.json();
        scriptureCache.groupByKey.set(groupKey, data);
        apply(data);
      } catch (e) {
        console.warn('group 로딩 실패', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupKey, volumeNo]);

  // resolvedTitle 바뀔 때 본문 로드 — content cache hit 시 즉시
  useEffect(() => {
    if (!resolvedTitle) return;
    let cancelled = false;

    const apply = (content: string) => {
      if (cancelled) return;
      const { blocks, flatSentences, flatReadUnits } = parseMarkdownToBlocks(content);
      setContentBlocks(blocks);
      setDisplaySentences(flatSentences);
      const tts = flatReadUnits.map((u) => u.text.replace(/\([^)]*\)/g, ''));
      setTtsSentences(tts);
      // displayTexts — 화면 렌더링되는 원본 text. highlight char offset 계산 기준.
      setDisplayTexts(flatReadUnits.map((u) => u.text));
      sentenceRefs.current = Array(flatReadUnits.length).fill(null);
    };

    setCurrentIndex(0);
    window.scrollTo({ top: 0, behavior: 'instant' });
    setHighlights([]);

    const cached = scriptureCache.contentByTitle.get(resolvedTitle);
    if (cached) {
      apply(cached);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const res = await fetch(`/api/scripture?title=${encodeURIComponent(resolvedTitle)}`);
        const data = await res.json();
        if (cancelled) return;
        if (data?.content) {
          scriptureCache.contentByTitle.set(resolvedTitle, data.content);
          apply(data.content);
        } else {
          // 본문 없음 — pending 책갈피가 살아있으면 cascade 방지 위해 clear.
          setDisplaySentences(['해당 경전을 불러올 수 없습니다.']);
          setTtsSentences([]);
          setContentBlocks([]);
          clearBookmark();
        }
      } catch (e) {
        if (cancelled) return;
        console.warn('scripture 본문 로딩 실패', e);
        // 직전 본문이 stale 로 남아 빈 페이지처럼 보이는 것 방지 — 명시적 reset + pending clear.
        setDisplaySentences(['경전을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.']);
        setTtsSentences([]);
        setContentBlocks([]);
        clearBookmark();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolvedTitle, clearBookmark]);

  // 본문 highlight 로딩 — /api/highlights/resolve-batch 통과해서 forward-only 재앵커링 거친 결과 사용.
  // orphaned 는 본문에 시각화하지 않고 footer 카운터로만 표시 (docs/highlights-versioning.md).
  // 옛 NULL offset row 는 sentence 전체 시각화 (StoredHighlight 의 동작 그대로).
  useEffect(() => {
    if (!userId || !resolvedTitle) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/highlights/resolve-batch?user_id=${encodeURIComponent(userId)}&title=${encodeURIComponent(resolvedTitle)}`,
        );
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as {
          highlights: (StoredHighlight & { anchor_status?: string })[];
          stats: { orphaned: number };
        };
        if (cancelled) return;
        const all = json.highlights ?? [];
        const renderable = all.filter((h) => h.anchor_status !== 'orphaned');
        const orphans = (json.stats?.orphaned ?? all.length - renderable.length) || 0;
        setHighlights(renderable as StoredHighlight[]);
        setOrphanCount(orphans);
      } catch {
        // 실패 시 highlight 없이 본문만 렌더 (degraded). reader 핵심 기능 영향 없음.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, resolvedTitle]);

  // 외부에서 들어온 bookmarkPending — title 일치 시에만 처리.
  // resolvedTitle 이 아직 비어있으면 group fetch 진행 중이므로 판정 보류.
  // resolvedTitle 채워진 후 mismatch 면 stale 로 간주하고 즉시 clear (cascade 방지).
  useEffect(() => {
    if (!pendingTitle) return;
    if (!resolvedTitle) return; // 아직 resolved 안 됨, 다음 effect run 기다림
    if (pendingTitle === resolvedTitle) {
      setBookmarkPending({ title: pendingTitle, index: pendingIndex ?? 0 });
    } else {
      clearBookmark();
    }
  }, [pendingTitle, pendingIndex, resolvedTitle, clearBookmark]);

  // bookmarkPending 처리 (본문 로딩 완료 후) — sentenceRefs 가 attach 될 때까지 polling.
  // 첫 setTimeout 은 본문 로드의 setCurrentIndex(0) + scrollTo top race 를 우회 (그게 먼저 발화).
  useEffect(() => {
    if (
      !bookmarkPending ||
      resolvedTitle !== bookmarkPending.title ||
      ttsSentences.length === 0
    ) return;

    let cancelled = false;
    let attempt = 0;
    const maxAttempts = 30; // 약 1.5 초 한도 (50ms × 30)

    const tryScroll = () => {
      if (cancelled) return;
      const clamped = clampIndex(bookmarkPending.index);
      const ref = sentenceRefs.current[clamped];
      if (!ref) {
        if (attempt++ < maxAttempts) {
          setTimeout(tryScroll, 50);
        }
        return;
      }
      setCurrentIndex(clamped);
      smoothCenter(clamped, true);
      clearBookmark();
      setBookmarkPending(null);
    };

    // 본문 로드의 scrollTo top + setCurrentIndex(0) 가 먼저 적용되도록 첫 한 frame 양보
    const t = setTimeout(tryScroll, 100);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [bookmarkPending, resolvedTitle, ttsSentences.length, clampIndex, smoothCenter, clearBookmark]);

  // 스크롤 동기화 + 끝 도달 감지로 읽음 상태 기록
  useEffect(() => {
    const onScroll = () => {
      // 끝 도달 감지 (TTS 중에도 체크): 본문 마지막 sentence 가 뷰포트 안에 들어오면 'read'
      if (groupKey && Number.isFinite(volumeNo) && sentenceRefs.current.length > 0) {
        const last = sentenceRefs.current[sentenceRefs.current.length - 1];
        if (last) {
          const rect = last.getBoundingClientRect();
          if (rect.top < window.innerHeight && rect.bottom > 0) {
            setReadStateIfHigher(groupKey, volumeNo, 'read');
          }
        }
      }

      if (isTTSSpeaking) return;
      const centerY = window.innerHeight / 2;
      let closestIndex = -1;
      let closestDistance = Infinity;
      if (!sentenceRefs.current || sentenceRefs.current.length === 0) return;
      sentenceRefs.current.forEach((el, i) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) return;
        const elementCenter = rect.top + rect.height / 2;
        const distance = Math.abs(elementCenter - centerY);
        if (distance < closestDistance) {
          closestIndex = i;
          closestDistance = distance;
        }
      });
      if (closestIndex !== -1 && closestIndex !== currentIndex) {
        // 안전장치 — sentenceRefs 인덱스가 ttsSentences 범위를 벗어나는 경우 clamp
        setCurrentIndex(Math.min(closestIndex, Math.max(0, ttsSentences.length - 1)));
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [currentIndex, isTTSSpeaking, groupKey, volumeNo, ttsSentences.length]);

  // Chrome (Top Nav + Bottom sub info bar) hide/show — scroll 방향 기반
  // 최상단: 항상 보임 / 아래로 스크롤: 숨김 / 위로 스크롤: 보임
  // modal 활성 중 (body scroll lock 의 scrollTo restore 포함) 에는 무시 — chrome 깜빡임 방지.
  useEffect(() => {
    const onScroll = () => {
      // ref 로 closure stale 회피 + listener 재등록 비용 0
      if (modalActiveRef.current) return;
      const y = window.scrollY;
      if (y <= 4) {
        setChromeVisible(true);
      } else if (y > lastScrollY.current + 5) {
        setChromeVisible(false);
      } else if (y < lastScrollY.current - 5) {
        setChromeVisible(true);
      }
      lastScrollY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // modal 활성 ref — onScroll handler 가 stale closure 회피하면서 가드 사용.
  // 실제 set 은 askModalOpen 선언 이후 useEffect 에서 (TS hoisting 회피).
  const modalActiveRef = useRef(false);

  // 본문 로딩 직후 'reading' 상태 + last volume 기록 (이미 'read' 면 read 유지)
  useEffect(() => {
    if (!groupKey || !Number.isFinite(volumeNo)) return;
    if (ttsSentences.length === 0) return;
    setReadStateIfHigher(groupKey, volumeNo, 'reading');
    setLastVolume(groupKey, volumeNo);
    setLastGlobal(groupKey, volumeNo);
  }, [groupKey, volumeNo, ttsSentences.length]);

  // 모달 탭 전환 시 검색어 초기화
  useEffect(() => {
    setSearch('');
  }, [modalTab]);

  useEffect(() => {
    if (modalTab !== 'global' && isSearching) {
      setIsSearching(false);
    }
  }, [modalTab, isSearching]);

  // ──────── 시각 char-split 렌더링 helper ────────
  const sentenceHighlightMap = useMemo(
    () => buildSentenceHighlightMap(highlights, (idx) => displayTexts[idx]?.length ?? 0),
    [highlights, displayTexts],
  );

  const showHighlightPopup = (highlightId: string, anchor: HTMLElement) => {
    const h = highlights.find((x) => x.id === highlightId);
    if (!h) return;
    setHighlightPopup({
      highlightId,
      memo: h.memo ?? null,
      rect: anchor.getBoundingClientRect(),
    });
  };

  const renderSentenceWithHighlights = (
    text: string,
    pieces: SentenceHighlightPiece[],
    renderInline: (s: string) => ReactNode,
  ): ReactNode => {
    if (!text) return null;
    const segments = buildRenderSegments(pieces, text.length);
    return (
      <>
        {segments.map((seg, i) => {
          const slice = text.slice(seg.start, seg.end);
          if (seg.highlightIds.length === 0) {
            return <span key={i}>{renderInline(slice)}</span>;
          }
          const hasMemo = seg.memoIds.length > 0;
          // overlap 시 우선순위: 메모 있는 highlight (있으면) > 첫 highlight
          const popupId = seg.memoIds[0] ?? seg.highlightIds[0];
          return (
            <mark
              key={i}
              data-highlight-ids={seg.highlightIds.join(',')}
              onClick={(e) => {
                e.stopPropagation();
                showHighlightPopup(popupId, e.currentTarget);
              }}
              className={`rounded-sm px-px cursor-pointer ${
                hasMemo ? 'underline decoration-1 underline-offset-2' : ''
              }`}
              style={{
                backgroundColor: 'var(--user-highlight)',
                color: 'inherit',
                textDecorationColor: hasMemo ? 'var(--user-highlight-line)' : undefined,
              }}
            >
              {renderInline(slice)}
            </mark>
          );
        })}
      </>
    );
  };

  // ──────── selection → sheet target 변환 ────────
  // previewText 는 trim — block-level sentence 사이 newline 이 selection 에 포함되어
  // 인용 박스 첫줄/끝줄이 비는 케이스 방지.
  const makeSheetTarget = (sel: SelectionRange): HighlightSheetTarget => ({
    startSentence: sel.startSentence,
    startOffset: sel.startOffset,
    endSentence: sel.endSentence,
    endOffset: sel.endOffset,
    previewText:
      typeof window !== 'undefined' ? (window.getSelection()?.toString() ?? '').trim() : '',
    anchorStartText: sel.startSentenceText,
    anchorEndText: sel.endSentenceText,
    existing: null,
  });

  // ──────── highlight save / delete ────────
  const saveHighlight = useCallback(
    async (target: HighlightSheetTarget, memo: string) => {
      if (!userId) {
        setMessage('로그인 정보를 불러올 수 없습니다.');
        setShowMessage(true);
        return;
      }
      if (!resolvedTitle) return;

      // 기존 highlight 메모 수정 모드
      if (target.existing) {
        const { error } = await supabase
          .from('highlights')
          .update({ memo: memo || null })
          .eq('id', target.existing.id);
        if (error) {
          setMessage(`메모 저장 실패: ${error.message}`);
          setShowMessage(true);
          return;
        }
        const id = target.existing.id;
        setHighlights((prev) => prev.map((h) => (h.id === id ? { ...h, memo: memo || null } : h)));
        return;
      }

      // 신규 highlight insert. highlight_text = 사용자가 정확히 선택한 텍스트 (preview 용).
      const { data, error } = await supabase
        .from('highlights')
        .insert({
          user_id: userId,
          title: resolvedTitle,
          start_sentence: target.startSentence,
          end_sentence: target.endSentence,
          start_char_offset: target.startOffset,
          end_char_offset: target.endOffset,
          anchor_start_text: target.anchorStartText.slice(0, 50),
          anchor_end_text: target.anchorEndText.slice(0, 50),
          highlight_text: target.previewText || null,
          memo: memo || null,
        })
        .select('id, start_sentence, end_sentence, start_char_offset, end_char_offset, memo, highlight_text')
        .single();
      if (error || !data) {
        console.error('[highlight insert failed]', { error, target });
        setMessage(`하이라이트 저장 실패: ${error?.message ?? '알 수 없는 오류'}`);
        setShowMessage(true);
        return;
      }
      setHighlights((prev) => [...prev, data as StoredHighlight]);
      clearBrowserSelection();
      setSelection(null);
      setSelectionRect(null);
    },
    [userId, resolvedTitle],
  );

  const deleteHighlight = useCallback(async (existingId: string) => {
    const { error } = await supabase.from('highlights').delete().eq('id', existingId);
    if (error) {
      setMessage('삭제 실패');
      setShowMessage(true);
      return;
    }
    setHighlights((prev) => prev.filter((h) => h.id !== existingId));
  }, []);

  // 메모 popup 자동 닫기 — 외부 click / scroll
  useEffect(() => {
    if (!highlightPopup) return;
    const close = () => setHighlightPopup(null);
    // 다음 tick 에 등록 — 현재 click(popup 열기) 이 즉시 close 되지 않게
    const t = setTimeout(() => {
      document.addEventListener('click', close);
      window.addEventListener('scroll', close, { passive: true, capture: true });
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', close);
      window.removeEventListener('scroll', close, { capture: true });
    };
  }, [highlightPopup]);

  const openMemoEdit = (highlightId: string) => {
    const h = highlights.find((x) => x.id === highlightId);
    if (!h) return;
    setHighlightPopup(null);
    setSheetTarget({
      startSentence: h.start_sentence,
      startOffset: h.start_char_offset ?? 0,
      endSentence: h.end_sentence,
      endOffset: h.end_char_offset ?? (displayTexts[h.end_sentence]?.length ?? 0),
      previewText: displayTexts[h.start_sentence] ?? '',
      anchorStartText: displayTexts[h.start_sentence] ?? '',
      anchorEndText: displayTexts[h.end_sentence] ?? '',
      existing: { id: h.id, memo: h.memo },
    });
  };

  // ──────── selection 추적 (native browser selection) ────────
  useEffect(() => {
    const handler = () => {
      if (ignoreNextSelectionChangeRef.current) {
        ignoreNextSelectionChangeRef.current = false;
        return;
      }
      const sel = getSelectionRange(contentRef.current);
      if (!sel) {
        setSelection(null);
        setSelectionRect(null);
        return;
      }
      setSelection(sel);
      setSelectionRect(getSelectionRect());
    };
    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
  }, []);

  // ──────── selection 완료 후 native action menu 차단 ────────
  // 터치 release 시점에 현재 selection 을 비워 native Copy/공유 popover (iOS WKWebView,
  // Android Chromium WebView 모두) 가 뜨지 않게 한다. 우리 FloatingActionBar 는 selection state
  // 로 이미 표시되어 있으므로 native selection 자체는 더 이상 필요 없음. 데스크톱은 native menu
  // 이슈가 없으므로 mouse 인터랙션은 건드리지 않는다 (Ctrl+C 등 보존).
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const onTouchEnd = () => {
      // 다음 frame — release 시점에 selection 이 확정된 직후 비움
      requestAnimationFrame(() => {
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
          ignoreNextSelectionChangeRef.current = true;
          sel.removeAllRanges();
        }
      });
    };
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  // FloatingActionBar 액션
  const handleSelectionHighlight = async () => {
    if (!selection) return;
    await saveHighlight(makeSheetTarget(selection), '');
  };

  const handleSelectionMemo = () => {
    if (!selection) return;
    setSheetTarget(makeSheetTarget(selection));
    // sheet 열렸으니 popover 는 숨김 (selection 은 그대로)
    setSelection(null);
    setSelectionRect(null);
  };

  // 묻기 → reader 안 모달. 페이지 이동 없음.
  const [askModalOpen, setAskModalOpen] = useState(false);
  const [askModalCitation, setAskModalCitation] = useState<AskModalCitation | null>(null);

  // modal 활성 추적 — onScroll handler 가 modal 활성 / 직후 (scrollTo restore 동안) chrome 변경 무시.
  useEffect(() => {
    const active =
      !!sheetTarget || askModalOpen || !!termPopup || !!confirmDeleteId || showMessage;
    if (active) {
      modalActiveRef.current = true;
    } else {
      // close 직후 useBodyScrollLock 의 scrollTo restore 가 onScroll 발화. 한 tick 뒤 가드 해제.
      const t = setTimeout(() => { modalActiveRef.current = false; }, 100);
      return () => clearTimeout(t);
    }
  }, [sheetTarget, askModalOpen, termPopup, confirmDeleteId, showMessage]);

  const formatCitationTitle = (title: string): string =>
    title.replace(/_K\d{4}/, '').replace(/_/g, ' ');

  const handleSelectionAsk = () => {
    if (!selection) return;
    // trim — block-level sentence 사이 newline 으로 인한 인용 첫줄/끝줄 빈 줄 방지
    const text =
      typeof window !== 'undefined' ? (window.getSelection()?.toString() ?? '').trim() : '';
    setAskModalCitation({
      text,
      titleClean: formatCitationTitle(resolvedTitle),
      scriptureTitle: resolvedTitle,
    });
    setAskModalOpen(true);
    clearBrowserSelection();
    setSelection(null);
    setSelectionRect(null);
  };

  // 기존 highlight 의 정확한 텍스트 추출 — highlight_text 우선, 없으면 displayTexts 에서 offset 으로 조립.
  const extractHighlightText = (h: StoredHighlight): string => {
    if (h.highlight_text && h.highlight_text.trim()) return h.highlight_text;
    const startS = displayTexts[h.start_sentence] ?? '';
    const endS = displayTexts[h.end_sentence] ?? '';
    const sO = h.start_char_offset ?? 0;
    const eO = h.end_char_offset ?? endS.length;
    if (h.start_sentence === h.end_sentence) return startS.slice(sO, eO);
    const parts: string[] = [startS.slice(sO)];
    for (let i = h.start_sentence + 1; i < h.end_sentence; i++) {
      parts.push(displayTexts[i] ?? '');
    }
    parts.push(endS.slice(0, eO));
    return parts.join(' ');
  };

  const openAskFromHighlight = (highlightId: string) => {
    const h = highlights.find((x) => x.id === highlightId);
    if (!h) return;
    setAskModalCitation({
      text: extractHighlightText(h),
      titleClean: formatCitationTitle(resolvedTitle),
      scriptureTitle: resolvedTitle,
    });
    setAskModalOpen(true);
    setHighlightPopup(null);
  };

  const handleSheetSave = async ({ memo }: { memo: string }) => {
    if (!sheetTarget) return;
    await saveHighlight(sheetTarget, memo);
  };

  const handleSheetClose = () => {
    setSheetTarget(null);
    clearBrowserSelection();
  };

  const cycleFontSize = () => setFontSize((prev) => (prev === 'base' ? 'lg' : prev === 'lg' ? 'xl' : 'base'));

  const handleGlobalSearch = async () => {
    if (!search.trim()) return;
    setIsSearching(true);
    setGlobalResults([]);
    try {
      const res = await fetch(`/api/global-search?query=${encodeURIComponent(search)}`);
      const data = await res.json();
      setGlobalResults(data.results || []);
    } catch {
      /* noop */
    } finally {
      setIsSearching(false);
    }
  };

  // 모달에서 다른 title 을 골랐을 때 → 해당 Layer 3 로 라우팅
  const setSelectedForModal = useCallback(
    (title: string) => {
      const path = titleToReaderPath(title);
      router.push(path);
    },
    [router],
  );

  const renderPlayer = () => {
    if (!platformInfo.platform || ttsSentences.length === 0) return null;
    // chrome 와 동기화: hide 시 opacity 0 + slide + 클릭 차단 (잔상·접근성 모두 차단)
    const playerClassName = `transition-all duration-200 ${showChrome ? 'opacity-100' : 'opacity-0 translate-y-[200%] pointer-events-none'}`;
    const playerProps = {
      sentences: ttsSentences,
      scriptureName: groupMeta?.display_name || formatDisplayTitle(resolvedTitle),
      currentIndex,
      setCurrentIndex,
      smoothCenter,
      onPlaybackStateChange: setIsTTSSpeaking,
      className: playerClassName,
      // BottomNav (~70) + gap(20) + sub-info(22) + gap(18) = TTS bottom 130
      bottomOffset: 'calc(env(safe-area-inset-bottom) + 130px)',
    };
    return platformInfo.isNative ? <NativeTTSPlayer {...playerProps} /> : <WebTTSPlayer {...playerProps} />;
  };

  // 강조 마커 렌더 (옛 page.tsx 와 동일)
  const renderEmphasisText = (text: string, keyPrefix: string): ReactNode[] => {
    const nodes: ReactNode[] = [];
    const pattern = /(\*\*\*[^*]+?\*\*\*|\*\*[^*]+?\*\*|\*[^*]+?\*)/g;
    let cursor = 0;
    let match: RegExpExecArray | null = null;
    while ((match = pattern.exec(text)) !== null) {
      if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
      const token = match[0];
      if (token.startsWith('***') && token.endsWith('***')) {
        nodes.push(
          <strong key={`${keyPrefix}-bi-${match.index}`}>
            <em>{token.slice(3, -3)}</em>
          </strong>,
        );
      } else if (token.startsWith('**') && token.endsWith('**')) {
        nodes.push(<strong key={`${keyPrefix}-b-${match.index}`}>{token.slice(2, -2)}</strong>);
      } else if (token.startsWith('*') && token.endsWith('*')) {
        nodes.push(<em key={`${keyPrefix}-i-${match.index}`}>{token.slice(1, -1)}</em>);
      } else {
        nodes.push(token);
      }
      cursor = match.index + token.length;
    }
    if (cursor < text.length) nodes.push(text.slice(cursor));
    return nodes;
  };

  // renderInlineTerms — density 인지 렌더.
  // densityState 는 호출자 (JSX IIFE) 가 한 paint 당 1회 makeDensityState() 로 생성해 넘김.
  // entry 가 없거나 density 가 "마크 안 함" 으로 결정되면 plain text 로 렌더 (가독성 ↑).
  const renderInlineTerms = (text: string, densityState: DensityState): ReactNode[] => {
    const nodes: ReactNode[] = [];
    const pattern = /\[\[([^[\]]+?)\]\]/g;
    let cursor = 0;
    let match: RegExpExecArray | null = null;
    while ((match = pattern.exec(text)) !== null) {
      if (match.index > cursor) {
        nodes.push(...renderEmphasisText(text.slice(cursor, match.index), `plain-${match.index}`));
      }
      const inner = match[1].trim();
      const [lookupTermRaw, displayRaw] = inner.split('|');
      const lookupTerm = lookupTermRaw?.trim() || inner;
      const displayText = displayRaw?.trim() || lookupTerm;

      const entry = conceptsIndex.get(lookupTerm) ?? null;
      // entry 없음 → plain (옛 동작 "등록 안 됨" popup 노출 안 함, 시각 noise 제거)
      // entry density 가 first_per_* 이면 누적 set 검사하여 첫 occurrence 만 마크
      const willMark = entry ? shouldMark(entry, densityState) : false;

      if (!willMark) {
        // plain — emphasis 처리만, 마커 시각 없음
        nodes.push(...renderEmphasisText(displayText, `plain-term-${match.index}`));
      } else {
        nodes.push(
          <button
            key={`term-${match.index}-${lookupTerm}`}
            type="button"
            className="font-bold text-accent-soft underline decoration-accent-soft decoration-2 underline-offset-2 hover:opacity-85 active:opacity-70 transition-opacity cursor-pointer [overflow-wrap:anywhere]"
            onClick={(e) => {
              e.stopPropagation();
              setTermPopup({ surface: lookupTerm, entry });
            }}
          >
            {displayText}
          </button>,
        );
      }
      cursor = match.index + match[0].length;
    }
    if (cursor < text.length) nodes.push(...renderEmphasisText(text.slice(cursor), `tail-${cursor}`));
    return nodes;
  };

  const layer2Path = `/scripture/${encodeURIComponent(groupKey)}`;
  const topNavTitle = (() => {
    const name = groupMeta?.display_name ?? formatDisplayTitle(resolvedTitle);
    const volTotal = groupMeta?.volume_total ?? volumes.length;
    return volTotal > 1 ? `${name} ${volumeNo}권` : name;
  })();
  const subInfo = (() => {
    const total = ttsSentences.length;
    // clamp 안전장치 — 어떤 이유로든 currentIndex 가 total 초과 시 표시 over count 방지
    const cur = total > 0 ? Math.min(currentIndex, total - 1) + 1 : 0;
    return `${cur}/${total}`;
  })();
  // TTS 재생 중에는 chrome 강제 표시 (자동 스크롤로 sub-info / TTS 컨트롤 사라지지 않게)
  const showChrome = chromeVisible || isTTSSpeaking;

  // 읽는 줄 강조 — 사용자 setting OFF 일 때 TTS 정지 중에는 숨김 (highlight + 메모만 보임).
  // TTS 재생 중에는 setting 무시하고 강제 표시 (재생 위치 시각 sync 핵심).
  const lineHighlightSetting = useReaderSettingsStore((s) => s.lineHighlight);
  const hydrateReaderSettings = useReaderSettingsStore((s) => s.hydrate);
  useEffect(() => hydrateReaderSettings(), [hydrateReaderSettings]);
  const showCurrentLine = lineHighlightSetting || isTTSSpeaking;

  // 글로벌 BottomNav 동기화 — Layer 3 의 showChrome 이 store 통해 BottomNav 로 전파
  const setBottomChrome = useChromeStore((s) => s.setVisible);
  useEffect(() => {
    setBottomChrome(showChrome);
  }, [showChrome, setBottomChrome]);
  // Layer 3 unmount 시 BottomNav 항상 보이게 리셋 (다른 페이지 영향 방지)
  useEffect(() => {
    return () => setBottomChrome(true);
  }, [setBottomChrome]);

  return (
    <main
      className="px-4 pb-[240px] max-w-[460px] mx-auto relative overflow-x-clip [overflow-wrap:anywhere] bg-surface-elevated min-h-screen"
      onClick={() => {
        // 화면 tap = chrome 토글 (Apple Books / video player 패턴).
        // 단, 활성 overlay (popover / sheet / modal / native text selection) 가 있으면 토글 안 함.
        //   - selection 진행 중 / popover 외부 click 으로 닫기 / 모달 backdrop click 등은 chrome 영향 X
        //   - 사용자가 highlight/메모/질문 액션 흐름 도중에 의도치 않게 chrome 깜빡이는 것 방지
        if (
          selection ||
          sheetTarget ||
          askModalOpen ||
          termPopup ||
          confirmDeleteId ||
          showMessage ||
          highlightPopup
        ) return;
        if (typeof window !== 'undefined') {
          const sel = window.getSelection();
          if (sel && !sel.isCollapsed) return;
        }
        setChromeVisible((prev) => !prev);
        lastScrollY.current = window.scrollY;
      }}
    >
      {/* 상단 미니멀 nav — scroll 방향 기반 hide/show */}
      <div
        className={`sticky top-0 z-50 bg-surface-elevated transition-transform duration-200 ${showChrome ? '' : '-translate-y-full'}`}
        style={{
          paddingTop: 'calc(max(44px, env(safe-area-inset-top)) + 8px)',
          paddingBottom: '8px',
          height: 'calc(56px + max(44px, env(safe-area-inset-top)))',
        }}
      >
        <div className="flex items-center gap-2">
          {/* 좌측 — 우측과 동일 폭으로 균형 (가운데 영역이 정확히 화면 가운데) */}
          <div className="flex items-center w-[132px]">
            <button
              type="button"
              aria-label="뒤로"
              onClick={() => router.push(layer2Path)}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-accent hover:bg-accent/5 active:bg-accent/10 transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
          </div>

          {/* 가운데 — flex-1 + min-w-0 + truncate. 좌우 영역 침범 절대 불가 */}
          <h1 className="flex-1 min-w-0 truncate text-base font-semibold text-accent text-center">
            {topNavTitle}
          </h1>

          {/* 우측 — 3개 × 40 + 2 gap = 132px */}
          <div className="flex items-center justify-end gap-1 w-[132px]">
            <button
              type="button"
              aria-label="검색"
              onClick={() => setShowModal(true)}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-accent hover:bg-accent/5 active:bg-accent/10 transition-colors"
            >
              <Search size={22} />
            </button>
            <button
              type="button"
              aria-label="글자 크기"
              onClick={cycleFontSize}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-accent hover:bg-accent/5 active:bg-accent/10 transition-colors"
            >
              <span className={`font-semibold ${fontSize === 'base' ? 'text-sm' : fontSize === 'lg' ? 'text-base' : 'text-lg'}`}>가</span>
            </button>
          </div>
        </div>
      </div>

      {/* 본문 — native text selection 활성 (e-book 패턴). iOS callout 차단 + selectionchange 로 우리 popover 만 표시. */}
      <div
        ref={contentRef}
        className={`whitespace-pre-wrap break-keep font-maruburi bg-surface-elevated rounded-xl ${fontSizeClass} leading-relaxed pt-4`}
        style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'text', userSelect: 'text' }}
      >
        {(() => {
          let readCursor = 0;
          // Density state — 한 paint 당 1회 생성. 권 단위 누적 (first_per_volume) /
          // 그룹 단위 누적 (first_per_scripture) 결정에 사용. paint 마다 reset 되어 일관된 결과.
          const densityState = makeDensityState();
          const renderInline = (text: string) => renderInlineTerms(text, densityState);
          return contentBlocks.map((block, blockIdx) => {
            if (block.type === 'hr') {
              return <hr key={`hr-${blockIdx}`} className="my-5 border-t border-line" />;
            }
            if (block.type === 'heading') {
              const globalIndex = readCursor;
              readCursor += 1;
              const headingClass =
                block.level === 1
                  ? 'text-2xl font-bold mt-7 mb-3'
                  : block.level === 2
                    ? 'text-xl font-bold mt-6 mb-3'
                    : 'text-lg font-semibold mt-5 mb-2';
              const pieces = sentenceHighlightMap.get(globalIndex) ?? [];
              return (
                <h2
                  key={`heading-${blockIdx}`}
                  data-index={globalIndex}
                  ref={(el) => {
                    sentenceRefs.current[globalIndex] = el as unknown as HTMLSpanElement | null;
                  }}
                  className={`${headingClass} text-accent rounded-lg px-1 transition-colors duration-150 ${
                    globalIndex === currentIndex && showCurrentLine ? 'bg-highlight' : ''
                  }`}
                >
                  {renderSentenceWithHighlights(block.text, pieces, renderInline)}
                </h2>
              );
            }
            if (block.type === 'blockquote') {
              return (
                <blockquote key={`quote-${blockIdx}`} className="border-l-4 border-accent-soft pl-3 my-4 text-ink-muted">
                  {block.lines.map((line, lineIdx) => {
                    const globalIndex = readCursor;
                    readCursor += 1;
                    const pieces = sentenceHighlightMap.get(globalIndex) ?? [];
                    return (
                      <p
                        key={`quote-line-${lineIdx}`}
                        data-index={globalIndex}
                        ref={(el) => {
                          sentenceRefs.current[globalIndex] = el as unknown as HTMLSpanElement | null;
                        }}
                        className={`mb-1 last:mb-0 rounded-lg px-1 transition-colors duration-150 ${
                          globalIndex === currentIndex && showCurrentLine ? 'bg-highlight' : ''
                        }`}
                      >
                        {renderSentenceWithHighlights(line, pieces, renderInline)}
                      </p>
                    );
                  })}
                </blockquote>
              );
            }
            return (
              <div key={`paragraph-${blockIdx}`} className="mb-6">
                {block.sentences.map((sentence) => {
                  const globalIndex = readCursor;
                  readCursor += 1;
                  const pieces = sentenceHighlightMap.get(globalIndex) ?? [];
                  return (
                    <span
                      key={`sentence-${globalIndex}`}
                      data-index={globalIndex}
                      ref={(el) => {
                        sentenceRefs.current[globalIndex] = el;
                      }}
                      className={`block px-1 rounded-lg transition-colors duration-150 ${
                        globalIndex === currentIndex && showCurrentLine ? 'bg-highlight' : ''
                      }`}
                    >
                      {renderSentenceWithHighlights(sentence, pieces, renderInline)}
                    </span>
                  );
                })}
              </div>
            );
          });
        })()}
      </div>

      {/* Orphan footer — 본문 변경으로 위치 추적 못 한 메모 카운터. subtle, panic 회피.
          본문 끝 ~ TTS 컨트롤 영역 위 사이에 자연스럽게 위치 (pb-[240px] 안). */}
      {orphanCount > 0 && (
        <div className="mt-10 mb-2 text-center text-xs text-ink-muted/70">
          <Link
            href="/me/highlights"
            onClick={(e) => e.stopPropagation()}
            className="inline-block px-3 py-1.5 rounded-full hover:bg-accent/5 active:bg-accent/10 transition-colors"
          >
            이 경전의 메모 {orphanCount}개를 새 본문에서 찾을 수 없습니다 →
          </Link>
        </div>
      )}

      {/* Sub info — TTS 컨트롤 (130) 과 BottomNav (~70) 사이. BottomNav 위 ~20 gap */}
      <div
        className={`fixed inset-x-0 z-30 pointer-events-none flex justify-center transition-all duration-200 ${showChrome ? 'opacity-100' : 'opacity-0 translate-y-full'}`}
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 90px)' }}
      >
        <div className="bg-surface-elevated/85 backdrop-blur-sm rounded-full px-3 py-1 text-xs text-ink-muted/80 max-w-[80%] truncate">
          {subInfo}
        </div>
      </div>

      {/* TTS 컨트롤 — 항상 렌더, chrome 동기화 hide/show */}
      {renderPlayer()}

      {/* 검색 모달 */}
      {showModal && (
        <ScriptureModal
          selected={resolvedTitle}
          setSelected={setSelectedForModal}
          onClose={() => setShowModal(false)}
          search={search}
          setSearch={setSearch}
          modalTab={modalTab}
          setModalTab={setModalTab}
          groupedTitles={groupedTitles}
          usedInitials={usedInitials}
          initialFilter={initialFilter}
          setInitialFilter={setInitialFilter}
          expandedBase={expandedBase}
          setExpandedBase={setExpandedBase}
          formatDisplayTitle={formatDisplayTitle}
          getChosung={getChosung}
          globalResults={globalResults}
          handleGlobalSearch={handleGlobalSearch}
          setCurrentIndex={setCurrentIndex}
          smoothCenter={smoothCenter}
          isSearching={isSearching}
          sentenceRefs={sentenceRefs}
          setBookmarkPending={setBookmarkPending}
          displaySentences={displaySentences}
          setShowModal={setShowModal}
          hideGlobalTab
        />
      )}

      {/* Floating popover — native selection 위/아래 */}
      <FloatingActionBar
        visible={!!selection}
        rect={selectionRect}
        onHighlight={handleSelectionHighlight}
        onMemo={handleSelectionMemo}
        onAsk={handleSelectionAsk}
      />

      {/* 하이라이트 액션 popover — 모든 highlight 클릭 시.
          메모 있으면 본문 미리보기 + [삭제 | 메모 | 묻기], 없으면 [삭제 | 메모 | 묻기].
          화면 가장자리 잘림 방지 — 좌우 16px margin clamp. */}
      {highlightPopup && (() => {
        const POPOVER_WIDTH = 320;
        const PAGE_MARGIN = 16;
        const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 460;
        const above = highlightPopup.rect.top - 12;
        const below = highlightPopup.rect.bottom + 12;
        const placeAbove = above > 120;
        const top = placeAbove ? above : below;
        const centerX = highlightPopup.rect.left + highlightPopup.rect.width / 2;
        // popover 좌우 끝이 화면 margin 안에 들어오도록 clamp
        const halfW = POPOVER_WIDTH / 2;
        const minLeft = PAGE_MARGIN + halfW;
        const maxLeft = viewportWidth - PAGE_MARGIN - halfW;
        const clampedLeft = Math.max(minLeft, Math.min(maxLeft, centerX));
        const hasMemo = !!(highlightPopup.memo && highlightPopup.memo.trim());
        return (
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="하이라이트 액션"
            className="fixed z-[60] rounded-xl bg-ink text-surface-elevated shadow-2xl overflow-hidden animate-fade-opacity"
            style={{
              top,
              left: clampedLeft,
              width: POPOVER_WIDTH,
              transform: placeAbove ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
            }}
          >
            {hasMemo && (
              <div className="px-4 py-3 border-b border-surface-elevated/15">
                <p className="text-sm whitespace-pre-wrap leading-relaxed line-clamp-4">
                  {highlightPopup.memo}
                </p>
              </div>
            )}
            <div className="flex items-stretch divide-x divide-surface-elevated/15">
              <button
                type="button"
                onClick={() => {
                  const id = highlightPopup.highlightId;
                  if (hasMemo) {
                    setConfirmDeleteId(id);
                  } else {
                    deleteHighlight(id);
                  }
                  setHighlightPopup(null);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-3 text-sm font-medium text-accent-soft hover:bg-white/10 active:bg-white/15 transition-colors whitespace-nowrap"
              >
                <Trash2 size={15} />
                삭제
              </button>
              <button
                type="button"
                onClick={() => openMemoEdit(highlightPopup.highlightId)}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-3 text-sm font-medium hover:bg-white/10 active:bg-white/15 transition-colors whitespace-nowrap"
              >
                <MessageSquarePlus size={15} />
                메모
              </button>
              <button
                type="button"
                onClick={() => openAskFromHighlight(highlightPopup.highlightId)}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-3 text-sm font-medium hover:bg-white/10 active:bg-white/15 transition-colors whitespace-nowrap"
              >
                <MessageCircleQuestion size={15} />
                묻기
              </button>
            </div>
          </div>
        );
      })()}

      {/* 메모 있는 highlight 삭제 confirmation */}
      {confirmDeleteId && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setConfirmDeleteId(null);
          }}
          className="fixed inset-0 bg-black/40 z-[80] flex items-center justify-center px-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface-elevated rounded-xl p-6 w-full max-w-[360px] text-center shadow-xl"
          >
            <p className="text-base font-semibold text-ink mb-1">하이라이트를 삭제할까요?</p>
            <p className="text-sm text-ink-muted mb-5">메모도 함께 삭제됩니다.</p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 h-11 rounded-lg border border-line text-sm text-ink-muted hover:bg-surface-sunken transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = confirmDeleteId;
                  setConfirmDeleteId(null);
                  await deleteHighlight(id);
                }}
                className="flex-1 h-11 rounded-lg bg-accent text-on-brand text-sm font-semibold hover:bg-accent-soft transition-colors"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Highlight bottom sheet — popover "메모" 액션 시.
          sheet 의 trash 버튼 = 메모만 제거 (highlight 자체 삭제는 popover 의 [삭제]). */}
      <HighlightSheet
        target={sheetTarget}
        onClose={handleSheetClose}
        onSave={handleSheetSave}
      />

      {/* Ask 모달 — popover "묻기" 액션 시. reader 안에서 질문 + 답변 모두 처리. */}
      <AskHighlightModal
        open={askModalOpen}
        citation={askModalCitation}
        onClose={() => setAskModalOpen(false)}
      />

      {/* 메시지 팝업 */}
      {showMessage && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setShowMessage(false);
          }}
          className="fixed inset-0 z-[200] bg-ink/30 backdrop-blur-sm flex items-center justify-center"
        >
          <div className="bg-surface-elevated px-6 py-4 rounded-2xl shadow-lg text-center max-w-[80%]">
            <p className="whitespace-pre-wrap text-sm text-ink">{message}</p>
            <button
              onClick={() => {
                setShowMessage(false);
                if (message === '로그인 정보를 불러올 수 없습니다.') router.push('/login');
              }}
              className="mt-4 px-4 py-1 bg-accent-soft text-on-brand rounded-xl text-sm"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 개념 sheet — Phase 6D. 풍부한 entry 표시 + 관련 개념 navigation. */}
      {termPopup && (
        <ConceptSheet
          initialSurface={termPopup.surface}
          initialEntry={termPopup.entry}
          conceptsIndex={conceptsIndex}
          onClose={() => setTermPopup(null)}
        />
      )}

      {/* 전체 검색 로딩 */}
      {isSearching && (
        <div className="fixed inset-0 bg-accent/10 backdrop-blur-xs z-[150] flex flex-col items-center justify-center">
          <Image src="/logo.png" alt="로딩" width={64} height={64} className="animate-float rounded-4xl mb-4" />
          <p className="text-ink text-xl font-semibold">팔만대장경 전체 검색 중입니다</p>
        </div>
      )}

      {/* list 미사용 경고 회피 — ScriptureModal 이 groupedTitles 만 쓰지만 list state 자체는 향후 활용 여지로 유지 */}
      <span className="hidden" aria-hidden>
        {list.length}
      </span>
    </main>
  );
}

// Re-export 없음 (Next.js page)
// `resolveActualTitle` 는 옛 page.tsx 호환용으로 정의는 유지하나 이 파일에서는 사용 안 함.
// 의도적 unused 를 막기 위해 dummy 참조.
void resolveActualTitle;
