// src/app/scripture/page.tsx

'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useBookmarkStore } from '../../stores/useBookmarkStore';
import { supabase } from '@/lib/supabaseClient';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import ScriptureModal from '../../../components/ScriptureModal';
// === 플레이어 동적 로드 수정 ===
import dynamic from 'next/dynamic';
// 기존 TTSPlayer import 제거
// const TTSPlayer = dynamic(() => import('../../../components/TTSPlayer'), { ssr: false });
const WebTTSPlayer = dynamic(() => import('../../../components/WebTTSPlayer'), { ssr: false }); // 경로 확인 필요
const NativeTTSPlayer = dynamic(() => import('../../../components/NativeTTSPlayer'), { ssr: false }); // 경로 확인 필요
// === ===
import { Search } from 'lucide-react';
import { Capacitor } from '@capacitor/core'; // Capacitor 추가

interface GlobalSearchResult {
  title: string;
  index: number;
  text: string;
}

// 유틸리티 함수들 (변경 없음)
const getChosung = (char: string): string => {
  const code = char.charCodeAt(0) - 44032;
  if (code < 0 || code > 11171) return char;
  const baseConsonants = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  const labels: Record<string, string> = {'ㄱ': '가', 'ㄴ': '나', 'ㄷ': '다', 'ㄹ': '라', 'ㅁ': '마','ㅂ': '바', 'ㅅ': '사', 'ㅇ': '아', 'ㅈ': '자', 'ㅊ': '차','ㅋ': '카', 'ㅌ': '타', 'ㅍ': '파', 'ㅎ': '하'};
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
    // 원본 함수 유지
    if (!rawTitle) return ''; // null 체크 추가 가능
    return rawTitle
      .replace(/_GPT\d+(\.\d+)?번역/, '')
      .replace(/_/g, ' ');
}

export default function ScripturePage() {
  // 상태 변수들 (TTS 관련 상태는 isTTSSpeaking만 유지)
  const [isTTSSpeaking, setIsTTSSpeaking] = useState(false);
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
  const [userId, setUserId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [showMessage, setShowMessage] = useState(false);
  const [bookmarkPending, setBookmarkPending] = useState<{ title: string; index: number } | null>(null);
  const [initialFilter, setInitialFilter] = useState('전체');
  const sentenceRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [groupedTitles, setGroupedTitles] = useState<Record<string, string[]>>({});
  const [expandedBase, setExpandedBase] = useState<string | null>(null);

  // === 플랫폼 감지 상태 추가 ===
  const [platformInfo, setPlatformInfo] = useState<{ platform: string | null; isNative: boolean }>({ platform: null, isNative: false });

  const { title, index, clearBookmark } = useBookmarkStore(); // 원본 변수명 사용

  // 스크롤 함수 (원본 유지)
  const smoothCenter = useCallback((idx: number, instant = false) => {
    sentenceRefs.current[idx]?.scrollIntoView({
      block: 'center',
      inline: 'nearest',
      behavior: instant ? 'instant' : 'smooth',
    });
  }, []);

  useEffect(() => {
    if (selected) {
      console.log('📌 경전 선택 변경 감지 → currentIndex 0으로 초기화');
      setCurrentIndex(0);
    }
  }, [selected]);

  // === 플랫폼 감지 useEffect 추가 ===
  useEffect(() => {
    const currentPlatform = Capacitor.getPlatform();
    setPlatformInfo({
      platform: currentPlatform,
      isNative: currentPlatform !== 'web',
    });
  }, []);
  // === ===

  // 사용자 정보 로딩 (원본 유지)
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.id) setUserId(data.user.id);
    });
  }, []);

  // 제목 그룹핑 관련 함수 (원본 유지)
  const groupTitlesByBaseName = (titles: string[]) => { /* 원본 로직 */
    const map: Record<string, string[]> = {};
    titles.forEach((title) => {
      const base = title.split('_')[0];
      if (!map[base]) map[base] = [];
      map[base].push(title);
    });
    return map;
  };
  const getUsedInitials = (groups: Record<string, string[]>) => { /* 원본 로직 */
    const initials = new Set<string>();
    Object.keys(groups).forEach((base) => {
      const cho = getChosung(base.charAt(0));
      initials.add(cho);
    });
    return initials;
   };
  const usedInitials = getUsedInitials(groupedTitles);

  // 경전 목록 로딩 (원본 유지)
  useEffect(() => {
    fetch('/api/scripture/list')
      .then(res => res.json())
      .then(data => {
        const titles: string[] = data.titles || [];
        setList(titles);
        setGroupedTitles(groupTitlesByBaseName(titles));
      });
  }, []);

  // 북마크 로딩 (원본 유지)
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

  // 초기 경전 선택 및 북마크 이동 처리 (원본 유지)
  useEffect(() => {
    if (list.length === 0) return;
    // 원본 코드에서는 bookmarkTitle, bookmarkIndex 대신 title, index 사용
    if (title && list.length > 0 && selected !== title) {
      setBookmarkPending({ title, index: index ?? 0 });
      setSelected(title);
    } else if (!title && !selected && list.length > 0) {
      const defaultTitle = '금강반야바라밀경_1권';
      const resolved = resolveActualTitle(defaultTitle, list);
      setSelected(resolved ?? list[0]);
    }
  }, [list, title, index, selected]);

  // 경전 내용 로딩 (원본 유지)
  useEffect(() => {
    if (!selected || list.length === 0) return;
    const loadScripture = async () => {
      const actual = resolveActualTitle(selected, list);
      setCurrentIndex(0);
      window.scrollTo({ top: 0, behavior: 'instant' });
      setBookmarkedIndexes([]);

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
        const paragraphs = full.split(/\n\s*\n/);
        const paragraphSentences = paragraphs.map((p: string) =>
          p.split(/(?<=[.!?]["”'’]?)\s+/).map(s => s.trim()).filter(s => s.length > 0)
        );
        setDisplayParagraphs(paragraphSentences);
        const flatSentences = paragraphSentences.flat();
        setDisplaySentences(flatSentences);
        // 원본 ttsSentences 생성 로직 유지
        const tts = flatSentences.map((s: string) => s.replace(/\([^\)]*\)/g, ''));
        setTtsSentences(tts);
        sentenceRefs.current = Array(flatSentences.length).fill(null);
      } else {
        setDisplaySentences(['해당 경전을 불러올 수 없습니다.']);
        setTtsSentences([]);
        setDisplayParagraphs([]);
      }
       // 북마크 펜딩 처리 로직 (경전 로딩 완료 후 실행되도록 이 위치 유지)
      if (bookmarkPending && actual === bookmarkPending.title) {
        console.log('✅ Bookmark Pending 처리 (Scripture Load 후):', bookmarkPending);
        setTimeout(() => {
          const targetIndex = bookmarkPending.index;
          if (targetIndex >= 0 && targetIndex < (displaySentences.length || ttsSentences.length) ) { // displaySentences 기준으로 체크
            setCurrentIndex(targetIndex);
            smoothCenter(targetIndex, true);
          } else {
             console.warn(`Bookmark index ${targetIndex} is out of bounds.`);
             smoothCenter(0, true);
          }
          clearBookmark();
          setBookmarkPending(null);
        }, 200); // 시간 확보
      }
    };
    loadScripture();
  // 원본 의존성 배열 유지, bookmarkPending, clearBookmark, smoothCenter 추가
  }, [selected, list, bookmarkPending, clearBookmark, smoothCenter]);

  // 모달 탭 변경 시 처리 (원본 유지)
  useEffect(() => {
    if (modalTab !== 'global' && isSearching) {
      setIsSearching(false);
    }
  }, [modalTab, isSearching]);

  // 모달 탭 변경 시 검색어 초기화 (원본 유지)
  useEffect(() => {
    setSearch('');
  }, [modalTab]);

  // 북마크 이동 최종 처리 (원본 로직 및 위치 유지)
  useEffect(() => {
    if (
      bookmarkPending &&
      selected === bookmarkPending.title &&
      displaySentences.length > 0 // displaySentences 기준으로 체크
    ) {
      console.log('✅ Bookmark Pending 최종 처리 (상태 업데이트 후):', bookmarkPending);
      // 이 useEffect는 bookmarkPending 상태가 설정되고,
      // selected가 해당 title로 바뀌고, displaySentences가 로드된 후에 실행됨.
      setTimeout(() => {
          const targetIndex = bookmarkPending.index;
          if (targetIndex >= 0 && targetIndex < displaySentences.length) {
              // setCurrentIndex(targetIndex); // 이미 설정되었을 가능성 높음
              smoothCenter(targetIndex, true); // 스크롤만 확실히
          } else {
              console.warn(`Bookmark index ${targetIndex} is out of bounds.`);
              smoothCenter(0, true);
          }
          clearBookmark();
          setBookmarkPending(null);
      }, 200); // 조금 더 지연 시간 부여 가능
    }
  // 원본 의존성 배열 유지, smoothCenter 추가
  }, [bookmarkPending, selected, displaySentences, clearBookmark, smoothCenter]);

  // 스크롤 위치에 따른 현재 인덱스 동기화 (원본 유지)
  useEffect(() => {
    const onScroll = () => {
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
        setCurrentIndex(closestIndex);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [currentIndex, isTTSSpeaking]); // 원본 의존성 배열 유지

  // 북마크 핸들러 (원본 유지)
  const handleBookmark = async () => {
    if (!userId) {
      setMessage('로그인 정보를 불러올 수 없습니다.'); setShowMessage(true); return;
    }
    if (isBookmarked) { /* 삭제 로직 */
      const { error } = await supabase.from('bookmarks').delete().eq('user_id', userId).eq('title', selected).eq('index', currentIndex);
      if (!error) setBookmarkedIndexes((prev) => prev.filter(i => i !== currentIndex));
      setMessage(error ? '삭제 실패' : '❌ 책갈피가 삭제되었습니다.');
    } else { /* 추가 로직 */
      const { error } = await supabase.from('bookmarks').insert({ user_id: userId, title: selected, index: currentIndex });
      if (!error) setBookmarkedIndexes((prev) => [...prev, currentIndex]);
      setMessage(error ? '저장 실패' : '✅ 책갈피가 저장되었습니다.');
    }
    setShowMessage(true);
  };

  // 글자 크기 조절 핸들러 (원본 유지)
  const cycleFontSize = () => setFontSize(prev => (prev === 'base' ? 'lg' : prev === 'lg' ? 'xl' : 'base'));

  // 전체 검색 핸들러 (원본 유지)
  const handleGlobalSearch = async () => {
    if (!search.trim()) return;
    setIsSearching(true); setGlobalResults([]);
    try { /* 검색 로직 */
      const res = await fetch(`/api/global-search?query=${encodeURIComponent(search)}`);
      const data = await res.json();
      setGlobalResults(data.results || []);
    } catch { }
    finally { setIsSearching(false); }
  };

  // === 플레이어 렌더링 로직 추가 ===
  const renderPlayer = () => {
    if (!platformInfo.platform || ttsSentences.length === 0) {
      return null; // 플랫폼 감지 전 또는 문장 없으면 렌더링 안함
    }

    const playerProps = {
      sentences: ttsSentences,
      scriptureName: formatDisplayTitle(selected),
      currentIndex: currentIndex,
      setCurrentIndex: setCurrentIndex,
      smoothCenter: smoothCenter,
      onPlaybackStateChange: setIsTTSSpeaking,
    };

    return platformInfo.isNative
      ? <NativeTTSPlayer {...playerProps} />
      : <WebTTSPlayer {...playerProps} />;
  };
  // === ===

  useEffect(() => {
    if (displaySentences.length > 0 && ttsSentences.length > 0) {
      // ... existing code ...
    }
  }, [displaySentences.length, ttsSentences.length, setCurrentIndex, smoothCenter]);

  return (
    // JSX 구조 및 클래스명 원본 유지
    <main className="p-4 pb-[120px] max-w-[460px] mx-auto relative">
      {/* 상단 UI (원본 유지) */}
      <div className="sticky top-0 z-50 bg-white h-16 py-2">
        <div className="flex items-center justify-between gap-2">
          <div onClick={() => setShowModal(true)} className="cursor-pointer flex items-center max-w-[140px]">
            <span className="text-base font-semibold text-red-dark truncate">
              {formatDisplayTitle(selected)}
            </span>
            <span className="ml-1 text-base text-red-light"> <Search size={24} /></span>
          </div>
          <span className="text-sm text-red-dark whitespace-nowrap flex-shrink-0 overflow-visible">{`${currentIndex + 1} / ${displaySentences.length}`}</span>
          <div className="flex items-center gap-2">
            <button onClick={handleBookmark} className="w-24 h-9 bg-red-light text-white rounded-lg font-semibold">
              {isBookmarked ? '책갈피 삭제' : '책갈피 저장'}
            </button>
            <button onClick={cycleFontSize} className="w-9 h-9 bg-red-light text-white rounded-lg">
              {fontSize === 'base' ? '가' : fontSize === 'lg' ? <span className="text-lg">가</span> : <span className="text-xl font-semibold">가</span>}
            </button>
          </div>
        </div>
      </div>

      {/* 본문 (원본 유지) */}
      <div className={`whitespace-pre-wrap font-maruburi bg-white rounded-xl ${fontSizeClass} leading-relaxed`}>
        {/* 안내 문구 (원본 유지) */}
           <div style={{ minHeight: '40vh' }} className="flex flex-col justify-center gap-3 text-red-dark pt-4 pb-8">
            <p className="text-lg font-bold">{formatDisplayTitle(selected)}</p>
            <p className="text-base leading-relaxed">
              천천히 아래로 스크롤하며 경전을 읽어보세요.<br />
              화면 아래의 버튼을 누르면 문장이 낭독됩니다.
            </p>
            <ul className="list-none space-y-1 pl-1 text-base">
              <li className="flex items-start"><span className="mr-2">-</span> 좌측 상단에서 경전 선택 / 문장 검색</li>
              <li className="flex items-start"><span className="mr-2">-</span> 우측 상단 가 버튼으로 글자 크기 조절</li>
              <li className="flex items-start"><span className="mr-2">-</span> 문장을 책갈피에 저장 가능</li>
              <li className="flex items-start"><span className="mr-2">-</span> 재생 버튼으로 문장을 낭독</li>
            </ul>
          </div>

        {/* 문단/문장 렌더링 (원본 유지) */}
        {displayParagraphs.map((paragraphSentences, pIdx) => ( // 변수명 수정: sentences -> paragraphSentences
          <div key={pIdx} className="mb-6">
            {paragraphSentences.map((s, i) => { // 변수명 수정: sentences -> paragraphSentences
              // globalIndex 계산 로직 원본 유지
              const globalIndex = displayParagraphs.slice(0, pIdx).flat().length + i;
              return (
                <span
                  key={globalIndex}
                  data-index={globalIndex}
                  ref={(el) => { sentenceRefs.current[globalIndex] = el }}
                  className={`block px-1 rounded-lg transition-colors duration-150 ${globalIndex === currentIndex ? 'bg-amber-200' : ''} 
                  ${bookmarkedIndexes.includes(globalIndex) 
                    ? 'underline decoration-red decoration-2 underline-offset-4' : ''}`}
                >
                  {s}
                </span>
              );
            })}
          </div>
        ))}
      </div>

      {/* === 플레이어 렌더링 호출 수정 === */}
      {ttsSentences.length > 0 && renderPlayer()}
      {/* 기존 코드 제거:
      {ttsSentences.length > 0 && (
        <TTSPlayer
          sentences={ttsSentences}
          scriptureName={formatDisplayTitle(selected)}
          currentIndex={currentIndex}
          setCurrentIndex={setCurrentIndex}
          smoothCenter={smoothCenter}
          onPlaybackStateChange={setIsTTSSpeaking}
        />
      )}
      */}
      {/* === === */}


      {/* 모달 (원본 유지) */}
      {showModal && (
        <ScriptureModal
          selected={selected} setSelected={setSelected} onClose={() => setShowModal(false)}
          search={search} setSearch={setSearch} modalTab={modalTab} setModalTab={setModalTab}
          groupedTitles={groupedTitles} usedInitials={usedInitials} initialFilter={initialFilter} setInitialFilter={setInitialFilter}
          expandedBase={expandedBase} setExpandedBase={setExpandedBase} formatDisplayTitle={formatDisplayTitle}
          getChosung={getChosung} globalResults={globalResults} handleGlobalSearch={handleGlobalSearch}
          setCurrentIndex={setCurrentIndex} smoothCenter={smoothCenter} isSearching={isSearching}
          sentenceRefs={sentenceRefs} setBookmarkPending={setBookmarkPending} displaySentences={displaySentences}
          setShowModal={setShowModal}
        />
      )}

      {/* 메시지 표시 (원본 유지) */}
      {showMessage && (
        <div onClick={() => setShowMessage(false)} className="fixed inset-0 z-[200] bg-black/30 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white px-6 py-4 rounded-2xl shadow-lg text-center max-w-[80%]">
            <p className="whitespace-pre-wrap text-sm text-gray-800">{message}</p>
            <button onClick={() => { setShowMessage(false); if (message === '로그인 정보를 불러올 수 없습니다.') { router.push('/login'); } }}
              className="mt-4 px-4 py-1 bg-red-light text-white rounded-xl text-sm">
              확인
            </button>
          </div>
        </div>
      )}

      {/* 검색 중 로딩 표시 (원본 유지, 클래스명 원본으로 복구) */}
      {isSearching && (
        <div className="fixed inset-0 bg-red/10 backdrop-blur-xs z-[150] flex flex-col items-center justify-center">
          <Image
            src="/logo.png" alt="로딩" width={64} height={64}
            className="animate-float rounded-4xl mb-4" // 원본 클래스명 복구
          />
          <p className="text-black text-xl font-semibold">팔만대장경 전체 검색 중입니다</p>
        </div>
      )}
    </main>
  );
}