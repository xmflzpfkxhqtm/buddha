'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Capacitor, registerPlugin, PluginListenerHandle } from '@capacitor/core';

interface SpeakOptions {
  text: string;
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  category?: string;
}

/* -------------------------------------------------------------------------- */
/* MusicControls 타입 -------------------------------------------------------- */
interface MusicControlsPlugin {
  create(options: {
    track: string;
    artist: string;
    album?: string;
    isPlaying: boolean;
    dismissable: boolean;
    hasPrev: boolean;
    hasNext: boolean;
  }): Promise<void>;
  updateIsPlaying(options: { isPlaying: boolean }): Promise<void>;
  destroy(): Promise<void>;
  addListener(
    eventName: 'controlsNotification',
    callback: (info: MusicControlsNotification) => void
  ): Promise<PluginListenerHandle>;
}
const MusicControls = registerPlugin<MusicControlsPlugin>('MusicControls');

interface MusicControlsNotification {
  action:
    | 'music-controls-next'
    | 'music-controls-previous'
    | 'music-controls-pause'
    | 'music-controls-play'
    | 'music-controls-stop'
    | 'music-controls-destroy';
}

/* -------------------------------------------------------------------------- */
/* Props -------------------------------------------------------------------- */
interface TTSPlayerProps {
  sentences: string[];
  scriptureName: string;
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  onPlaybackStateChange?: (isPlaying: boolean) => void;
  smoothCenter: (index: number) => void;
}

/* -------------------------------------------------------------------------- */
/* iOS-Web: voice 로드 대기 util -------------------------------------------- */
const waitUntilVoicesReady = (): Promise<void> => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return Promise.resolve();
  if (speechSynthesis.getVoices().length) return Promise.resolve();

  return new Promise((res) => {
    const int = setInterval(() => {
      if (speechSynthesis.getVoices().length) {
        clearInterval(int);
        res();
      }
    }, 50);
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
  scriptureName,
  currentIndex: externalIndex,
  setCurrentIndex,
  onPlaybackStateChange,
  smoothCenter,
}) => {
  /* ------------------------------ state / refs ---------------------------- */
  const [isSpeaking, setIsSpeaking] = useState(false);

  const synth = useRef<SpeechSynthesis | null>(null);
  const currentUtterance = useRef<SpeechSynthesisUtterance | null>(null);

  const stopRequested = useRef(false);
  const internalIndex = useRef(externalIndex);

  const musicReady = useRef(false);
  const listenerHandle = useRef<PluginListenerHandle | null>(null);

  const platform = Capacitor.getPlatform();
  const isNative = platform !== 'web';
  const isIOSWeb = !isNative && /iPad|iPhone|iPod/.test(navigator.userAgent);

  const mounted = useRef(false);

  /* -------------------------- MusicControls helpers ----------------------- */
  const createMusicControls = useCallback(async () => {
    if (!isNative || musicReady.current) return;

    await MusicControls.create({
      track: scriptureName || '경전 낭독',
      artist: '연등',
      isPlaying: false,
      dismissable: false,
      hasPrev: internalIndex.current > 0,
      hasNext: internalIndex.current < sentences.length - 1,
    });
    musicReady.current = true;
  }, [isNative, scriptureName, sentences.length]);

  const setMusicControlsPlaying = useCallback(
    async (playing: boolean) => {
      if (isNative && musicReady.current) {
        await MusicControls.updateIsPlaying({ isPlaying: playing }).catch(() => {});
      }
    },
    [isNative]
  );

  /* ----------------------------- Speech helpers --------------------------- */
  const getTtsSettings = () => {
    if (isNative) {
      return Capacitor.getPlatform() === 'android'
        ? { rate: 1.0, pitch: 0.5 }
        : { rate: 1.0, pitch: 0.7 };
    }
    return { rate: 0.9, pitch: 0.7 };
  };

  const cancelWebUtterance = () => {
    if (currentUtterance.current) {
      currentUtterance.current.onend = null;
      currentUtterance.current.onerror = null;
    }
    currentUtterance.current = null;
    synth.current?.cancel();
  };

  const stopSpeech = useCallback(
    async (syncParent = true) => {
      stopRequested.current = true;

      if (isNative) {
        await TextToSpeech.stop().catch(() => {});
      } else {
        cancelWebUtterance();
      }

      setIsSpeaking(false);
      await setMusicControlsPlaying(false);
      KeepAwake.allowSleep().catch(() => {});

      if (syncParent) setCurrentIndex(internalIndex.current);
    },
    [isNative, setCurrentIndex, setMusicControlsPlaying]
  );

  /* ------------------------------ speakText ------------------------------- */
  const speakText = useCallback(
    async (text: string, index: number, onDone: () => void) => {
      if (!mounted.current || stopRequested.current || !text.trim()) return;

      internalIndex.current = index;
      setCurrentIndex(index);
      smoothCenter(index);
      setIsSpeaking(true);

      try {
        if (isNative) {
          await createMusicControls();
          await setMusicControlsPlaying(true);

          const { rate, pitch } = getTtsSettings();
          await TextToSpeech.speak({
            text,
            lang: 'ko-KR',
            rate,
            pitch,
            volume: 1.0,
            category: 'ambient',
          });
          if (!stopRequested.current && mounted.current) onDone();
        } else {
          if (!synth.current) return;
          const utter = new SpeechSynthesisUtterance(text);
          currentUtterance.current = utter;
          Object.assign(utter, getTtsSettings());
          utter.lang = 'ko-KR';
          utter.onend = () => {
            currentUtterance.current = null;
            if (!stopRequested.current && mounted.current) onDone();
          };
          utter.onerror = () => {
            currentUtterance.current = null;
            stopSpeech(true);
          };
          synth.current.speak(utter);
        }
      } catch (e) {
        console.error('[TTS] speak error', e);
        stopSpeech(true);
      }
    },
    [createMusicControls, setMusicControlsPlaying, getTtsSettings, isNative, setCurrentIndex, smoothCenter, stopSpeech]
  );

  /* --------------------------- playFrom (재귀) ----------------------------- */
  const playFrom = useCallback(
    (idx: number) => {
      if (!mounted.current || stopRequested.current) return;
      if (idx >= sentences.length) {
        stopSpeech(true);
        return;
      }
      const txt = sentences[idx];
      if (!txt.trim()) {
        playFrom(idx + 1);
        return;
      }
      speakText(txt, idx, () => playFrom(idx + 1));
    },
    [sentences, speakText, stopSpeech]
  );

  /* --------------------------- 핸들러들 ------------------------------------ */
  const handlePlayPause = useCallback(async () => {
    if (isSpeaking) {
      stopSpeech(true);
    } else {
      stopRequested.current = false;
      KeepAwake.keepAwake().catch(() => {});

      if (isNative) {
        await createMusicControls();
        await setMusicControlsPlaying(true);
      } else if (isIOSWeb) {
        await waitUntilVoicesReady();
      }
      playFrom(internalIndex.current);
    }
  }, [isSpeaking, isNative, isIOSWeb, createMusicControls, setMusicControlsPlaying, playFrom, stopSpeech]);

  /* ----------------------------- skip (fixed) ----------------------------- */
  const skip = useCallback(
    async (direction: 1 | -1) => {
      const nextIndex = internalIndex.current + direction;
      if (nextIndex < 0 || nextIndex >= sentences.length) return;

      const wasSpeaking = isSpeaking;

      /* 1️⃣ onDone 재귀를 막기 위해 먼저 true */
      stopRequested.current = true;

      if (isNative) {
        await TextToSpeech.stop().catch(() => {});
      } else {
        cancelWebUtterance();
      }

      /* 2️⃣ 위치 / UI 동기화 */
      internalIndex.current = nextIndex;
      setCurrentIndex(nextIndex);
      smoothCenter(nextIndex);

      /* 3️⃣ MusicControls hasPrev/hasNext 갱신 */
      if (isNative && musicReady.current) {
        await MusicControls.create({
          track: scriptureName || '경전 낭독',
          artist: '연등',
          isPlaying: wasSpeaking,
          dismissable: false,
          hasPrev: nextIndex > 0,
          hasNext: nextIndex < sentences.length - 1,
        }).catch(console.error);

        if (!wasSpeaking) await setMusicControlsPlaying(false);
      }

      /* 4️⃣ 재생 재개 필요 시 */
      if (wasSpeaking) {
        stopRequested.current = false;   // 재생 허용
        playFrom(nextIndex);
      } else {
        setIsSpeaking(false);
      }
    },
    [isNative, isSpeaking, sentences.length, scriptureName, setCurrentIndex, smoothCenter, playFrom, setMusicControlsPlaying]
  );

  /* ------------------------------- Lifecycle ------------------------------ */
  useEffect(() => {
    mounted.current = true;

    if (!isNative && 'speechSynthesis' in window) {
      synth.current = window.speechSynthesis;
      if (isIOSWeb) {
        waitUntilVoicesReady().then(() => {
          const warm = new SpeechSynthesisUtterance(' ');
          warm.volume = 0;
          synth.current!.speak(warm);
        });
      }
    }

    /* MusicControls listener */
    if (isNative) {
      MusicControls.addListener('controlsNotification', (info) => {
        if (!mounted.current) return;
        switch (info.action) {
          case 'music-controls-play':
          case 'music-controls-pause':
            handlePlayPause();
            break;
          case 'music-controls-next':
            skip(1);
            break;
          case 'music-controls-previous':
            skip(-1);
            break;
          case 'music-controls-stop':
          case 'music-controls-destroy':
            stopSpeech(true);
            break;
        }
      }).then((h) => (listenerHandle.current = h));
    }

    return () => {
      mounted.current = false;
      stopSpeech(false);
      listenerHandle.current?.remove().catch(() => {});
      if (musicReady.current) MusicControls.destroy().catch(() => {});
    };
  }, [isNative, isIOSWeb, handlePlayPause, skip, stopSpeech]);

  /* 외부 index 변경 */
  useEffect(() => {
    if (externalIndex !== internalIndex.current) {
      if (isSpeaking) stopSpeech(false);
      internalIndex.current = externalIndex;
    }
  }, [externalIndex, isSpeaking, stopSpeech]);

  useEffect(() => {
    onPlaybackStateChange?.(isSpeaking);
  }, [isSpeaking, onPlaybackStateChange]);

  /* ------------------------------- UI ------------------------------------- */
  return (
    <div className="fixed bottom-[84px] left-1/2 -translate-x-1/2 flex items-center gap-4 z-50">
      <button
        onClick={() => skip(-1)}
        disabled={internalIndex.current <= 0}
        aria-label="이전 문장"
        className="bg-red-light text-white rounded-full w-12 h-12 flex items-center justify-center shadow-md disabled:opacity-50"
      >
        <SkipBack size={24} />
      </button>

      <button
        onClick={handlePlayPause}
        disabled={!sentences.length}
        aria-label={isSpeaking ? '일시정지' : '재생'}
        className="bg-red-light text-white rounded-full w-16 h-16 flex items-center justify-center shadow-lg disabled:opacity-50"
      >
        {isSpeaking ? <Pause size={36} /> : <Play size={36} fill="currentColor" />}
      </button>

      <button
        onClick={() => skip(1)}
        disabled={internalIndex.current >= sentences.length - 1}
        aria-label="다음 문장"
        className="bg-red-light text-white rounded-full w-12 h-12 flex items-center justify-center shadow-md disabled:opacity-50"
      >
        <SkipForward size={24} />
      </button>
    </div>
  );
};

export default TTSPlayer;
