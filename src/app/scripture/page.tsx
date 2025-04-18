'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';

export default function ScripturePage() {
  const [list, setList] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  const [todayScripture, setTodayScripture] = useState('');
  const [content, setContent] = useState('');
  const [sentences, setSentences] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [savedIndex, setSavedIndex] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>('lg');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const fetchList = async () => {
      const res = await fetch('/api/scripture/list');
      const data = await res.json();
      if (data.titles) {
        setList(data.titles);

        const preferred = ['경율이상_GPT4.1번역', '보운경_GPT4.1번역', '승가타경_GPT4.1번역'];
        const availablePreferred = preferred.filter((title) => data.titles.includes(title));
        const today =
          availablePreferred.length > 0
            ? availablePreferred[Math.floor(Math.random() * availablePreferred.length)]
            : data.titles[0];

        setTodayScripture(today);
        setSelected(today);
      }
    };
    fetchList();
  }, []);

  useEffect(() => {
    if (!selected) return;
    const fetchContent = async () => {
      const res = await fetch(`/api/scripture?title=${encodeURIComponent(selected)}`);
      const data = await res.json();
      const fullContent = data.content || '경전을 불러올 수 없습니다.';
      setContent(fullContent);

      const splitSentences = fullContent.match(/[^.!?\n]+[.!?\n]*/g) || [fullContent];
      setSentences(splitSentences);
    };
    fetchContent();
  }, [selected]);

  const handleSelect = (title: string) => {
    setSelected(title);
    setShowModal(false);
    setSavedIndex(null);
  };

  const filteredList = list.filter((title) =>
    title.toLowerCase().includes(search.toLowerCase())
  );

  const fontSizeClass = {
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
  }[fontSize];

  const cycleFontSize = () => {
    setFontSize((prev) => (prev === 'sm' ? 'base' : prev === 'base' ? 'lg' : 'sm'));
  };

  const handlePlay = async () => {
    if (isSpeaking) {
      audioRef.current?.pause();
      setIsSpeaking(false);
      setSavedIndex(currentIndex);
      return;
    }

    if (!sentences.length) return;

    let index = savedIndex ?? 0;
    setIsSpeaking(true);

    const playNext = async () => {
      if (index >= sentences.length) {
        setIsSpeaking(false);
        setCurrentIndex(null);
        setSavedIndex(null);
        return;
      }

      setCurrentIndex(index);

      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sentences[index] }),
      });

      const data = await res.json();
      if (data.audioContent) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
        audioRef.current = audio;

        audio.onended = () => {
          setTimeout(() => {
            index++;
            playNext();
          }, 300);
        };

        audio.play();
      } else {
        setIsSpeaking(false);
        setCurrentIndex(null);
        setSavedIndex(null);
      }
    };

    playNext();
  };

  return (
    <main className="p-4 pb-[120px] max-w-[430px] mx-auto relative">
      <div className="flex items-center justify-between mb-4 gap-2">
        <div
          onClick={() => setShowModal(true)}
          className="flex items-center cursor-pointer max-w-[240px]"
        >
          <span className="text-xl font-bold text-red-dark truncate whitespace-nowrap overflow-hidden">
            {selected}
          </span>
          <span className="ml-1 text-xl text-red-light flex-shrink-0">⏷</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setSelected(todayScripture);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="h-9 px-3 py-1 rounded-lg bg-red-light text-white text-sm font-semibold hover:bg-red transition"
          >
            🪷 오늘의 경전
          </button>
          <button
            onClick={cycleFontSize}
            className="h-9 w-9 font-semibold rounded-lg bg-red-light text-white hover:bg-red transition"
          >
            {fontSize === 'sm' && <span className="text-base">가</span>}
            {fontSize === 'base' && <span className="text-lg">가</span>}
            {fontSize === 'lg' && <span className="text-2xl">가</span>}
          </button>
        </div>
      </div>

      {content && (
        <div
          className={`whitespace-pre-wrap font-maruburi font-semibold p-2 bg-white rounded-xl ${fontSizeClass}`}
        >
          {sentences.length
            ? sentences.map((s, i) => (
                <span
                  key={i}
                  className={i === currentIndex ? 'bg-yellow-200' : ''}
                >
                  {s}
                </span>
              ))
            : content}
        </div>
      )}

      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-end justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-t-2xl p-4 h-[80vh] overflow-y-auto animate-slide-up"
          >
            <h2 className="text-lg font-bold text-red-dark mb-4">📚 경전 목록</h2>
            <input
              type="text"
              placeholder="경전 이름 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full mb-4 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-light"
            />
            <ul>
              {filteredList.length > 0 ? (
                filteredList.map((title) => (
                  <li key={title}>
                    <button
                      onClick={() => handleSelect(title)}
                      className="w-full text-left font-semibold px-4 py-2 text-sm hover:bg-red-light hover:text-white rounded-lg transition"
                    >
                      {title}
                    </button>
                  </li>
                ))
              ) : (
                <p className="text-sm text-gray-500 px-4 py-2">결과 없음</p>
              )}
            </ul>
            <button
              onClick={() => setShowModal(false)}
              className="mt-4 w-full py-2 bg-red-light text-white font-semibold rounded-lg hover:bg-red transition"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      <button
        onClick={handlePlay}
        className="fixed bottom-[84px] left-1/2 transform -translate-x-1/2 bg-red-light text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:bg-red transition z-40"
      >
        {isSpeaking ? <Pause size={32} /> : <Play size={32} />}
      </button>

  

      <style jsx>{`
        .animate-slide-up {
          animation: slideUp 0.3s ease-out;
        }
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  );
}