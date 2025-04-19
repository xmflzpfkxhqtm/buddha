'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { useBookmarkStore } from '../../stores/useBookmarkStore';
import { supabase } from '@/lib/supabaseClient';

class TTSQueue {
  private queue: Array<{ text: string; index: number }> = [];
  private isPlaying = false;
  private audioRef: React.MutableRefObject<HTMLAudioElement | null>;
  private setCurrentIndex: (i: number) => void;
  private setIsSpeaking: (v: boolean) => void;

  constructor(
    audioRef: React.MutableRefObject<HTMLAudioElement | null>,
    setCurrentIndex: (i: number) => void,
    setIsSpeaking: (v: boolean) => void
  ) {
    this.audioRef = audioRef;
    this.setCurrentIndex = setCurrentIndex;
    this.setIsSpeaking = setIsSpeaking;
  }

  enqueueAll(sentences: string[]) {
    this.queue = sentences.map((text, index) => ({ text, index }));
    if (!this.isPlaying) this.playNext();
  }

  stop() {
    this.queue = [];
    this.isPlaying = false;
    this.audioRef.current?.pause();
    this.audioRef.current = null;
    this.setIsSpeaking(false);
  }

  private async playNext() {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      this.setIsSpeaking(false);
      return;
    }

    this.isPlaying = true;
    const { text, index } = this.queue.shift()!;
    this.setCurrentIndex(index);

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();

      if (!data.audioContent) {
        console.warn('TTS 응답 없음');
        this.playNext();
        return;
      }

      const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
      this.audioRef.current = audio;

      audio.onended = () => setTimeout(() => this.playNext(), 300);
      audio.onerror = () => this.playNext();
      await audio.play();
    } catch (err) {
      console.error('TTS fetch/play 실패', err);
      this.setIsSpeaking(false);
    }
  }
}

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

  const sentenceRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<TTSQueue | null>(null);

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
        if (title) setSelected(title);
        else if (data.titles.length > 0) setSelected(data.titles[0]);
      });
  }, [title]);

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

  useEffect(() => {
    if (index !== null && displaySentences.length > 0) {
      setCurrentIndex(index);
      setTimeout(() => {
        sentenceRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 500);
      clearBookmark();
    }
  }, [index, displaySentences, clearBookmark]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
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

  useEffect(() => {
    if (isSpeaking && sentenceRefs.current[currentIndex]) {
      sentenceRefs.current[currentIndex]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [currentIndex, isSpeaking]);

  useEffect(() => {
    queueRef.current = new TTSQueue(audioRef, setCurrentIndex, setIsSpeaking);
  }, []);

  const handlePlay = () => {
    if (isSpeaking) {
      queueRef.current?.stop();
      return;
    }
    if (!ttsSentences.length) return;
    setIsSpeaking(true);
    queueRef.current?.enqueueAll(ttsSentences);
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
    if (!error) setMessage('책갈피가 저장되었습니다.\n내 정보에서 다시 확인하실 수 있습니다.');
    else if (error.code === '23505') setMessage('이미 저장한 구절입니다.');
    else {
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
            <button onClick={handleBookmark} className="w-24 h-9 bg-red-light text-white rounded-lg font-semibold flex items-center justify-center">책갈피 저장</button>
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
              i === currentIndex ? (isSpeaking ? 'bg-green-200' : 'bg-amber-200') : ''
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

      {/* 모달, 메시지 모달 등은 기존과 동일 */}
    </main>
  );
}