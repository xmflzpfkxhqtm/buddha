'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { useBookmarkStore } from '../../stores/useBookmarkStore';
import { supabase } from '@/lib/supabaseClient';

export default function ScripturePage() {
  const [list, setList] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  const [content, setContent] = useState('');
  const [displaySentences, setDisplaySentences] = useState<string[]>([]);
  const [ttsSentences, setTtsSentences] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>('lg');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const sentenceRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { title, index, clearBookmark } = useBookmarkStore();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.id) {
        setUserId(data.user.id);
      }
    });
  }, []);

  useEffect(() => {
    fetch('/api/scripture/list')
      .then(res => res.json())
      .then(data => {
        setList(data.titles || []);
        if (title) {
          setSelected(title);
        } else if (data.titles.length > 0) {
          setSelected(data.titles[0]);
        }
      });
  }, [title]);

  useEffect(() => {
    if (!selected) return;
    fetch(`/api/scripture?title=${encodeURIComponent(selected)}`)
      .then(res => res.json())
      .then(data => {
        const full = data.content || '경전을 불러올 수 없습니다.';
        const display = full.match(/[^.!?\n]+[.!?\n]*/g) || [full];
        const tts = display.map(s => s.replace(/\([^\)]*\)/g, ''));

        setContent(full);
        setDisplaySentences(display);
        setTtsSentences(tts);
        setCurrentIndex(0);
        sentenceRefs.current = Array(display.length).fill(null);
      });
  }, [selected]);

  useEffect(() => {
    if (index !== null && displaySentences.length > 0) {
      setCurrentIndex(index);
      setTimeout(() => {
        sentenceRefs.current[index]?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 500);
      clearBookmark();
    }
  }, [index, displaySentences]);

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
    }, { threshold: 0.1, rootMargin: '0px 0px -90% 0px' });

    setTimeout(() => {
      sentenceRefs.current.forEach(el => el && observerRef.current?.observe(el));
    }, 100);

    return () => observerRef.current?.disconnect();
  }, [selected, displaySentences, isSpeaking]);

  useEffect(() => {
    if (isSpeaking && sentenceRefs.current[currentIndex]) {
      sentenceRefs.current[currentIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, [currentIndex, isSpeaking]);

  const handlePlay = () => {
    if (isSpeaking) {
      audioRef.current?.pause();
      setIsSpeaking(false);
      return;
    }
    if (!ttsSentences.length) return;

    let index = currentIndex;
    setIsSpeaking(true);

    const playSentence = () => {
      if (index >= ttsSentences.length) {
        setIsSpeaking(false);
        return;
      }
      setCurrentIndex(index);
      fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: ttsSentences[index] }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.audioContent) {
            const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
            audioRef.current = audio;
            audio.onended = () => {
              index++;
              setTimeout(playSentence, 300);
            };
            audio.play();
          } else setIsSpeaking(false);
        })
        .catch(() => setIsSpeaking(false));
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

  return (
    <main className="p-4 pb-[120px] max-w-[430px] mx-auto relative">
      <div className="sticky top-0 z-50 bg-white h-16 py-2">
        <div className="flex items-center justify-between gap-2">
          <div onClick={() => setShowModal(true)} className="cursor-pointer flex items-center max-w-[240px]">
            <span className="text-base font-semibold text-red-dark truncate">{selected}</span>
            <span className="ml-1 text-base text-red-light">⏷</span>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={async () => {
                if (!userId) {
                  alert('로그인 정보를 불러올 수 없습니다.');
                  return;
                }
                const { error } = await supabase.from('bookmarks').insert({
                  user_id: userId,
                  title: selected,
                  index: currentIndex,
                });
                if (!error) {
                  alert('책갈피가 저장되었습니다!');
                } else {
                  alert('저장에 실패했습니다.');
                  console.error('북마크 저장 에러:', error);
                }
              }}
              className="fixed bottom-[150px] right-4 bg-yellow-400 text-white px-4 py-2 rounded-lg shadow z-50"
            >
              책갈피 저장
            </button>
            <span className="w-24 h-9 bg-white text-red-dark rounded-lg flex items-center justify-end">
              {`${currentIndex + 1} / ${displaySentences.length}`}
            </span>
            <button onClick={cycleFontSize} className="w-9 h-9 bg-red-light text-white rounded-lg flex items-center justify-center">
              {fontSize === 'sm' && '가'}
              {fontSize === 'base' && <span className="text-lg">가</span>}
              {fontSize === 'lg' && <span className="text-xl">가</span>}
            </button>
          </div>
        </div>
      </div>

      <div className={`whitespace-pre-wrap font-maruburi bg-white rounded-xl ${fontSizeClass}`}>
  {displaySentences.map((s, i) => (
    <span
      key={i}
      data-index={i}
      ref={el => sentenceRefs.current[i] = el}
      className={`block scroll-mt-[64px] ${
        i === currentIndex
          ? isSpeaking
            ? 'bg-green-200'
            : 'bg-yellow-200'
          : ''
      }`}
    >
      {s}
    </span>
  ))}
</div>


      <button
        onClick={handlePlay}
        className="fixed bottom-[84px] left-1/2 -translate-x-1/2 bg-red-light text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg z-50"
      >
        {isSpeaking ? <Pause size={32} /> : <Play size={32} />}
      </button>

      {showModal && (
        <div onClick={() => setShowModal(false)} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[100] flex items-end justify-center">
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-t-2xl p-4 h-[80vh] overflow-y-auto w-full max-w-md animate-slide-up">
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
    </main>
  );
}
