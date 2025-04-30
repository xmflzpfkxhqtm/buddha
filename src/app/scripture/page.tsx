'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { useBookmarkStore } from '../../stores/useBookmarkStore';
import { supabase } from '@/lib/supabaseClient';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import ScriptureModal from '../../../components/ScriptureModal'; // ✅ 추가
import { KeepAwake } from '@capacitor-community/keep-awake';
import { ttsLimit } from '@/lib/limit';
import pLimit from 'p-limit';

interface GlobalSearchResult {
  title: string;
  index: number;
  text: string;
}
const limit = pLimit(1); // 한 번에 최대 1개의 fetchTTSUrl 작업만 허용

const getChosung = (char: string): string => {
  const code = char.charCodeAt(0) - 44032;
  if (code < 0 || code > 11171) return char;

  const baseConsonants = [
    'ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ',
    'ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'
  ];

  const labels: Record<string, string> = {
    'ㄱ': '가', 'ㄴ': '나', 'ㄷ': '다', 'ㄹ': '라', 'ㅁ': '마',
    'ㅂ': '바', 'ㅅ': '사', 'ㅇ': '아', 'ㅈ': '자', 'ㅊ': '차',
    'ㅋ': '카', 'ㅌ': '타', 'ㅍ': '파', 'ㅎ': '하'
  };

  const cho = baseConsonants[Math.floor(code / 588)];
  return labels[cho] || char;
};

// ✅ fallback 지원 함수 추가
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
  return rawTitle
    .replace(/_GPT\d+(\.\d+)?번역/, '') // GPT 번역 제거
    .replace(/_/g, ' ');                // _를 공백으로
}


export default function ScripturePage() {

  
  const [displayParagraphs, setDisplayParagraphs] = useState<string[][]>([]);
  const router = useRouter();
  const [list, setList] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  const [displaySentences, setDisplaySentences] = useState<string[]>([]);
  const [ttsSentences, setTtsSentences] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [bookmarkedIndexes, setBookmarkedIndexes] = useState<number[]>([]);
  const isBookmarked = bookmarkedIndexes.includes(currentIndex);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [modalTab, setModalTab] = useState<'title' | 'content' | 'global'>('title');
  const [globalResults, setGlobalResults] = useState<GlobalSearchResult[]>([]);
  const [fontSize, setFontSize] = useState<'base' | 'lg' | 'xl'>('lg');
  const fontSizeClass = { base: 'text-base', lg: 'text-lg', xl: 'text-xl' }[fontSize];
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [showMessage, setShowMessage] = useState(false);
  const [bookmarkPending, setBookmarkPending] = useState<{ title: string; index: number } | null>(null);
  const [initialFilter, setInitialFilter] = useState('전체');
  const shouldStop  = useRef(false);            // 이름 단순화
  const preloadMap  = useRef<Map<number,string>>(new Map()); // 새 Map
  const sentenceRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const smoothCenter = (idx: number, instant = false) => {
    sentenceRefs.current[idx]?.scrollIntoView({
      block: 'center',          // 중앙 정렬
      inline: 'nearest',
      behavior: instant ? 'instant' : 'smooth',
    });
  };
  
  const audioRef     = useRef<HTMLAudioElement | null>(null);
  const indexRef     = useRef(currentIndex);
    
  const [isSearching, setIsSearching] = useState(false);
  const [groupedTitles, setGroupedTitles] = useState<Record<string, string[]>>({});
  const [expandedBase, setExpandedBase] = useState<string | null>(null);
  
  
  
  
  const { title, index, clearBookmark } = useBookmarkStore();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.id) setUserId(data.user.id);
    });
  }, []);

  useEffect(() => {
    indexRef.current = currentIndex;
  }, [currentIndex]);

  const groupTitlesByBaseName = (titles: string[]) => {
    const map: Record<string, string[]> = {};
    titles.forEach((title) => {
      const base = title.split('_')[0]; // '금강반야바라밀경'
      if (!map[base]) map[base] = [];
      map[base].push(title);
    });
    return map;
  };

  const getUsedInitials = (groups: Record<string, string[]>) => {
    const initials = new Set<string>();
    Object.keys(groups).forEach((base) => {
      const cho = getChosung(base.charAt(0));
      initials.add(cho);
    });
    return initials;
  };
  
  const usedInitials = getUsedInitials(groupedTitles);
  

  useEffect(() => {
    fetch('/api/scripture/list')
      .then(res => res.json())
      .then(data => {
        const titles: string[] = data.titles || [];
        setList(titles);
        setGroupedTitles(groupTitlesByBaseName(titles));
      });
  }, []);
  
  useEffect(() => {
    if (!userId || !selected) return;
  
    const fetchBookmarks = async () => {
      const { data, error } = await supabase
        .from('bookmarks')
        .select('index')
        .eq('user_id', userId)
        .eq('title', selected);
  
      if (!error && data) {
        setBookmarkedIndexes(data.map((d) => d.index));
      }
    };
  
    fetchBookmarks();
  }, [userId, selected]);
  

  useEffect(() => {
    if (list.length === 0) return;

    if (title && list.length > 0 && selected !== title) {
      setBookmarkPending({ title, index: index ?? 0 });
      setSelected(title);
    } else if (!title && !selected && list.length > 0) {
      const defaultTitle = '금강반야바라밀경_1권';
      const resolved = resolveActualTitle(defaultTitle, list);
      setSelected(resolved ?? list[0]);
    }
      }, [list, title, index, selected]);

  // ✅ selected가 변경되었을 때 로딩 (fallback 포함)
  useEffect(() => {
    if (!selected || list.length === 0) return;

    const loadScripture = async () => {
      const actual = resolveActualTitle(selected, list);
      setCurrentIndex(0);
    
      if (!actual) {
        console.warn('❌ 해당 경전을 찾을 수 없습니다:', selected);
        setDisplaySentences(['해당 경전을 불러올 수 없습니다.']);
        setTtsSentences([]);
        setDisplayParagraphs([]);
        return;
      }
    
      const res = await fetch(`/api/scripture?title=${encodeURIComponent(actual)}`);
      const data = await res.json();
    
      if (data?.content) {
        const full = data.content;

        // 문단 나누기
        const paragraphs = full.split(/\n\s*\n/);
        
        // 문장 쪼개기 (split 방식)
        const paragraphSentences = paragraphs.map((p: string) =>
          p
            .split(/(?<=[.!?]["”'’]?)\s+/)  // ✅ 마침표/느낌표/물음표(+따옴표) 뒤 공백으로 쪼갬
            .map(s => s.trim())
            .filter(s => s.length > 0)      // ✅ 빈 문장 제거
        );
        
        // 화면용 문단 구조
        setDisplayParagraphs(paragraphSentences);
        
        // 내부 로직용 1차원 배열
        const flatSentences = paragraphSentences.flat();
        setDisplaySentences(flatSentences);
        
        // TTS용 문장
        const tts = flatSentences.map((s: string) => s.replace(/\([^\)]*\)/g, ''));
        setTtsSentences(tts);
        
        // 초기화
        setCurrentIndex(0);
        sentenceRefs.current = Array(flatSentences.length).fill(null);
              } else {
        setDisplaySentences(['해당 경전을 불러올 수 없습니다.']);
        setTtsSentences([]);
        setDisplayParagraphs([]);
      }
    };
    
    loadScripture();
  }, [selected, list]);

  useEffect(() => {
    // 전체검색에서 다른 탭으로 이동 시 검색 로딩 해제
    if (modalTab !== 'global' && isSearching) {
      setIsSearching(false);
    }
  }, [modalTab, isSearching]);
  
  useEffect(() => {
    setSearch('');
  }, [modalTab]);
  

  useEffect(() => {
    if (
      bookmarkPending &&
      selected === bookmarkPending.title &&
      displaySentences.length > 0
    ) {
      console.log('✅ Bookmark Pending 처리:', bookmarkPending);
      setCurrentIndex(bookmarkPending.index);
      setTimeout(() => {
         smoothCenter(bookmarkPending.index, true);       // ✨변경
        clearBookmark();  // ✅ 이동 끝난 뒤에 clear
        setBookmarkPending(null);
      }, 200);  // ✅ scrollIntoView 한 직후에 clear
    }
  }, [bookmarkPending, selected, displaySentences, clearBookmark]);
      
// ✅ 이거처럼 useEffect 하나 더 추가
useEffect(() => {
  const onScroll = () => {
    if (isSpeaking) return; // ✅ TTS 중에는 무시

    const centerY = window.innerHeight / 2;
    let closestIndex = -1;
    let closestDistance = Infinity;

    sentenceRefs.current.forEach((el, i) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const elementCenter = rect.top + rect.height / 2;
      const distance = Math.abs(elementCenter - centerY);

      if (distance < closestDistance) {
        closestIndex = i;
        closestDistance = distance;
      }
    });

    if (closestIndex !== -1) {
      setCurrentIndex(closestIndex);
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  return () => window.removeEventListener('scroll', onScroll);
}, [isSpeaking]); // ✅ isSpeaking이 변경될 때 다시 등록



// ── TTS URL 받아오기 (요청 실패 시 재시도) ─────────────────────────
const fetchTTSUrl = async (text: string, idx: number): Promise<string> => {
  const MAX_ATTEMPTS = 20; // 최대 20번 시도 (약 20초 대기)
  const POLLING_INTERVAL = 1000; // 1초 간격으로 폴링

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (shouldStop.current) throw new Error('stopped'); // 중간에 중지되면 에러 발생

    try {
      console.log(`[fetchTTSUrl] Attempt ${attempt + 1} for index ${idx}`);
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scripture_id: selected, line_index: idx, text })
      });

      if (!response.ok) {
        // 5xx 서버 에러 등 처리
        console.error(`[fetchTTSUrl] API error for index ${idx}: ${response.status}`);
        // 심각한 오류 시 재시도 중단 또는 다른 처리 가능
        if (response.status >= 500) {
           await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL * 2)); // 서버 부하 줄이기 위해 더 길게 대기
           continue; // 5xx 에러는 재시도
        }
        throw new Error(`API Error: ${response.status}`); // 4xx 등 클라이언트 오류는 즉시 중단
      }

      const result = await response.json();

      if (result.url) {
        console.log(`[fetchTTSUrl] URL received for index ${idx}: ${result.url.substring(0, 50)}...`);
        return result.url; // 성공! URL 반환
      }

      if (result.status === 'processing' || result.status === 'pending') {
        // 아직 처리 중 또는 큐에 막 들어감 -> 잠시 후 재시도
        console.log(`[fetchTTSUrl] Status for index ${idx}: ${result.status}. Retrying...`);
        await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
        continue; // 다음 시도
      }

      // 예상치 못한 응답
      console.error(`[fetchTTSUrl] Unexpected response for index ${idx}:`, result);
      throw new Error('Unexpected API response');

    } catch (error) {
      // 네트워크 오류 또는 JSON 파싱 오류 등
      console.error(`[fetchTTSUrl] Error during fetch for index ${idx}:`, error);
      // 중단해야 하는 에러인지, 재시도해야 하는 에러인지 판단 필요
      if ((error as Error).message === 'stopped') throw error; // 중지 시 전파
      await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL)); // 일단 재시도
    }
  }

  // 최대 시도 횟수 초과
  console.error(`[fetchTTSUrl] Failed to get URL for index ${idx} after ${MAX_ATTEMPTS} attempts.`);
  throw new Error('timeout'); // 타임아웃 에러 발생
};

// fetchBlob 함수는 그대로 사용해도 좋습니다.
const fetchBlob = async (url: string): Promise<Blob> => {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res.blob();

      console.warn(`[fetchBlob] Failed attempt ${attempt + 1} for url ${url.substring(0,50)}... Status: ${res.status}`);
      if ([400, 403, 404, 504].includes(res.status)) {
        await new Promise(r => setTimeout(r, 500 + attempt * 100)); // 재시도 간격 약간 늘리기
        continue;
      }
      // 복구 불가능한 에러 (예: 401 Unauthorized)
       throw new Error(`fetchBlob ${res.status}`);
    } catch (err) {
        console.error(`[fetchBlob] Network or other error fetching blob:`, err);
         // 네트워크 불안정 등 잠시 후 재시도
         await new Promise(r => setTimeout(r, 500 + attempt * 100));
    }
  }
  console.error(`[fetchBlob] Failed to fetch blob after multiple attempts for url: ${url.substring(0,50)}...`);
  throw new Error('skip'); // 8회 실패 → 건너뜀 신호
};




const stopTTS = async () => {
  shouldStop.current = true;      // ✅ 이름 맞추기
  if (audioRef.current) {
    audioRef.current.pause();
    audioRef.current.src = '';
    audioRef.current.load();
    audioRef.current = null;
  }
  indexRef.current = currentIndex;

  setIsSpeaking(false); // ✅ 여기 꼭 확실히 false로 바꿔줘야 돼
  await KeepAwake.allowSleep();
  preloadMap.current.clear();     // ★ 이 줄 추가
  };

// ✅ 언마운트 시에도 재생 정지
useEffect(() => {
  return () => { stopTTS(); };
}, []);

// ✅ selected, modalTab, showModal 바뀔 때도 재생 정지
useEffect(() => {
  // 재생 중이면 멈춤
  stopTTS();

  // 인덱스·스크롤 초기화
  setCurrentIndex(0);
  window.scrollTo({ top: 0, behavior: 'instant' });

  // 책갈피 배열도 비워 두고, 곧바로 Supabase에서 새 책갈피를 받음
  setBookmarkedIndexes([]);
}, [selected]);

/* 2) 모달 탭·열림 상태가 바뀔 때는 재생만 멈추기 -------------- */
useEffect(() => {
  stopTTS();
}, [modalTab, showModal]);

const handlePlay = async () => {
  if (isSpeaking) {
    await stopTTS();
    return;
  }

  // 초기화 (stopTTS 내부에서 일부 처리됨)
  await stopTTS(); // 기존 오디오 정리 및 상태 초기화
  shouldStop.current = false;
  setIsSpeaking(true);
  await KeepAwake.keepAwake();
  indexRef.current = currentIndex; // 재생 시작 인덱스 설정

  console.log(`[TTS Play] Starting playback from index ${indexRef.current}`);

  // 전체 재생 루프를 try...finally로 감싸서 최종 정리를 보장
  try {
    while (indexRef.current < ttsSentences.length && !shouldStop.current) {
      const idx = indexRef.current;
      const text = ttsSentences[idx];
      console.log(`[TTS Play] === Processing index ${idx} ===`);

      setCurrentIndex(idx); // UI 업데이트 (현재 재생 문장 하이라이트)
      smoothCenter(idx);    // 현재 문장으로 스크롤

      let audio: HTMLAudioElement | null = null;
      let blobId: string | null = null;

      try {
        // --- 1. Fetch TTS URL (p-limit 적용) ---
        console.log(`[TTS Play] Requesting URL for index ${idx} (Concurrency Limit: ${limit.activeCount}/${limit.pendingCount})`);
        // !!! limit() 으로 fetchTTSUrl 호출을 감쌉니다 !!!
        const url = await limit(() => fetchTTSUrl(text, idx));
        console.log(`[TTS Play] Successfully got URL for index ${idx}`);

        if (!url) {
          // fetchTTSUrl이 null을 반환하는 경우는 없어야 하지만, 방어적으로 처리
          throw new Error('url_missing');
        }

        // --- 2. Fetch Audio Blob ---
        console.log(`[TTS Play] Fetching audio blob for index ${idx}`);
        const blob = await fetchBlob(url); // fetchBlob 내부에 재시도 로직 포함
        blobId = URL.createObjectURL(blob);
        console.log(`[TTS Play] Successfully got blob for index ${idx}`);

        // --- 3. Play Audio & Wait for Completion ---
        audio = new Audio(blobId);
        audioRef.current = audio; // 현재 오디오 참조 저장

        console.log(`[TTS Play] Attempting to play audio for index ${idx}`);
        // 오디오 재생 시도 (최대 3회)
        let playSuccess = false;
        for (let t = 0; t < 3; t++) {
          try {
            await audio.play();
            playSuccess = true;
            console.log(`[TTS Play] Audio playback started for index ${idx}`);
            break;
          } catch (playError) {
            console.warn(`[TTS Play] Audio play failed (attempt ${t + 1}) for index ${idx}:`, playError);
            if (t < 2) await new Promise(r => setTimeout(r, 300)); // 마지막 시도 전 잠시 대기
          }
        }
        if (!playSuccess) {
          throw new Error('play_fail'); // 3회 시도 모두 실패
        }

        // 오디오 재생 완료 대기 (onended 이벤트 활용)
        await new Promise<void>((resolve, reject) => {
          let intervalId: ReturnType<typeof setInterval> | null = null; // NodeJS.Timeout 대신 ReturnType 사용 (브라우저 호환)

          const cleanup = () => {
            if (intervalId) clearInterval(intervalId);
            // 이벤트 리스너 제거 (메모리 누수 방지)
            if(audio) {
                audio.onended = null;
                audio.onerror = null;
            }
          };

          audio!.onended = () => {
            console.log(`[TTS Play] Audio ended naturally for index ${idx}`);
            cleanup();
            resolve();
          };
          audio!.onerror = (e) => {
            console.error(`[TTS Play] Audio playback error for index ${idx}:`, e);
            cleanup();
            reject(new Error('playback_error'));
          };

          // 주기적으로 중지 신호 확인
          intervalId = setInterval(() => {
            if (shouldStop.current) {
              cleanup();
              audio?.pause(); // 즉시 중지 시도
              console.log(`[TTS Play] Playback stopped by user signal during wait for index ${idx}`);
              reject(new Error('stopped')); // 중지 에러 전파
            }
          }, 100); // 0.1초 간격 확인
        });

        // --- 4. 성공적으로 완료 시 다음 문장 인덱스로 ---
        indexRef.current += 1;

      } catch (err) {
        const error = err as Error;
        console.error(`[TTS Play] Error processing index ${idx}: ${error.message}`);

        if (error.message === 'stopped') {
          // 사용자가 중지한 경우, 루프 탈출
          break;
        }

        // 건너뛸 수 있는 오류 처리 (다음 문장으로 이동)
        if (['timeout', 'skip', 'play_fail', 'url_missing', 'playback_error'].includes(error.message)) {
          console.warn(`[TTS Play] Skipping index ${idx} due to error: ${error.message}`);
          indexRef.current += 1; // 다음 문장으로 강제 이동
          await new Promise(r => setTimeout(r, 200)); // 잠시 멈춤 (오류 연속 방지)
          continue; // while 루프의 다음 반복으로 넘어감
        }

        // 복구 불가능한 오류 (예: 심각한 API 오류) -> 재생 중단
        console.error('[TTS Play] Unrecoverable error encountered, stopping TTS playback.', error);
        setMessage(`오류가 발생하여 재생을 중단합니다: ${error.message}`);
        setShowMessage(true);
        break; // while 루프 탈출

      } finally {
        // --- 5. 현재 문장에 대한 뒷정리 (성공/실패/중단 모두 실행) ---
        if (blobId) {
          URL.revokeObjectURL(blobId);
          console.log(`[TTS Play] Revoked Object URL for index ${idx}`);
        }
        // audioRef는 stopTTS에서 최종적으로 null 처리될 것이므로 여기서 꼭 할 필요는 없음
        // if (audioRef.current === audio) { // 현재 참조가 맞는지 확인 후 null 처리 (선택 사항)
        //   audioRef.current = null;
        // }
      }
    } // end while loop
  } finally {
    // --- 최종 정리 (루프 정상 종료 또는 break 후 실행) ---
    console.log('[TTS Play] Playback loop finished or was interrupted. Running final cleanup.');
    await stopTTS(); // isSpeaking=false, KeepAwake 해제 등 최종 정리
  }
};


  const handleBookmark = async () => {
    if (!userId) {
      setMessage('로그인 정보를 불러올 수 없습니다.');
      setShowMessage(true);
      return;
    }
  
    if (isBookmarked) {
      // 삭제
      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .eq('user_id', userId)
        .eq('title', selected)
        .eq('index', currentIndex);
  
      if (!error) {
        setBookmarkedIndexes((prev) => prev.filter(i => i !== currentIndex));
      }
  
      setMessage(error ? '삭제 실패' : '❌ 책갈피가 삭제되었습니다.');
      setShowMessage(true);
      return;
    }
  
    // 저장 로직
    const { error } = await supabase.from('bookmarks').insert({
      user_id: userId,
      title: selected,
      index: currentIndex,
    });
  
    if (!error) {
      setBookmarkedIndexes((prev) => [...prev, currentIndex]);
    }
  
    setMessage(error ? '저장 실패' : '✅ 책갈피가 저장되었습니다.');
    setShowMessage(true);
  };
    
  const cycleFontSize = () =>
    setFontSize(prev => (prev === 'base' ? 'lg' : prev === 'lg' ? 'xl' : 'base'));

    const handleGlobalSearch = async () => {
      if (!search.trim()) return;
    
      setIsSearching(true);
      setGlobalResults([]);
    
      try {
        const res = await fetch(`/api/global-search?query=${encodeURIComponent(search)}`);
        const data = await res.json();
    
        setGlobalResults(data.results || []);
      } catch (err) {
        console.error('전체 검색 실패:', err);
        setGlobalResults([]);
      } finally {
        setIsSearching(false);
      }
    };
        

  return (
    
    <main className="p-4 pb-[120px] max-w-[430px] mx-auto relative">
      {/* 상단 */}
      <div className="sticky top-0 z-50 bg-white h-16 py-2">
        <div className="flex items-center justify-between gap-2">
          <div onClick={() => setShowModal(true)} className="cursor-pointer flex items-center max-w-[140px]">
          <span className="text-base font-semibold text-red-dark truncate">
  {formatDisplayTitle(selected)}
</span>
            <span className="ml-1 text-base text-red-light">⏷</span>
          </div>
          <span className="text-sm text-red-dark">{`${currentIndex + 1} / ${displaySentences.length}`}</span>
          <div className="flex items-center gap-2">
          <button
  onClick={handleBookmark}
  className="w-24 h-9 bg-red-light text-white rounded-lg font-semibold"
>
  {isBookmarked ? '책갈피 삭제' : '책갈피 저장'}
</button>
            <button onClick={cycleFontSize} className="w-9 h-9 bg-red-light text-white rounded-lg">
              {fontSize === 'base' ? '가' : fontSize === 'lg' ? <span className="text-lg">가</span> : <span className="text-xl font-semibold">가</span>}
            </button>
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className={`whitespace-pre-wrap font-maruburi bg-white rounded-xl ${fontSizeClass} leading-relaxed`}>
      {currentIndex < 10 && (
        <div style={{ height: '40vh' }} className="flex flex-col justify-center gap-3 text-red-dark]">
  <p className="text-lg font-bold">{formatDisplayTitle(selected)}</p>
  <p className="text-base leading-relaxed">
    천천히 아래로 스크롤하며 경전을 읽어보세요.<br />
    화면 아래의 버튼을 누르면 문장이 낭독됩니다.
  </p>
  <ul className="list-none space-y-1 pl-1 text-base">
    <li className="flex items-start"><span className="mr-2">-</span> 좌측 상단에서 경전 선택 / 문장 검색</li>
    <li className="flex items-start"><span className="mr-2">-</span> 우측 상단 ‘가’ 버튼으로 글자 크기 조절</li>
    <li className="flex items-start"><span className="mr-2">-</span> 문장을 책갈피에 저장 가능</li>
    <li className="flex items-start"><span className="mr-2">-</span> 재생 버튼으로 문장을 낭독</li>
  </ul>
</div>

)}
              

  {displayParagraphs.map((sentences, pIdx) => (
    <div key={pIdx} className="mb-6">
      {sentences.map((s, i) => {
        // 문장 인덱스 계산
        const globalIndex = displayParagraphs
          .slice(0, pIdx)
          .flat().length + i;

        return (
          <span
            key={globalIndex}
            data-index={globalIndex}
            ref={(el) => { sentenceRefs.current[globalIndex] = el }}
            className={`block ${globalIndex === currentIndex ? 'bg-amber-200' : ''} ${bookmarkedIndexes.includes(globalIndex) ? 'underline' : ''}`}
          >
            {s}
          </span>
        );
      })}
    </div>
  ))}
</div>

      {/* 재생 버튼 */}
      <button onClick={handlePlay} className="fixed bottom-[84px] left-1/2 -translate-x-1/2 bg-red-light text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg z-50">
        {isSpeaking ? <Pause size={32} /> : <Play size={32} />}
      </button>

      {/* 모달 */}
      {showModal && (
  <ScriptureModal
    selected={selected}
    setSelected={setSelected}
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
    isSearching={isSearching}
    sentenceRefs={sentenceRefs}
    setBookmarkPending={setBookmarkPending} // ✅ 추가
    displaySentences={displaySentences}
setShowModal={setShowModal}

  />
)}



      {/* 메시지 */}
      {showMessage && (
  <div onClick={() => setShowMessage(false)} className="fixed inset-0 z-[200] bg-black/30 backdrop-blur-sm flex items-center justify-center">
    <div className="bg-white px-6 py-4 rounded-2xl shadow-lg text-center max-w-[80%]">
      <p className="whitespace-pre-wrap text-sm text-gray-800">{message}</p>
      <button
        onClick={() => {
          setShowMessage(false);
          if (message === '로그인 정보를 불러올 수 없습니다.') {
            router.push('/login'); // 로그인 페이지로 이동
          }
        }}
        className="mt-4 px-4 py-1 bg-red-light text-white rounded-xl text-sm"
      >
        확인
      </button>
    </div>
  </div>
)}

{isSearching && (
  <div className="fixed inset-0 bg-red/10 backdrop-blur-xs z-[150] flex flex-col items-center justify-center">
<Image
  src="/logo.png"
  alt="로딩"
  width={64}
  height={64}
  className="animate-float rounded-4xl mb-4"
/>    <p className="text-black text-xl font-semibold">팔만대장경 전체 검색 중입니다</p>
  </div>
)}

    </main>
  );
}
