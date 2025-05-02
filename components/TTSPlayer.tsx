'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Capacitor, registerPlugin, PluginListenerHandle } from '@capacitor/core';

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
  updateIsPlaying(isPlaying: boolean): Promise<void>;
  destroy(): Promise<void>;
  addListener(
    eventName: string,
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
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return Promise.resolve();
  }
  if (speechSynthesis.getVoices().length) return Promise.resolve();

  return new Promise((res) => {
    const int = setInterval(() => {
      if (speechSynthesis.getVoices().length) {
        clearInterval(int);
        res();
      }
    }, 50);
    speechSynthesis.addEventListener(
      'voiceschanged',
      () => {
        clearInterval(int);
        res();
      },
      { once: true }
    );
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
  const internalIndex = useRef<number>(externalIndex);

  const musicReady = useRef(false);
  const listenerHandle = useRef<PluginListenerHandle | null>(null);

  const platform = Capacitor.getPlatform();
  const isNative = platform !== 'web';
  const isIOSWeb = !isNative && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroidWeb = !isNative && /Android/.test(navigator.userAgent);

  const mounted = useRef(false);

  /* -------------------------- MusicControls helpers ----------------------- */
  /** MusicControls 세션을 처음 한 번만, isPlaying=false 로 생성 */
  const createMusicControls = useCallback(async () => {
    if (!isNative || musicReady.current) return;

    await MusicControls.create({
      track: scriptureName || '경전 낭독',
      artist: '연등',
      album: '연등',
      isPlaying: false, // ← 핵심 변경: 처음엔 false
      dismissable: false,
      hasPrev: internalIndex.current > 0,
      hasNext: internalIndex.current < sentences.length - 1,
    });
    musicReady.current = true;
  }, [isNative, scriptureName, sentences.length]);

  /** 재생/일시정지 상태 토글 */
  const setMusicControlsPlaying = useCallback(
    async (playing: boolean) => {
      if (isNative && musicReady.current) {
        await MusicControls.updateIsPlaying(playing).catch(() => {});
      }
    },
    [isNative]
  );

  /* ----------------------------- Speech helpers --------------------------- */
  const getTtsSettings = () => {
    if (isNative) {
      return Capacitor.getPlatform() === 'android'
        ? { rate: 1.0, pitch: 0.5 }
        : { rate: 1.0, pitch: 0.7 }; // iOS
    }
    if (isAndroidWeb) return { rate: 1.0, pitch: 0.5 };
    return { rate: 0.9, pitch: 0.7 }; // iOS-Web & Desktop
  };

  const cancelWebUtterance = () => {
    if (currentUtterance.current) {
      currentUtterance.current.onend = null;
      currentUtterance.current.onerror = null;
    }
    currentUtterance.current = null;
    synth.current?.cancel();
  };

  /* ------------------------------ stopSpeech ------------------------------ */
  const stopSpeech = useCallback(
    async (syncParent = false) => {
      stopRequested.current = true;
      if (isNative) {
        await TextToSpeech.stop().catch(() => {});
      } else {
        cancelWebUtterance();
      }

      setIsSpeaking(false);
      await setMusicControlsPlaying(false);
      KeepAwake.allowSleep().catch(() => {});

      if (syncParent) {
        setCurrentIndex(internalIndex.current);
      }
    },
    [isNative, setCurrentIndex, setMusicControlsPlaying]
  );

  /* ------------------------------ speakText ------------------------------- */
  const speakText = useCallback(
    async (text: string, onDone: () => void) => {
      if (!text?.trim() || stopRequested.current) return;

      setIsSpeaking(true);

      try {
        if (isNative) {
          /* 1) 세션 없으면 isPlaying:false 로 생성 */
          await createMusicControls();
          /* 2) 이제 재생 상태 true 로 토글 (update만 하므로 오디오 포커스 충돌 X) */
          await setMusicControlsPlaying(true);

          /* 3) TTS 실행 */
          const { rate, pitch } = getTtsSettings();
          await TextToSpeech.speak({
            text,
            lang: 'ko-KR',
            rate,
            pitch,
            volume: 1.0,
            category: 'ambient',
          });

          if (!stopRequested.current) onDone();
        } else {
          /* ---- Web TTS ---- */
          const utter = new SpeechSynthesisUtterance(text);
          currentUtterance.current = utter;
          Object.assign(utter, getTtsSettings());
          utter.lang = 'ko-KR';

          utter.onend = () => {
            currentUtterance.current = null;
            if (!stopRequested.current) onDone();
          };
          utter.onerror = () => {
            currentUtterance.current = null;
            stopSpeech(false);
          };

          synth.current!.speak(utter);
        }
      } catch (e) {
        console.error('[TTS] speak error', e);
        stopSpeech(false);
      }
    },
    [createMusicControls, setMusicControlsPlaying, getTtsSettings, isNative, stopSpeech]
  );

  /* --------------------------- playFrom (재귀) ----------------------------- */
  const playFrom = useCallback(
    (idx: number) => {
      if (idx >= sentences.length) {
        stopSpeech(false);
        return;
      }
      internalIndex.current = idx;
      setCurrentIndex(idx);
      smoothCenter(idx);

      speakText(sentences[idx], () => playFrom(idx + 1));
    },
    [sentences, setCurrentIndex, smoothCenter, speakText, stopSpeech]
  );

  /* --------------------------- 핸들러들 ------------------------------------ */
  const handlePlayPause = useCallback(() => {
    if (isSpeaking) {
      stopSpeech(false);
    } else {
      stopRequested.current = false;
      KeepAwake.keepAwake().catch(() => {});

      if (!isNative && isIOSWeb && typeof AudioContext !== 'undefined') {
        void new AudioContext(); // iOS-Safari first-gesture
      }
      playFrom(internalIndex.current);
    }
  }, [isSpeaking, playFrom, stopSpeech, isNative, isIOSWeb]);

  const skip = useCallback(
    (dir: 1 | -1) => {
      const next = internalIndex.current + dir;
      if (next < 0 || next >= sentences.length) return;

      stopRequested.current = false;
      if (isNative) {
        void TextToSpeech.stop().catch(() => {});
      } else {
        cancelWebUtterance();
      }
      playFrom(next);
    },
    [sentences.length, playFrom]
  );

  /* ------------------------------- Lifecycle ------------------------------ */
  useEffect(() => {
    mounted.current = true;

    if (!isNative && 'speechSynthesis' in window) {
      synth.current = window.speechSynthesis;
      void waitUntilVoicesReady().then(() => {
        if (isIOSWeb) {
          const warm = new SpeechSynthesisUtterance(' ');
          warm.volume = 0;
          synth.current!.speak(warm);
        }
      });
    }

    /* Headset / Notification 리스너 */
    (async () => {
      if (isNative) {
        listenerHandle.current = await MusicControls.addListener(
          'controlsNotification',
          (info) => {
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
          }
        );
      }
    })();

    return () => {
      mounted.current = false;
      stopSpeech(false);

      if (listenerHandle.current) {
        void listenerHandle.current.remove().catch(() => {});
      }
      if (musicReady.current) {
        void MusicControls.destroy().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 외부 index ↔ 내부 index 동기화 */
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
