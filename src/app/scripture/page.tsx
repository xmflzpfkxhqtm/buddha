// src/app/scripture/page.tsx

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useBookmarkStore } from '../../stores/useBookmarkStore';
import { supabase } from '@/lib/supabaseClient';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import ScriptureModal from '../../../components/ScriptureModal';
import TTSPlayer from '../../../components/TTSPlayer'; // TTSPlayer 컴포넌트 import

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
  return rawTitle
    .replace(/_GPT\d+(\.\d+)?번역/, '')
    .replace(/_/g, ' ');
}

export default function ScripturePage() {
  // 상태 변수들 (TTS 관련 상태 제거)
  const [isTTSSpeaking, setIsTTSSpeaking] = useState(false);
  const [displayParagraphs, setDisplayParagraphs] = useState<string[][]>([]);
  const router = useRouter();
  const [list, setList] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  const [displaySentences, setDisplaySentences] = useState<string[]>([]);
  const [ttsSentences, setTtsSentences] = useState<string[]>([]); // TTS 재생용 문장 목록
  const [currentIndex, setCurrentIndex] = useState(0); // 현재 문장 인덱스
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

  const { title, index, clearBookmark } = useBookmarkStore();

  // 스크롤 함수 (useCallback으로 메모이제이션)
  const smoothCenter = useCallback((idx: number, instant = false) => {
    sentenceRefs.current[idx]?.scrollIntoView({
      block: 'center',
      inline: 'nearest',
      behavior: instant ? 'instant' : 'smooth',
    });
  }, []); // 의존성 없음

  // 사용자 정보 로딩
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.id) setUserId(data.user.id);
    });
  }, []);

  // 제목 그룹핑 관련 함수 (변경 없음)
  const groupTitlesByBaseName = (titles: string[]) => {
    const map: Record<string, string[]> = {};
    titles.forEach((title) => {
      const base = title.split('_')[0];
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

  // 경전 목록 로딩
  useEffect(() => {
    fetch('/api/scripture/list')
      .then(res => res.json())
      .then(data => {
        const titles: string[] = data.titles || [];
        setList(titles);
        setGroupedTitles(groupTitlesByBaseName(titles));
      });
  }, []);

  // 북마크 로딩
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

  // 초기 경전 선택 및 북마크 이동 처리
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
  }, [list, title, index, selected]); // 의존성 배열 확인

  // 경전 내용 로딩
  useEffect(() => {
    if (!selected || list.length === 0) return;
    const loadScripture = async () => {
      const actual = resolveActualTitle(selected, list);
       // 경전 변경 시 인덱스 0으로 초기화 (기존 stopTTS 호출 부분 제거)
      setCurrentIndex(0);
      window.scrollTo({ top: 0, behavior: 'instant' });
      setBookmarkedIndexes([]); // 북마크도 초기화 후 다시 로드

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
        const tts = flatSentences.map((s: string) => s.replace(/\([^\)]*\)/g, ''));
        setTtsSentences(tts);
        sentenceRefs.current = Array(flatSentences.length).fill(null);
      } else {
        setDisplaySentences(['해당 경전을 불러올 수 없습니다.']);
        setTtsSentences([]);
        setDisplayParagraphs([]);
      }
    };
    loadScripture();
  }, [selected, list]); // 의존성 배열 확인

  // 모달 탭 변경 시 처리
  useEffect(() => {
    if (modalTab !== 'global' && isSearching) {
      setIsSearching(false);
    }
  }, [modalTab, isSearching]);

  // 모달 탭 변경 시 검색어 초기화
  useEffect(() => {
    setSearch('');
  }, [modalTab]);

  // 북마크 이동 최종 처리
  useEffect(() => {
    if (
      bookmarkPending &&
      selected === bookmarkPending.title &&
      displaySentences.length > 0
    ) {
      console.log('✅ Bookmark Pending 처리:', bookmarkPending);
      // setCurrentIndex는 bookmarkPending 설정 시 이미 되었을 수 있으므로, 스크롤만 확실히
      setTimeout(() => {
        smoothCenter(bookmarkPending.index, true);
        clearBookmark();
        setBookmarkPending(null);
      }, 200);
    }
  }, [bookmarkPending, selected, displaySentences, clearBookmark, smoothCenter]); // smoothCenter 추가

  // 스크롤 위치에 따른 현재 인덱스 동기화
  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout | null = null;
    // isSpeaking 상태를 TTSPlayer로부터 받아오지 않으므로, 스크롤 시 인덱스 변경 허용
    const onScroll = () => {
      if (isTTSSpeaking) {
        // console.log('[Scroll Sync] TTS is speaking, ignoring scroll sync.');
        return;
      }

      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
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

        // currentIndex와 다를 때만 업데이트
        if (closestIndex !== -1 && closestIndex !== currentIndex) {
          console.log(`[Scroll Sync] Setting index to ${closestIndex}`);
          setCurrentIndex(closestIndex);
        }
      }, 150);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, [currentIndex, isTTSSpeaking]);

  // 북마크 핸들러 (변경 없음)
  const handleBookmark = async () => {
    if (!userId) {
      setMessage('로그인 정보를 불러올 수 없습니다.');
      setShowMessage(true);
      return;
    }
    if (isBookmarked) {
      const { error } = await supabase.from('bookmarks').delete().eq('user_id', userId).eq('title', selected).eq('index', currentIndex);
      if (!error) setBookmarkedIndexes((prev) => prev.filter(i => i !== currentIndex));
      setMessage(error ? '삭제 실패' : '❌ 책갈피가 삭제되었습니다.');
    } else {
      const { error } = await supabase.from('bookmarks').insert({ user_id: userId, title: selected, index: currentIndex });
      if (!error) setBookmarkedIndexes((prev) => [...prev, currentIndex]);
      setMessage(error ? '저장 실패' : '✅ 책갈피가 저장되었습니다.');
    }
    setShowMessage(true);
  };

  // 글자 크기 조절 핸들러 (변경 없음)
  const cycleFontSize = () =>
    setFontSize(prev => (prev === 'base' ? 'lg' : prev === 'lg' ? 'xl' : 'base'));

  // 전체 검색 핸들러 (변경 없음)
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
      {/* 상단 UI */}
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
            <button onClick={handleBookmark} className="w-24 h-9 bg-red-light text-white rounded-lg font-semibold">
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
        {/* 안내 문구 */}
        {currentIndex < 10 && displaySentences.length > 0 && ( // 문장 로드 후 표시
           <div style={{ minHeight: '40vh' }} className="flex flex-col justify-center gap-3 text-red-dark pt-4 pb-8"> {/* 높이 확보 및 패딩 조정 */}
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

        {/* 문단/문장 렌더링 */}
        {displayParagraphs.map((sentences, pIdx) => (
          <div key={pIdx} className="mb-6">
            {sentences.map((s, i) => {
              const globalIndex = displayParagraphs.slice(0, pIdx).flat().length + i;
              return (
                <span
                  key={globalIndex}
                  data-index={globalIndex}
                  ref={(el) => { sentenceRefs.current[globalIndex] = el }}
                  className={`block transition-colors duration-300 ${globalIndex === currentIndex ? 'bg-amber-200' : ''} ${bookmarkedIndexes.includes(globalIndex) ? 'underline' : ''}`}
                >
                  {s}
                </span>
              );
            })}
          </div>
        ))}
      </div>

      {/* TTSPlayer 컴포넌트 렌더링 */}
      {ttsSentences.length > 0 && (
        <TTSPlayer
          sentences={ttsSentences}
          currentIndex={currentIndex}
          setCurrentIndex={setCurrentIndex}
          smoothCenter={smoothCenter}
          onPlaybackStateChange={setIsTTSSpeaking}
          // onPlaybackStateChange={(playing) => console.log('TTS Playing:', playing)} // 필요시 콜백 활성화
        />
      )}

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
          setCurrentIndex={setCurrentIndex} // 검색 결과 클릭 시 인덱스 변경
          smoothCenter={smoothCenter}      // 검색 결과 클릭 시 스크롤
          isSearching={isSearching}
          sentenceRefs={sentenceRefs}
          setBookmarkPending={setBookmarkPending}
          displaySentences={displaySentences}
          setShowModal={setShowModal}
        />
      )}

      {/* 메시지 표시 */}
      {showMessage && (
        <div onClick={() => setShowMessage(false)} className="fixed inset-0 z-[200] bg-black/30 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white px-6 py-4 rounded-2xl shadow-lg text-center max-w-[80%]">
            <p className="whitespace-pre-wrap text-sm text-gray-800">{message}</p>
            <button
              onClick={() => {
                setShowMessage(false);
                if (message === '로그인 정보를 불러올 수 없습니다.') {
                  router.push('/login');
                }
              }}
              className="mt-4 px-4 py-1 bg-red-light text-white rounded-xl text-sm"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 검색 중 로딩 표시 */}
      {isSearching && (
        <div className="fixed inset-0 bg-red/10 backdrop-blur-xs z-[150] flex flex-col items-center justify-center">
          <Image
            src="/logo.png"
            alt="로딩"
            width={64}
            height={64}
            className="animate-float rounded-4xl mb-4" // 속성명 수정: rounded-4xl -> rounded-full 또는 다른 Tailwind 클래스
          />
          <p className="text-black text-xl font-semibold">팔만대장경 전체 검색 중입니다</p>
        </div>
      )}
    </main>
  );
}
