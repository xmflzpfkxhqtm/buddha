'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { useBookmarkStore } from '../../stores/useBookmarkStore';
import { supabase } from '@/lib/supabaseClient';

export default function ScripturePage() {
  const [list, setList] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  const [displaySentences, setDisplaySentences] = useState<string[]>([]);
  const [ttsSentences, setTtsSentences] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>('lg');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [showMessage, setShowMessage] = useState(false);
  const [bookmarkPending, setBookmarkPending] = useState<{ title: string; index: number } | null>(null);

  const sentenceRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const indexRef = useRef(currentIndex);

  const { title, index, clearBookmark } = useBookmarkStore();

  // 유저 정보 로드
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.id) setUserId(data.user.id);
    });
  }, []);

  useEffect(() => {
    indexRef.current = currentIndex;
  }, [currentIndex]);

  // 1. 경전 목록 불러오기
  useEffect(() => {
    fetch('/api/scripture/list')
      .then(res => res.json())
      .then(data => {
        setList(data.titles || []);
      });
  }, []);

  // 2. 경전 선택 로직 (목록 & 책갈피 타이틀 모두 준비된 후 실행)
  useEffect(() => {
    if (list.length === 0) return;

    if (title && list.includes(title)) {
      setBookmarkPending({ title, index: index ?? 0 });
      setSelected(title); // 책갈피 타이틀 적용
    } else if (!selected && list.length > 0) {
      setSelected(list[0]); // 기본값
    }
  }, [list, title]);

  // 3. 선택된 경전의 본문 불러오기
  useEffect(() => {
    if (!selected) return;
    fetch(`/api/scripture?title=${encodeURIComponent(selected)}`)
      .then(res => res.json())
      .then(data => {
        const full = data.content || '경전을 불러올 수 없습니다.';
        const display = full.match(/[^.!?\n]+[.!?\n]*/g) || [full];
        const tts = display.map((s: string) => s.replace(/\([^\)]*\)/g, ''));
        setDisplaySentences(display);
        setTtsSentences(tts);
        setCurrentIndex(0);
        sentenceRefs.current = Array(display.length).fill(null);
      });
  }, [selected]);

  // 4. displaySentences 준비 후 index 적용 (책갈피)
  useEffect(() => {
    if (
      bookmarkPending &&
      selected === bookmarkPending.title &&
      displaySentences.length > 0
    ) {
      setCurrentIndex(bookmarkPending.index);
      setTimeout(() => {
        sentenceRefs.current[bookmarkPending.index]?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 500);
      clearBookmark();
      setBookmarkPending(null);
    }
  }, [bookmarkPending, selected, displaySentences, clearBookmark]);

  // 5. IntersectionObserver 설정
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
    }, { threshold: 0.1, rootMargin: '0px 0px -80% 0px' });

    setTimeout(() => {
      sentenceRefs.current.forEach(el => el && observerRef.current?.observe(el));
    }, 100);

    return () => observerRef.current?.disconnect();
  }, [selected, displaySentences, isSpeaking]);

  // 6. 현재 인덱스 문장 자동 스크롤
  useEffect(() => {
    if (isSpeaking && sentenceRefs.current[currentIndex]) {
      sentenceRefs.current[currentIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, [currentIndex, isSpeaking]);

  // 경전 바뀌면 재생 중지
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsSpeaking(false);
  }, [selected]);

  // 페이지 이탈 시 재생 중지
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsSpeaking(false);
    };
  }, []);

  // TTS 중 스크롤 방지
  useEffect(() => {
    document.body.style.overflow = isSpeaking ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isSpeaking]);

  const handlePlay = () => {
    if (isSpeaking) {
      audioRef.current?.pause();
      setIsSpeaking(false);
      return;
    }
    if (!ttsSentences.length) return;
  
    let index = currentIndex;
    setIsSpeaking(true);
  
    const fetchTTS = async (text: string, retry = true): Promise<string | null> => {
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        const data = await res.json();
        if (data.audioContent) return data.audioContent;
        if (retry) {
          console.warn('TTS 재시도 중:', text);
          return fetchTTS(text, false);
        }
        console.error('TTS 실패:', text);
        return null;
      } catch (e) {
        console.error('TTS fetch 에러:', e);
        return null;
      }
    };
  
    const playSentence = async () => {
      if (index >= ttsSentences.length) {
        setIsSpeaking(false);
        return;
      }
  
      setCurrentIndex(index);
      console.log('재생 시작:', index, ttsSentences[index]);
  
      const audioBase64 = await fetchTTS(ttsSentences[index]);
      if (!audioBase64) {
        setIsSpeaking(false);
        return;
      }
  
      const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
      audioRef.current = audio;
  
      // ✅ onended에서는 다음 문장 재생만 큐에 넣는다 (async 없이!)
      audio.onended = () => {
        index++;
        setTimeout(playSentence, 300);
      };
  
      try {
        await audio.play();
      } catch (e) {
        console.error('오디오 재생 실패:', e);
        setIsSpeaking(false);
      }
    };
  
    playSentence();
  };
  
  const cycleFontSize = () => setFontSize(prev => (prev === 'sm' ? 'base' : prev === 'base' ? 'lg' : 'sm'));
  const fontSizeClass = { sm: 'text-sm', base: 'text-base', lg: 'text-lg' }[fontSize];

  const handleSelect = (title: string) => {
    setSelected(title);
    setShowModal(false);
    window.scrollTo({ top: 0 });
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
    if (!error) {
      setMessage('책갈피가 저장되었습니다.\n내 정보에서 다시 확인하실 수 있습니다.');
    } else if (error.code === '23505') {
      setMessage('이미 저장한 구절입니다.');
    } else {
      setMessage('저장에 실패했습니다.');
      console.error('북마크 저장 에러:', error);
    }
    setShowMessage(true);
  };
  
  return (
    <main className="p-4 pb-[120px] max-w-[430px] mx-auto relative">
      {/* 상단 바 */}
      <div className="sticky top-0 z-50 bg-white h-16 py-2">
        <div className="flex items-center justify-between gap-2">
          <div onClick={() => setShowModal(true)} className="cursor-pointer flex items-center max-w-[140px]">
            <span className="text-base font-semibold text-red-dark truncate">{selected}</span>
            <span className="ml-1 text-base text-red-light">⏷</span>
          </div>
          <span className="text-sm text-red-dark">{`${currentIndex + 1} / ${displaySentences.length}`}</span>
          <div className="flex items-center gap-2">
            <button onClick={handleBookmark} className="w-24 h-9 bg-red-light text-white rounded-lg font-semibold flex items-center justify-center">
              책갈피 저장
            </button>
            <button onClick={cycleFontSize} className="w-9 h-9 bg-red-light text-white rounded-lg flex items-center justify-center">
              {fontSize === 'sm' && '가'}
              {fontSize === 'base' && <span className="text-lg">가</span>}
              {fontSize === 'lg' && <span className="text-xl font-semibold">가</span>}
            </button>
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className={`whitespace-pre-wrap font-maruburi bg-white rounded-xl ${fontSizeClass}`}>
        {displaySentences.map((s, i) => (
          <span
            key={i}
            data-index={i}
            ref={(el) => { sentenceRefs.current[i] = el; }}
            className={`block scroll-mt-[128px] ${
              i === currentIndex
                ? isSpeaking
                  ? 'bg-green-200'
                  : 'bg-amber-200'
                : ''
            }`}
          >
            {s}
          </span>
        ))}
      </div>

      {/* 재생 버튼 */}
      <button
        onClick={handlePlay}
        className="fixed bottom-[84px] left-1/2 -translate-x-1/2 bg-red-light text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg z-50"
      >
        {isSpeaking ? <Pause size={32} /> : <Play size={32} />}
      </button>

      {/* 경전 선택 모달 */}
      {showModal && (
        <div onClick={() => setShowModal(false)} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[100] flex items-end justify-center">
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-t-2xl p-4 h-[80vh] overflow-y-auto w-full max-w-md animate-slide-up">
            <input
              placeholder="경전 검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full mb-4 px-4 py-2 border rounded-lg"
            />
            <ul>
              {list.filter(t => t.includes(search)).map(title => (
                <li key={title}>
                  <button onClick={() => handleSelect(title)} className="w-full text-left px-4 py-2 hover:bg-gray-100">
                    {title}
                  </button>
                </li>
              ))}
            </ul>
            <button onClick={() => setShowModal(false)} className="mt-4 w-full py-2 bg-red-light text-white rounded-lg">닫기</button>
          </div>
        </div>
      )}

      {/* 메시지 모달 */}
      {showMessage && (
        <div onClick={() => setShowMessage(false)} className="fixed inset-0 z-[200] bg-black/30 backdrop-blur-sm flex items-center justify-center">
          <div onClick={(e) => e.stopPropagation()} className="bg-white px-6 py-4 rounded-2xl shadow-lg text-center max-w-[80%]">
            <p className="whitespace-pre-wrap text-sm text-gray-800">{message}</p>
            <button onClick={() => setShowMessage(false)} className="mt-4 px-4 py-1 bg-red-light text-white rounded-xl text-sm">
              확인
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
