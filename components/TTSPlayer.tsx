'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Capacitor, registerPlugin, PluginListenerHandle } from '@capacitor/core';

// SpeakOptions 타입 정의 (TextToSpeech.speak 옵션)
interface SpeakOptions {
  text: string;
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  category?: string; // iOS 오디오 세션 카테고리
}

/* -------------------------------------------------------------------------- */
/* MusicControls 플러그인 타입 ------------------------------------------------ */
interface MusicControlsPlugin {
  create(options: {
    track: string;
    artist: string;
    album?: string;
    isPlaying: boolean;
    dismissable: boolean;
    hasPrev: boolean;
    hasNext: boolean;
    // ticker?: string;
    // cover?: string;
    // duration?: number;
    // elapsed?: number;
  }): Promise<void>;
  updateIsPlaying(options: { isPlaying: boolean /*; elapsed?: number*/ }): Promise<void>;
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

interface TTSPlayerProps {
  sentences: string[];
  scriptureName: string;
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  onPlaybackStateChange?: (isPlaying: boolean) => void;
  smoothCenter: (index: number) => void;
}

/* ------------------------------------ Utils ------------------------------- */
const waitUntilVoicesReady = (): Promise<void> => {
  // 웹 환경에서 voices 로드 대기
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

/* ---------------------------------- Component ----------------------------- */
const TTSPlayer: React.FC<TTSPlayerProps> = ({
  sentences,
  scriptureName,
  currentIndex: externalIndex,
  setCurrentIndex,
  onPlaybackStateChange,
  smoothCenter,
}) => {
  /* ---------------------------- Refs / State ----------------------------- */
  const [isSpeaking, setIsSpeaking] = useState(false);

  const synth = useRef<SpeechSynthesis | null>(null); // Web Speech API
  const currentUtterance = useRef<SpeechSynthesisUtterance | null>(null); // Web Speech API 현재 발화

  const stopRequested = useRef(false); // 사용자 중지 요청 플래그
  const internalIndex = useRef<number>(externalIndex); // 내부 현재 인덱스

  const musicReady = useRef(false); // MusicControls 초기화 완료 여부
  const listenerHandle = useRef<PluginListenerHandle | null>(null); // MusicControls 리스너

  const platform = Capacitor.getPlatform(); // 'web', 'android', 'ios'
  const isNative = platform !== 'web';
  const isIOSWeb = !isNative && /iPad|iPhone|iPod/.test(navigator.userAgent);

  const mounted = useRef(false); // 마운트 상태

  /* ------------------------- Music-controls helpers ---------------------- */
  const createMusicControls = useCallback(async () => {
    if (!isNative || musicReady.current) return;
    console.log('[TTS] Creating MusicControls...');
    try {
      await MusicControls.create({
        track: scriptureName || '경전 낭독',
        artist: '연등',
        isPlaying: true, // 생성 시점에는 재생 중으로 가정
        dismissable: false,
        hasPrev: internalIndex.current > 0,
        hasNext: internalIndex.current < sentences.length - 1,
      });
      musicReady.current = true;
      console.log('[TTS] MusicControls created successfully.');
    } catch (error) {
      console.error('[TTS] Failed to create MusicControls:', error);
      musicReady.current = false;
    }
  }, [isNative, scriptureName, sentences.length]);

  const setMusicControlsPlaying = useCallback(async (playing: boolean) => {
    if (isNative && musicReady.current) {
      try {
        await MusicControls.updateIsPlaying({ isPlaying: playing });
      } catch (error) {
        console.error('[TTS] Failed to update MusicControls playing state:', error);
      }
    }
  }, [isNative]);

  const destroyMusicControls = useCallback(async () => {
    if (isNative && musicReady.current) {
      console.log('[TTS] Destroying MusicControls...');
      try {
        await MusicControls.destroy();
        musicReady.current = false;
      } catch (error) {
        console.error('[TTS] Failed to destroy MusicControls:', error);
      }
    }
  }, [isNative]);

  /* --------------------------- Speech helpers ---------------------------- */
  const getTtsSettings = (): Partial<SpeakOptions> & { pitch?: number; rate?: number } => {
    if (isNative) {
      return platform === 'android'
        ? { rate: 1.0, pitch: 0.5 } // Android Native
        : { rate: 1.0, pitch: 0.7 }; // iOS Native
    }
    return { rate: 0.9, pitch: 0.7 }; // Web (iOS Web, Desktop, etc.)
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
    console.log('[TTS] Stopping speech...');
    stopRequested.current = true;

    if (isNative) {
      try { await TextToSpeech.stop(); } catch (e) { console.warn('[TTS] TextToSpeech.stop error:', e); }
    } else {
      cancelWebUtterance();
    }

    setIsSpeaking(false);
    await setMusicControlsPlaying(false);
    KeepAwake.allowSleep().catch(() => {});

    if (syncParent) {
      setCurrentIndex(internalIndex.current);
    }
    console.log(`[TTS] Speech stopped. Index: ${internalIndex.current}`);
  }, [isNative, setCurrentIndex, setMusicControlsPlaying]);

  /* ---------------------------- speakText -------------------------------- */
  const speakText = useCallback(async (text: string, index: number, onDone: () => void) => {
    if (!mounted.current || stopRequested.current || !text?.trim()) {
      if (stopRequested.current) console.log(`[TTS] Speak request ignored (stop requested). Index: ${index}`);
      return;
    }

    console.log(`[TTS] Speaking index: ${index}, Text: "${text.substring(0, 20)}..."`);
    internalIndex.current = index;
    setCurrentIndex(index);
    smoothCenter(index);
    setIsSpeaking(true);

    try {
      if (isNative) {
        const settings = getTtsSettings();
        await TextToSpeech.speak({
          text,
          lang: 'ko-KR',
          rate: settings.rate ?? 1.0,
          pitch: settings.pitch ?? 1.0,
          volume: 1.0,
          category: 'ambient',
        });

        if (!stopRequested.current && mounted.current) {
          console.log(`[TTS] Native speech finished. Index: ${index}`);
          onDone();
        } else {
          console.log(`[TTS] Native speech finished but stop was requested or unmounted. Index: ${index}`);
        }
      } else { // Web Speech API
        if (!synth.current) {
          console.error('[TTS] Web Speech Synthesis not available.');
          stopSpeech(true); return;
        }

        const utter = new SpeechSynthesisUtterance(text);
        currentUtterance.current = utter;
        const settings = getTtsSettings();
        utter.lang = 'ko-KR';
        utter.rate = settings.rate ?? 1.0;
        utter.pitch = settings.pitch ?? 1.0;

        utter.onend = () => {
          currentUtterance.current = null;
          if (!stopRequested.current && mounted.current) {
            console.log(`[TTS] Web speech finished. Index: ${index}`);
            setTimeout(onDone, 50); // 웹에서는 완료 후 약간의 딜레이
          } else {
            console.log(`[TTS] Web speech finished but stop was requested or unmounted. Index: ${index}`);
          }
        };
        utter.onerror = (event) => {
          console.error('[TTS] Web Speech Synthesis error:', event.error);
          currentUtterance.current = null;
          stopSpeech(true);
        };
        synth.current.speak(utter);
      }
    } catch (e) {
      console.error(`[TTS] Error speaking index ${index}:`, e);
      stopSpeech(true);
    }
  }, [isNative, setCurrentIndex, smoothCenter, stopSpeech]);

  /* ------------------------- Play-next routine ------------------------- */
  const playFrom = useCallback((startIndex: number) => {
    if (!mounted.current || stopRequested.current) return;

    if (startIndex >= sentences.length) {
      console.log('[TTS] Reached end of sentences.');
      stopSpeech(true); return;
    }

    const textToSpeak = sentences[startIndex];
    if (!textToSpeak?.trim()) {
      console.log(`[TTS] Skipping empty sentence at index: ${startIndex}`);
      playFrom(startIndex + 1); return;
    }

    speakText(textToSpeak, startIndex, () => {
      if (mounted.current && !stopRequested.current) {
        playFrom(startIndex + 1);
      }
    });
  }, [sentences, speakText, stopSpeech]);

  /* ------------------------- Control handlers -------------------------- */
  const handlePlayPause = useCallback(async () => {
    if (isSpeaking) {
      stopSpeech(true);
    } else {
      console.log(`[TTS] Play requested from index: ${internalIndex.current}`);
      stopRequested.current = false;
      KeepAwake.keepAwake().catch(() => {});

      if (isNative) {
        await createMusicControls(); // 생성 시도 (이미 있으면 무시)
        await setMusicControlsPlaying(true); // 재생 상태로 업데이트
      } else if (isIOSWeb) {
        await waitUntilVoicesReady();
        if (synth.current?.speaking) {
          console.warn('[TTS] iOS Web: synth was already speaking, cancelling before new play.');
          synth.current.cancel();
        }
      }
      playFrom(internalIndex.current);
    }
  }, [isSpeaking, isNative, isIOSWeb, stopSpeech, createMusicControls, setMusicControlsPlaying, playFrom]); // internalIndex는 ref

  // <<< iOS 타이밍 문제 수정된 skip 함수 >>>
  const skip = useCallback(
    async (direction: 1 | -1) => {
      const nextIndex = internalIndex.current + direction;
      if (nextIndex < 0 || nextIndex >= sentences.length) {
        console.log(`[TTS] Skip prevented: Index out of bounds (${nextIndex})`);
        return; // 인덱스 범위 벗어나면 무시
      }

      const wasSpeaking = isSpeaking; // 스킵 전 재생 상태 저장
      console.log(`[TTS] Skipping ${direction > 0 ? 'forward' : 'backward'} to index: ${nextIndex}. Was speaking: ${wasSpeaking}`);

      // 1. 현재 발화 중지 (stopRequested는 건드리지 않음!)
      if (isNative) {
        try {
          await TextToSpeech.stop();
          console.log('[TTS] Native TextToSpeech.stop() called.');
        } catch(e) { console.warn('[TTS] TextToSpeech.stop error during skip:', e); }
      } else {
        cancelWebUtterance(); // 진행 중인 웹 TTS 중단
      }

      // --- iOS 타이밍 문제 해결을 위한 짧은 지연 추가 ---
      if (isNative && platform === 'ios') {
          await new Promise(resolve => setTimeout(resolve, 50)); // 50ms 지연
          console.log('[TTS] Added 50ms delay after TTS stop for iOS.');
      }
      // -----------------------------------------------

      // 2. 인덱스 이동 및 UI 업데이트
      internalIndex.current = nextIndex;
      setCurrentIndex(nextIndex);
      smoothCenter(nextIndex);
      console.log(`[TTS] Index updated to: ${nextIndex}`);

      // 3. MusicControls 상태 업데이트 (변경된 인덱스 기준)
      if (isNative && musicReady.current) {
         try {
            console.log(`[TTS] Re-creating MusicControls for skip update. Index: ${nextIndex}`);
            await MusicControls.create({ // create 재호출로 hasPrev/hasNext 업데이트
               track: scriptureName || '경전 낭독',
               artist: '연등',
               isPlaying: wasSpeaking, // 스킵 후에도 이전 재생 상태 유지 시도
               dismissable: false,
               hasPrev: nextIndex > 0,
               hasNext: nextIndex < sentences.length - 1,
             });
             console.log('[TTS] MusicControls re-created/updated for skip.');
         } catch(e) {
             console.error('[TTS] Failed to re-create/update MusicControls during skip:', e);
         }
      }

      // 4. 새 위치에서 재생 시작 (만약 스킵 전에 재생 중이었다면)
      if (wasSpeaking) {
         stopRequested.current = false; // 재생을 계속할 것이므로 중지 요청 해제
         console.log(`[TTS] Calling playFrom(${nextIndex}) after skip.`);
         playFrom(nextIndex); // 새 위치에서 재생 시작
      } else {
         // 멈춤 상태에서 스킵한 경우: 재생은 시작하지 않고 MusicControls 상태를 '일시정지'로 확실히 함
         console.log('[TTS] Skip finished, was not speaking, not calling playFrom.');
         if (isNative && musicReady.current) {
           await setMusicControlsPlaying(false);
         }
      }
    },
    [isNative, platform, sentences.length, scriptureName, isSpeaking, setCurrentIndex, smoothCenter, playFrom, setMusicControlsPlaying] // platform 의존성 추가
    // internalIndex, musicReady, stopRequested는 ref
  );


  /* ----------------------------- Lifecycle ----------------------------- */
  useEffect(() => {
    mounted.current = true;
    console.log(`[TTS] Component mounted. Platform: ${platform}, Native: ${isNative}`);

    // Web Speech API 초기화
    if (!isNative && 'speechSynthesis' in window) {
      synth.current = window.speechSynthesis;
      if (isIOSWeb) {
        waitUntilVoicesReady().then(() => {
          if (synth.current) {
            try {
              const warm = new SpeechSynthesisUtterance(' '); warm.volume = 0;
              synth.current.speak(warm); // iOS 예열
            } catch (e) { console.warn('[TTS] iOS Web warmup speech failed:', e); }
          }
        });
      }
    }

    // 네이티브 MusicControls 리스너 등록
    let handle: PluginListenerHandle | null = null;
    const registerMusicControlsListener = async () => {
      if (isNative) {
        try {
          console.log('[TTS] Adding MusicControls listener...');
          handle = await MusicControls.addListener('controlsNotification', (info) => {
            if (!mounted.current) return;
            console.log('[TTS] MusicControls notification received:', info.action);
            switch (info.action) {
              case 'music-controls-play': if (!isSpeaking) handlePlayPause(); break;
              case 'music-controls-pause': if (isSpeaking) handlePlayPause(); break;
              case 'music-controls-next': skip(1); break;
              case 'music-controls-previous': skip(-1); break;
              case 'music-controls-stop': case 'music-controls-destroy': stopSpeech(true); break;
            }
          });
          listenerHandle.current = handle;
          console.log('[TTS] MusicControls listener added.');
        } catch (error) { console.error('[TTS] Failed to add MusicControls listener:', error); }
      }
    };
    registerMusicControlsListener();

    // Cleanup 함수
    return () => {
      mounted.current = false;
      console.log('[TTS] Component unmounting...');
      stopSpeech(false); // 진행 중인 TTS 중지

      // 리스너 제거
      if (listenerHandle.current) {
        listenerHandle.current.remove().catch((e) => console.error('[TTS] Failed to remove listener:', e));
        listenerHandle.current = null;
      }
      // MusicControls 제거
      destroyMusicControls();
      // Web Speech API 정리
      if (synth.current) synth.current.cancel();
      console.log('[TTS] Component unmounted cleanup finished.');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNative, isIOSWeb, platform, stopSpeech, handlePlayPause, skip, destroyMusicControls]); // 초기화 로직

  /* 외부 인덱스 변경 감지 */
  useEffect(() => {
    if (mounted.current && externalIndex !== internalIndex.current) {
      console.log(`[TTS] External index changed to ${externalIndex}. Internal was ${internalIndex.current}. Speaking: ${isSpeaking}`);
      if (isSpeaking) {
        stopSpeech(false); // 재생 중이면 멈춤
      }
      internalIndex.current = externalIndex; // 내부 인덱스 동기화
    }
  }, [externalIndex, isSpeaking, stopSpeech]);

  /* 재생 상태 변경 시 외부 콜백 호출 */
  useEffect(() => {
    if (mounted.current) {
      onPlaybackStateChange?.(isSpeaking);
    }
  }, [isSpeaking, onPlaybackStateChange]);

  /* -------------------------------- Render ------------------------------- */
  return (
    <div className="fixed bottom-[84px] left-1/2 -translate-x-1/2 flex items-center gap-4 z-50 bg-white/80 backdrop-blur-sm p-2 rounded-full shadow-lg">
      {/* 이전 버튼 */}
      <button
        onClick={() => skip(-1)}
        aria-label="이전 문장"
        disabled={internalIndex.current <= 0 || sentences.length === 0}
        className="bg-red-light text-white rounded-full w-12 h-12 flex items-center justify-center shadow-md disabled:opacity-50 transition-opacity duration-200"
      >
        <SkipBack size={24} />
      </button>

      {/* 재생/일시정지 버튼 */}
      <button
        onClick={handlePlayPause}
        aria-label={isSpeaking ? '일시정지' : '재생'}
        disabled={sentences.length === 0}
        className="bg-red-light text-white rounded-full w-16 h-16 flex items-center justify-center shadow-lg disabled:opacity-50 transition-opacity duration-200"
      >
        {isSpeaking ? <Pause size={36} fill="currentColor" /> : <Play size={36} fill="currentColor" />}
      </button>

      {/* 다음 버튼 */}
      <button
        onClick={() => skip(1)}
        aria-label="다음 문장"
        disabled={internalIndex.current >= sentences.length - 1 || sentences.length === 0}
        className="bg-red-light text-white rounded-full w-12 h-12 flex items-center justify-center shadow-md disabled:opacity-50 transition-opacity duration-200"
      >
        <SkipForward size={24} />
      </button>
    </div>
  );
};

export default TTSPlayer;