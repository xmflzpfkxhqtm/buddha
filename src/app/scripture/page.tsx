'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { useBookmarkStore } from '../../stores/useBookmarkStore';
import { supabase } from '@/lib/supabaseClient';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import ScriptureModal from '../../../components/ScriptureModal'; // ✅ 추가
import { KeepAwake } from '@capacitor-community/keep-awake';


interface GlobalSearchResult {
  title: string;
  index: number;
  text: string;
}

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
  const [nextAudioUrl, setNextAudioUrl] = useState<string | null>(null);
  const [nextNextAudioUrl, setNextNextAudioUrl] = useState<string | null>(null);
  
  const sentenceRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const indexRef = useRef(currentIndex);
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
        sentenceRefs.current[bookmarkPending.index]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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


const [isLocked, setIsLocked] = useState(false); // ✅ 락 추가

const stopTTS = async () => {
  if (audioRef.current) {
    audioRef.current.pause();
    audioRef.current.src = '';
    audioRef.current.load();
    audioRef.current = null;
  }
  setIsSpeaking(false); // ✅ 여기 꼭 확실히 false로 바꿔줘야 돼
  await KeepAwake.allowSleep();
};

// ✅ 언마운트 시에도 재생 정지
useEffect(() => {
  return () => { stopTTS(); };
}, []);

// ✅ selected, modalTab, showModal 바뀔 때도 재생 정지
useEffect(() => {
  stopTTS();
}, [selected, modalTab, showModal]);

const handlePlay = async () => {
  if (isSpeaking) {
    await stopTTS();
    setIsLocked(false);
    return;
  }

  if (isLocked) return;

  setIsLocked(true);
  await stopTTS();
  await KeepAwake.keepAwake();
  setIsSpeaking(true);

  let index = currentIndex;

  const fetchTTS = async (text: string, idx: number): Promise<string | null> => {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scripture_id: selected,
          line_index: idx,
          text,
        }),
      });

      const textResponse = await res.text();
      try {
        const data = JSON.parse(textResponse);
        return data.url || null;
      } catch {
        console.error('❌ JSON 파싱 실패: HTML 반환 가능성');
        console.warn(textResponse.slice(0, 100));
        return null;
      }
    } catch (err) {
      console.error('❌ fetchTTS 네트워크 오류:', err);
      return null;
    }
  };

  const fetchUntilSuccess = async (text: string, idx: number, delay = 500): Promise<string> => {
    while (true) {
      const url = await fetchTTS(text, idx);
      if (url) {
        return url;
      }
      console.warn(`⏳ fetchTTS 실패, ${delay}ms 후 재시도`);
      await new Promise(r => setTimeout(r, delay));
    }
  };
    

  // ✅ Audio가 준비될 때까지 기다리는 함수
const waitForCanPlay = (audio: HTMLAudioElement) =>
new Promise<void>((res, rej) => {
  const t = setTimeout(() => rej('timeout'), 8000); // 8초 제한
  const handler = () => {
    clearTimeout(t);
    audio.removeEventListener('canplaythrough', handler);
    res();
  };
  audio.addEventListener('canplaythrough', handler);
});


const playSentence = async () => {
  if (index >= ttsSentences.length) {
    await stopTTS();
    setIsLocked(false);
    return;
  }

  setCurrentIndex(index);
  sentenceRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const audioUrl = nextAudioUrl || await fetchUntilSuccess(ttsSentences[index], index);
  setNextAudioUrl(nextNextAudioUrl); // 👉 다음을 앞으로 당기기
  setNextNextAudioUrl(null); // 👉 초기화
  
  const audio = new Audio(audioUrl);
  audio.crossOrigin = 'anonymous'; // ✅ CORS 방지
  audio.preload = 'auto';          // ✅ Android에서 안정성↑
  audioRef.current = audio;

  try {
    await waitForCanPlay(audio);  // ✅ 재생 전 안정성 확보
    await audio.play();
    console.log('✅ 재생 성공');
  } catch (err) {
    console.warn('⚠️ 재생 실패, 건너뜀:', err);
    index++;
    await new Promise((r) => setTimeout(r, 300)); // 텀 두고
    await playSentence(); // 다음 문장 재귀 호출
    return;
  }

  // ✅ 다음 문장 preload
// 다음 문장 1개 preload
if (index + 1 < ttsSentences.length) {
  fetchUntilSuccess(ttsSentences[index + 1], index + 1).then((url) => {
    setNextAudioUrl(url);
  });
}

// 다다음 문장 preload
if (index + 2 < ttsSentences.length) {
  fetchUntilSuccess(ttsSentences[index + 2], index + 2).then((url) => {
    setNextNextAudioUrl(url);
  });
}

  audio.onended = async () => {
    console.log('✅ 재생 끝, 다음 문장');
    index++;
    await new Promise((r) => setTimeout(r, 200));
    await playSentence();
  };

  audio.onerror = async () => {
    console.error('❌ 재생 중 오류 발생, 다음 문장으로 넘어감');
    index++;
    await playSentence();
  };
};


  playSentence();
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
        <div style={{ height: '40vh' }} className="flex flex-col justify-center gap-3 bg-[#FAF5EF] text-[#6B4C3B]">
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
