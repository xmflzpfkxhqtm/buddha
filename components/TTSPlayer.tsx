'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Capacitor, registerPlugin, PluginListenerHandle } from '@capacitor/core';

/* -------------------------------------------------------------------------- */
/*                                MusicControls                               */
/* -------------------------------------------------------------------------- */

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
/*                                   Props                                    */
/* -------------------------------------------------------------------------- */

interface TTSPlayerProps {
  sentences: string[];
  scriptureName: string;
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  onPlaybackStateChange?: (isPlaying: boolean) => void;
  smoothCenter: (index: number) => void;
}

/* -------------------------------------------------------------------------- */
/*                                   Utils                                    */
/* -------------------------------------------------------------------------- */

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
/*                                 Component                                  */
/* -------------------------------------------------------------------------- */

const TTSPlayer: React.FC<TTSPlayerProps> = ({
  sentences,
  scriptureName,
  currentIndex: externalIndex,
  setCurrentIndex,
  onPlaybackStateChange,
  smoothCenter,
}) => {
  /* ------------------------------ Refs / State ----------------------------- */
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

  /* -------------------------- Music-controls helper ------------------------- */
  const createMusicControls = useCallback(async () => {
    if (!isNative || musicReady.current) return;

    await MusicControls.create({
      track: scriptureName || '경전 낭독', // **제목만 한 번 지정**
      artist: '연등',
      album: '연등',
      isPlaying: true,
      dismissable: false,
      hasPrev: internalIndex.current > 0,
      hasNext: internalIndex.current < sentences.length - 1,
    });
    musicReady.current = true;
  }, [isNative, scriptureName, sentences.length]);

  const setMusicControlsPlaying = useCallback(
    async (playing: boolean) => {
      if (isNative && musicReady.current) {
        await MusicControls.updateIsPlaying(playing).catch(() => {});
      }
    },
    [isNative]
  );

  /* ----------------------------- Speech helpers ---------------------------- */
  const getTtsSettings = () =>
    isNative
      ? { rate: 1.0, pitch: 1.0, volume: 1.0 }
      : isAndroidWeb
      ? { rate: 1.0, pitch: 1.0 }
      : { rate: 0.9, pitch: 1.1 };

  const cancelWebUtterance = () => {
    currentUtterance.current?.onend && (currentUtterance.current.onend = null);
    currentUtterance.current?.onerror &&
      (currentUtterance.current.onerror = null);
    currentUtterance.current = null;
    synth.current?.cancel();
  };

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

  /* ------------------------------ speakText -------------------------------- */
  const speakText = useCallback(
    async (text: string, onDone: () => void) => {
      if (!text?.trim() || stopRequested.current) return;

      setIsSpeaking(true);
      await createMusicControls();
      await setMusicControlsPlaying(true);

      try {
        if (isNative) {
          await TextToSpeech.speak({
            text,
            lang: 'ko-KR',
            ...getTtsSettings(),
          });
          if (!stopRequested.current) onDone();
        } else {
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
    [createMusicControls, isNative, setMusicControlsPlaying, stopSpeech]
  );

  /* --------------------------- Play-next routine --------------------------- */
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

  /* --------------------------- Control handlers ---------------------------- */
  const handlePlayPause = useCallback(() => {
    if (isSpeaking) {
      stopSpeech(false);
    } else {
      stopRequested.current = false;
      KeepAwake.keepAwake().catch(() => {});

      if (!isNative && isIOSWeb) {
        // iOS-Safari 첫 호출 시 user-gesture 확보
        window?.AudioContext && new AudioContext();
      }
      playFrom(internalIndex.current);
    }
  }, [isSpeaking, isNative, isIOSWeb, playFrom, stopSpeech]);

  const skip = useCallback(
    (direction: 1 | -1) => {
      const next = internalIndex.current + direction;
      if (next < 0 || next >= sentences.length) return;

      stopRequested.current = false;
      if (isNative) TextToSpeech.stop().catch(() => {});
      else cancelWebUtterance();

      playFrom(next);
    },
    [sentences.length, playFrom]
  );

  /* ------------------------------- Lifecycle ------------------------------- */
  useEffect(() => {
    mounted.current = true;

    if (!isNative && 'speechSynthesis' in window) {
      synth.current = window.speechSynthesis;
      waitUntilVoicesReady().then(() => {
        if (isIOSWeb) {
          const warm = new SpeechSynthesisUtterance(' ');
          warm.volume = 0;
          synth.current!.speak(warm);
        }
      });
    }

    /* native-notification listener */
    if (isNative) {
      MusicControls.addListener('controlsNotification', (info) => {
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
      musicReady.current && MusicControls.destroy().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 외부 index 변경 → 재생 중이면 멈추고 맞춰 주기 */
  useEffect(() => {
    if (externalIndex !== internalIndex.current) {
      if (isSpeaking) stopSpeech(false);
      internalIndex.current = externalIndex;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalIndex]);

  useEffect(() => {
    onPlaybackStateChange?.(isSpeaking);
  }, [isSpeaking, onPlaybackStateChange]);

  /* ------------------------------------------------------------------------ */
  /*                                   UI                                    */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="fixed bottom-[84px] left-1/2 -translate-x-1/2 flex items-center gap-4 z-50 bg-white/80 backdrop-blur-sm p-2 rounded-full shadow-lg">
      <button
        onClick={() => skip(-1)}
        aria-label="이전 문장"
        disabled={internalIndex.current <= 0}
        className="bg-red-light text-white rounded-full w-12 h-12 flex items-center justify-center shadow-md disabled:opacity-50"
      >
        <SkipBack size={24} />
      </button>

      <button
        onClick={handlePlayPause}
        aria-label={isSpeaking ? '일시정지' : '재생'}
        disabled={!sentences.length}
        className="bg-red-dark text-white rounded-full w-16 h-16 flex items-center justify-center shadow-lg disabled:opacity-50"
      >
        {isSpeaking ? <Pause size={36} /> : <Play size={36} fill="currentColor" />}
      </button>

      <button
        onClick={() => skip(1)}
        aria-label="다음 문장"
        disabled={internalIndex.current >= sentences.length - 1}
        className="bg-red-light text-white rounded-full w-12 h-12 flex items-center justify-center shadow-md disabled:opacity-50"
      >
        <SkipForward size={24} />
      </button>
    </div>
  );
};

export default TTSPlayer;
