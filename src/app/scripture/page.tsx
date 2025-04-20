'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { useBookmarkStore } from '../../stores/useBookmarkStore';
import { supabase } from '@/lib/supabaseClient';

interface GlobalSearchResult {
  title: string;
  index: number;
  text: string;
}

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

export default function ScripturePage() {
  const [list, setList] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  const [displaySentences, setDisplaySentences] = useState<string[]>([]);
  const [ttsSentences, setTtsSentences] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [modalTab, setModalTab] = useState<'title' | 'content' | 'global'>('title');
  const [globalResults, setGlobalResults] = useState<GlobalSearchResult[]>([]);
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>('lg');
  const fontSizeClass = { sm: 'text-sm', base: 'text-base', lg: 'text-lg' }[fontSize];
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [showMessage, setShowMessage] = useState(false);
  const [bookmarkPending, setBookmarkPending] = useState<{ title: string; index: number } | null>(null);

  const sentenceRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const indexRef = useRef(currentIndex);
  const [isSearching, setIsSearching] = useState(false);

  const { title, index, clearBookmark } = useBookmarkStore();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.id) setUserId(data.user.id);
    });
  }, []);

  useEffect(() => {
    indexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    fetch('/api/scripture/list')
      .then(res => res.json())
      .then(data => setList(data.titles || []));
  }, []);

  useEffect(() => {
    if (list.length === 0) return;

    if (title && list.length > 0 && selected !== title) {
      setBookmarkPending({ title, index: index ?? 0 });
      setSelected(title);
    } else if (!title && !selected && list.length > 0) {
      const defaultTitle = '금강반야바라밀경_1권_GPT4.1번역';
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
        return;
      }

      const res = await fetch(`/api/scripture?title=${encodeURIComponent(actual)}`);
      const data = await res.json();

      if (data?.content) {
        const full = data.content;
        const display = full.match(/[^.!?\n]+[.!?\n]*/g) || [full];
        const tts = display.map((s: string) => s.replace(/\([^\)]*\)/g, ''));

        setDisplaySentences(display);
        setTtsSentences(tts);
        setCurrentIndex(0);
        setSelected(actual); // ✅ fallback 적용
        sentenceRefs.current = Array(display.length).fill(null);
      } else {
        setDisplaySentences(['해당 경전을 불러올 수 없습니다.']);
        setTtsSentences([]);
      }
    };

    loadScripture();
  }, [selected, list]);

  useEffect(() => {
    if (
      bookmarkPending &&
      selected === bookmarkPending.title &&
      displaySentences.length > 0
    ) {
      setCurrentIndex(bookmarkPending.index);
      setTimeout(() => {
        sentenceRefs.current[bookmarkPending.index]?.scrollIntoView({ behavior: 'smooth' });
      }, 500);
      clearBookmark();
      setBookmarkPending(null);
    }
  }, [bookmarkPending, selected, displaySentences, clearBookmark]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(entries => {
      const visible = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible.length > 0 && !isSpeaking) {
        const topIndex = Number(visible[0].target.getAttribute('data-index'));
        if (!isNaN(topIndex)) setCurrentIndex(topIndex);
      }
    }, { threshold: 0.1, rootMargin: '0px 0px -85% 0px' });

    setTimeout(() => {
      sentenceRefs.current.forEach(el => el && observerRef.current?.observe(el));
    }, 100);

    return () => observerRef.current?.disconnect();
  }, [selected, displaySentences, isSpeaking]);

  const handlePlay = () => {
    if (isSpeaking) {
      audioRef.current?.pause();
      setIsSpeaking(false);
      return;
    }

    let index = currentIndex;
    setIsSpeaking(true);

    const fetchTTS = async (text: string): Promise<string | null> => {
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        const data = await res.json();
        return data.audioContent || null;
      } catch {
        return null;
      }
    };

    const playSentence = async () => {
      if (index >= ttsSentences.length) {
        setIsSpeaking(false);
        return;
      }

      setCurrentIndex(index);
      const audioBase64 = await fetchTTS(ttsSentences[index]);
      if (!audioBase64) {
        setIsSpeaking(false);
        return;
      }

      const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
      audioRef.current = audio;
      audio.onended = () => {
        index++;
        setTimeout(playSentence, 300);
      };

      try {
        await audio.play();
      } catch {
        setIsSpeaking(false);
      }
    };

    playSentence();
  };

  const handleBookmark = async () => {
    if (!userId) {
      setMessage('로그인 정보를 불러올 수 없습니다.');
      setShowMessage(true);
      return;
    }
    const { error } = await supabase.from('bookmarks').insert({
      user_id: userId,
      title: selected,
      index: currentIndex,
    });
    setMessage(error ? '저장 실패' : '✅ 책갈피가 저장되었습니다.');
    setShowMessage(true);
  };

  const cycleFontSize = () =>
    setFontSize(prev => (prev === 'sm' ? 'base' : prev === 'base' ? 'lg' : 'sm'));

  const handleGlobalSearch = async () => {
    setIsSearching(true);
    setGlobalResults([]);

    const results: GlobalSearchResult[] = [];

    for (const title of list) {
      const res = await fetch(`/api/scripture?title=${encodeURIComponent(title)}`);
      const json = await res.json();
      const lines = json.content.match(/[^.!?\n]+[.!?\n]*/g) || [json.content || ''];

      lines.forEach((line: string, idx: number) => {
        if (line.includes(search)) {
          results.push({ title, index: idx, text: line });
        }
      });
    }

    setGlobalResults(results);
    setIsSearching(false);
  };


  return (
    
    <main className="p-4 pb-[120px] max-w-[430px] mx-auto relative">
      {/* 상단 */}
      <div className="sticky top-0 z-50 bg-white h-16 py-2">
        <div className="flex items-center justify-between gap-2">
          <div onClick={() => setShowModal(true)} className="cursor-pointer flex items-center max-w-[140px]">
            <span className="text-base font-semibold text-red-dark truncate">{selected}</span>
            <span className="ml-1 text-base text-red-light">⏷</span>
          </div>
          <span className="text-sm text-red-dark">{`${currentIndex + 1} / ${displaySentences.length}`}</span>
          <div className="flex items-center gap-2">
            <button onClick={handleBookmark} className="w-24 h-9 bg-red-light text-white rounded-lg font-semibold">책갈피 저장</button>
            <button onClick={cycleFontSize} className="w-9 h-9 bg-red-light text-white rounded-lg">
              {fontSize === 'sm' ? '가' : fontSize === 'base' ? <span className="text-lg">가</span> : <span className="text-xl font-semibold">가</span>}
            </button>
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className={`whitespace-pre-wrap font-maruburi bg-white rounded-xl ${fontSizeClass}`}>
        {displaySentences.map((s, i) => (
          <span key={i} data-index={i} ref={(el) => { sentenceRefs.current[i] = el }}
          className={`block scroll-mt-[128px] ${i === currentIndex ? 'bg-amber-200' : ''}`}>
            {s}
          </span>
        ))}
      </div>

      {/* 재생 버튼 */}
      <button onClick={handlePlay} className="fixed bottom-[84px] left-1/2 -translate-x-1/2 bg-red-light text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg z-50">
        {isSpeaking ? <Pause size={32} /> : <Play size={32} />}
      </button>

      {/* 모달 */}
      {showModal && (
        <div onClick={() => setShowModal(false)} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[100] flex items-end justify-center">
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-t-2xl p-4 h-[80vh] overflow-y-auto w-full max-w-md">
            {/* 탭 */}
            <div className="flex mb-4">
              {(['title', 'content', 'global'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setModalTab(tab)}
                  className={`flex-1 py-2 ${modalTab === tab ? 'bg-red-light text-white' : 'bg-gray-100'} ${tab === 'title' ? 'rounded-l-xl' : tab === 'global' ? 'rounded-r-xl' : ''}`}
                >
                  {tab === 'title' ? '경전명' : tab === 'content' ? '본문검색' : '전체검색'}
                </button>
              ))}
            </div>

            {/* 검색창 */}
            <input
              placeholder="검색어 입력..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full mb-4 px-4 py-2 border rounded-lg"
            />

            {/* 전체 검색 버튼 */}

            {/* 결과 */}
            {modalTab === 'title' && (
              <ul>{list.filter(t => t.includes(search)).map(title => (
                <li key={title}><button onClick={() => { setSelected(title); setShowModal(false); }} className="w-full text-left px-4 py-2 hover:bg-gray-100">{title}</button></li>
              ))}</ul>
            )}

            {modalTab === 'content' && (
              <ul>{displaySentences.map((text, i) => ({ index: i, text })).filter(s => s.text.includes(search)).map(({ index, text }) => (
                <li key={index}>
                  <button
                    onClick={() => {
                      setCurrentIndex(index);
                      setShowModal(false);
                      setTimeout(() => sentenceRefs.current[index]?.scrollIntoView({ behavior: 'smooth' }), 300);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                  >
                    <div className="line-clamp-3">
                      <span className="text-gray-500">[{index}행]</span> {text}
                    </div>
                  </button>
                </li>
              ))}</ul>
            )}

{modalTab === 'global' && (
  <>
    {/* 검색 실행 버튼 (단 하나만!) */}
    <button
      onClick={handleGlobalSearch}
      disabled={isSearching || !search.trim()}
      className={`w-full py-2 mb-4 rounded-lg ${
        isSearching ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-red-light text-white'
      }`}
    >
      {isSearching ? '🔍 검색 중입니다...' : '전체 검색 실행'}
    </button>

    {/* 검색 중 메시지 */}
    {isSearching && (
      <p className="text-sm text-center text-gray-500 mb-4">
        모든 경전에서 해당 문장을 찾고 있어요...
      </p>
    )}

    {/* 검색 결과 리스트 */}
    <ul>
      {globalResults.map(({ title, index, text }, i) => (
        <li key={`${title}-${index}-${i}`}>
          <button
            onClick={() => {
              setSelected(title);
              setShowModal(false);
              setTimeout(() => {
                setCurrentIndex(index);
                setTimeout(() => sentenceRefs.current[index]?.scrollIntoView({ behavior: 'smooth' }), 300);
              }, 200);
            }}
            className="w-full text-left px-4 py-4 hover:bg-gray-100 text-sm"
            disabled={isSearching}
          >
            <div className="line-clamp-3">
              <span className="text-gray-500">[{title} {index + 1}행]</span> {text}
            </div>
          </button>
        </li>
      ))}
    </ul>
  </>
)}


            <button onClick={() => setShowModal(false)} className="mt-4 w-full py-2 border border-red text-red-dark rounded-lg">닫기</button>
          </div>
        </div>
      )}

      {/* 메시지 */}
      {showMessage && (
        <div onClick={() => setShowMessage(false)} className="fixed inset-0 z-[200] bg-black/30 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white px-6 py-4 rounded-2xl shadow-lg text-center max-w-[80%]">
            <p className="whitespace-pre-wrap text-sm text-gray-800">{message}</p>
            <button onClick={() => setShowMessage(false)} className="mt-4 px-4 py-1 bg-red-light text-white rounded-xl text-sm">확인</button>
          </div>
        </div>
      )}

{isSearching && (
  <div className="fixed inset-0 bg-black/30 backdrop-blur-xs z-[150] flex flex-col items-center justify-center">
    <img src="/lotusbeige.png" alt="로딩" className="w-16 h-16 animate-float mb-4" />
    <p className="text-red text-xl font-semibold">전체 검색 중입니다...</p>
  </div>
)}

    </main>
  );
}
