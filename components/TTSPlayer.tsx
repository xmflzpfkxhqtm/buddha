'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Capacitor } from '@capacitor/core';

/* -------------------------------------------------------------------------- */
/* Props -------------------------------------------------------------------- */
interface TTSPlayerProps {
  sentences: string[];
  scriptureName: string;              // (지금은 화면용만, 컨트롤 제거했으므로 사용 X)
  currentIndex: number;
  setCurrentIndex: (idx: number) => void;
  onPlaybackStateChange?: (playing: boolean) => void;
  smoothCenter: (idx: number) => void;
}

/* -------------------------------------------------------------------------- */
/* iOS-Web: voices 로드 대기 util ------------------------------------------ */
const waitUntilVoicesReady = (): Promise<void> => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return Promise.resolve();
  if (speechSynthesis.getVoices().length) return Promise.resolve();

  return new Promise((res) => {
    const int = setInterval(() => {
      if (speechSynthesis.getVoices().length) {
        clearInterval(int);
        res();
      }
    }, 60);
    speechSynthesis.addEventListener('voiceschanged', () => {
      clearInterval(int);
      res();
    }, { once: true });
  });
};

/* -------------------------------------------------------------------------- */
/* Component ---------------------------------------------------------------- */
const TTSPlayer: React.FC<TTSPlayerProps> = ({
  sentences,
  currentIndex: externalIndex,
  setCurrentIndex,
  onPlaybackStateChange,
  smoothCenter,
}) => {
  /* ------------------------------ state / refs --------------------------- */
  const [isSpeaking, setIsSpeaking] = useState(false);

  const synth = useRef<SpeechSynthesis | null>(null);
  const currentUtterance = useRef<SpeechSynthesisUtterance | null>(null);

  const stopRequested = useRef(false);
  const internalIndex = useRef(externalIndex);

  const playGeneration = useRef(0);         // 동시 재귀 차단용

  const platform = Capacitor.getPlatform();
  const isNative = platform !== 'web';
  const isIOSWeb = !isNative && /iPad|iPhone|iPod/.test(navigator.userAgent);

  const mounted = useRef(false);

  /* ----------------------------- helper funcs ---------------------------- */
  const getTtsSettings = () => {
    if (isNative) {
      return platform === 'android'
        ? { rate: 1.0, pitch: 0.5 }
        : { rate: 0.8, pitch: 0.5 };
    }
    return { rate: 0.9, pitch: 0.5 };
  };

  const cancelWebUtterance = () => {
    if (currentUtterance.current) {
      currentUtterance.current.onend = null;
      currentUtterance.current.onerror = null;
      currentUtterance.current = null;
    }
    synth.current?.cancel();
  };

  const stopSpeech = useCallback(async (syncParent = true) => {
    if (!mounted.current) return;

    stopRequested.current = true;
    playGeneration.current += 1;       // 이전 재귀 무효화

    if (isNative) {
      try { await TextToSpeech.stop(); } catch {}
    } else {
      cancelWebUtterance();
    }

    setIsSpeaking(false);
    KeepAwake.allowSleep().catch(() => {});
    if (syncParent) setCurrentIndex(internalIndex.current);
  }, [isNative, setCurrentIndex]);

  /* ----------------------------- speakText ------------------------------ */
  const speakText = useCallback(async (
    text: string,
    idx: number,
    gen: number,
    onDone: () => void
  ) => {
    if (!mounted.current || stopRequested.current || gen !== playGeneration.current) return;

    internalIndex.current = idx;
    setCurrentIndex(idx);
    smoothCenter(idx);
    setIsSpeaking(true);

    const getTtsSettings = () => {
      if (isNative) {
        return platform === 'android'
          ? { rate: 1.0, pitch: 0.5 }
          : { rate: 0.8, pitch: 0.5 };
      }
      return { rate: 0.9, pitch: 0.5 };
    };

    try {
      if (isNative) {
        const { rate, pitch } = getTtsSettings();
        await TextToSpeech.speak({ text, lang: 'ko-KR', rate, pitch, volume: 1.0 });
        if (!stopRequested.current && gen === playGeneration.current) onDone();
      } else {
        if (!synth.current) return;
        const utter = new SpeechSynthesisUtterance(text);
        currentUtterance.current = utter;
        Object.assign(utter, getTtsSettings());
        utter.lang = 'ko-KR';

        utter.onend = () => {
          currentUtterance.current = null;
          if (!stopRequested.current && gen === playGeneration.current) onDone();
        };
        utter.onerror = () => { currentUtterance.current = null; stopSpeech(true); };

        synth.current.speak(utter);
      }
    } catch (e) {
      console.error('[TTS] speak error', e);
      stopSpeech(true);
    }
  }, [isNative, setCurrentIndex, smoothCenter, stopSpeech, platform]);

  /* --------------------------- playFrom (재귀) --------------------------- */
  const playFrom = useCallback((startIdx: number, gen: number) => {
    if (!mounted.current || stopRequested.current || gen !== playGeneration.current) return;
    if (startIdx >= sentences.length) { stopSpeech(true); return; }

    const txt = sentences[startIdx];
    if (!txt.trim()) { playFrom(startIdx + 1, gen); return; }

    speakText(txt, startIdx, gen, () => playFrom(startIdx + 1, gen));
  }, [sentences, speakText, stopSpeech]);

  /* --------------------------- control handlers -------------------------- */
  const handlePlayPause = useCallback(async () => {
    if (isSpeaking) {
      stopSpeech(true);
      return;
    }

    stopRequested.current = false;
    KeepAwake.keepAwake().catch(() => {});
    playGeneration.current += 1;                  // 새 세대
    const gen = playGeneration.current;

    if (!isNative && isIOSWeb) await waitUntilVoicesReady();

    playFrom(internalIndex.current, gen);
  }, [isSpeaking, isNative, isIOSWeb, playFrom, stopSpeech]);

  const skip = useCallback(async (dir: 1 | -1) => {
    const next = internalIndex.current + dir;
    if (next < 0 || next >= sentences.length) return;

    const wasPlaying = isSpeaking;
    playGeneration.current += 1;                  // 새 세대
    const gen = playGeneration.current;

    if (isNative) { await TextToSpeech.stop().catch(() => {}); }
    else cancelWebUtterance();

    internalIndex.current = next;
    setCurrentIndex(next);
    smoothCenter(next);
    stopRequested.current = false;

    if (wasPlaying) playFrom(next, gen);
    else            setIsSpeaking(false);
  }, [isNative, sentences.length, isSpeaking, setCurrentIndex, smoothCenter, playFrom]);

  /* ------------------------------ lifecycle ------------------------------ */
  useEffect(() => {
    mounted.current = true;

    if (!isNative && 'speechSynthesis' in window) {
      synth.current = window.speechSynthesis;
      if (isIOSWeb) {
        waitUntilVoicesReady().then(() => {
          try { const warm = new SpeechSynthesisUtterance(' '); warm.volume = 0; synth.current!.speak(warm); } catch {}
        });
      }
    }
    return () => {
      mounted.current = false;
      stopSpeech(false);
      if (synth.current) synth.current.cancel();
    };
  }, [isNative, isIOSWeb, stopSpeech]);

  /* 외부 인덱스 변경 */
  useEffect(() => {
    if (externalIndex !== internalIndex.current) {
      if (isSpeaking) stopSpeech(false);
      internalIndex.current = externalIndex;
    }
  }, [externalIndex, isSpeaking, stopSpeech]);

  useEffect(() => { onPlaybackStateChange?.(isSpeaking); }, [isSpeaking, onPlaybackStateChange]);

  /* -------------------------------- UI ----------------------------------- */
  return (
    <div className="fixed bottom-[84px] left-1/2 -translate-x-1/2 flex items-center gap-4 z-50">
      <button
        onClick={() => skip(-1)}
        disabled={internalIndex.current <= 0}
        className="bg-red-light text-white rounded-full w-12 h-12 flex items-center justify-center shadow-md disabled:opacity-50"
        aria-label="이전 문장"
      >
        <SkipBack size={24} />
      </button>

      <button
        onClick={handlePlayPause}
        disabled={!sentences.length}
        className="bg-red-light text-white rounded-full w-16 h-16 flex items-center justify-center shadow-lg disabled:opacity-50"
        aria-label={isSpeaking ? '일시정지' : '재생'}
      >
        {isSpeaking ? <Pause size={36} /> : <Play size={36} fill="currentColor" />}
      </button>

      <button
        onClick={() => skip(1)}
        disabled={internalIndex.current >= sentences.length - 1}
        className="bg-red-light text-white rounded-full w-12 h-12 flex items-center justify-center shadow-md disabled:opacity-50"
        aria-label="다음 문장"
      >
        <SkipForward size={24} />
      </button>
    </div>
  );
};

export default TTSPlayer;
