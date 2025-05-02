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
    // ... other options
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
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return Promise.resolve();
  if (speechSynthesis.getVoices().length) return Promise.resolve();

  return new Promise((resolve) => {
    const int = setInterval(() => {
      if (speechSynthesis.getVoices().length) {
        clearInterval(int);
        resolve();
      }
    }, 50);
    speechSynthesis.addEventListener(
      'voiceschanged',
      () => {
        clearInterval(int);
        resolve();
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
  const synth = useRef<SpeechSynthesis | null>(null);
  const currentUtterance = useRef<SpeechSynthesisUtterance | null>(null);
  const stopRequested = useRef(false);
  const internalIndex = useRef<number>(externalIndex);
  const musicReady = useRef(false);
  const listenerHandle = useRef<PluginListenerHandle | null>(null);
  const platform = Capacitor.getPlatform();
  const isNative = platform !== 'web';
  const isIOSWeb = !isNative && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const mounted = useRef(false);

  // <<< 재생 세대 카운터 추가 >>>
  const playGeneration = useRef(0);

  /* ------------------------- Music-controls helpers ---------------------- */
  // createMusicControls, setMusicControlsPlaying, destroyMusicControls (이전과 동일)
  const createMusicControls = useCallback(async (isPlayingState: boolean, currentIndex: number) => {
    if (!isNative || musicReady.current) return; // 이미 생성되었으면 중복 생성 방지 (옵션 업데이트는 create 재호출 필요)
    // 또는 musicReady 체크 없이 항상 create 호출? -> hasPrev/Next 업데이트 위해 필요
    console.log(`[TTS] Creating/Updating MusicControls... Index: ${currentIndex}, IsPlaying: ${isPlayingState}`);
    try {
      await MusicControls.create({
        track: scriptureName || '경전 낭독',
        artist: '연등',
        isPlaying: isPlayingState,
        dismissable: false,
        hasPrev: currentIndex > 0,
        hasNext: currentIndex < sentences.length - 1,
      });
      musicReady.current = true; // 생성 성공 시 플래그 설정
      console.log('[TTS] MusicControls created/updated successfully.');
    } catch (error) {
      console.error('[TTS] Failed to create/update MusicControls:', error);
       // musicReady.current = false; // 실패 시 리셋? -> destroy 시 확실히 리셋하므로 여기선 선택적
    }
  }, [isNative, scriptureName, sentences.length]);

  const setMusicControlsPlaying = useCallback(async (playing: boolean) => {
    if (isNative && musicReady.current) {
      try {
        await MusicControls.updateIsPlaying({ isPlaying: playing });
      } catch (error) { console.error('[TTS] Failed to update MusicControls playing state:', error); }
    }
  }, [isNative]);

  const destroyMusicControls = useCallback(async () => {
    if (isNative && musicReady.current) {
      console.log('[TTS] Destroying MusicControls...');
      try {
        await MusicControls.destroy();
        musicReady.current = false;
      } catch (error) { console.error('[TTS] Failed to destroy MusicControls:', error); }
    }
  }, [isNative]);


  /* --------------------------- Speech helpers ---------------------------- */
  const getTtsSettings = (): Partial<SpeakOptions> & { pitch?: number; rate?: number } => {
    // ... (이전과 동일)
    if (isNative) return platform === 'android' ? { rate: 1.0, pitch: 0.5 } : { rate: 1.0, pitch: 0.7 };
    return { rate: 0.9, pitch: 0.7 };
  };

  const cancelWebUtterance = () => {
    // ... (이전과 동일)
    if (currentUtterance.current) { /* ... */ }
    synth.current?.cancel();
  };

  const stopSpeech = useCallback(async (syncParent = true) => {
    if (!mounted.current) return;
    console.log('[TTS] Stopping speech...');
    stopRequested.current = true;
    // <<< 재생 중지 시 세대 카운터 변경 (선택적, 새 재생 시 확실히 변경되므로 필수 아님) >>>
    // playGeneration.current += 1; // Stop도 새로운 상태 변화로 간주

    if (isNative) {
      try { await TextToSpeech.stop(); } catch (e) { console.warn('[TTS] TextToSpeech.stop error:', e); }
    } else {
      cancelWebUtterance();
    }

    setIsSpeaking(false);
    await setMusicControlsPlaying(false);
    KeepAwake.allowSleep().catch(() => {});

    if (syncParent) setCurrentIndex(internalIndex.current);
    console.log(`[TTS] Speech stopped. Index: ${internalIndex.current}`);
  }, [isNative, setCurrentIndex, setMusicControlsPlaying]);

  /* ---------------------------- speakText -------------------------------- */
  // <<< generation 파라미터 추가 >>>
  const speakText = useCallback(async (
    text: string,
    index: number,
    onDone: () => void,
    generation: number // 현재 재생 세대 번호
  ) => {
    // 컴포넌트 마운트, stop 요청, generation 변경 여부 체크
    if (!mounted.current || stopRequested.current || !text?.trim() || generation !== playGeneration.current) {
      if (generation !== playGeneration.current) console.log(`[TTS] Speak request ignored (generation mismatch). Index: ${index}, ReqGen: ${generation}, CurrentGen: ${playGeneration.current}`);
      else if (stopRequested.current) console.log(`[TTS] Speak request ignored (stop requested). Index: ${index}`);
      return;
    }

    console.log(`[TTS] Speaking index: ${index}, Gen: ${generation}, Text: "${text.substring(0, 20)}..."`);
    internalIndex.current = index;
    setCurrentIndex(index);
    smoothCenter(index);
    setIsSpeaking(true); // 실제 재생 시작 직전 상태 변경

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
          console.log(`[TTS] Native speech finished but stop was requested. Index: ${index}`);
        }
      } else {
        if (!synth.current) {
          console.error('[TTS] Web Speech Synthesis not available.');
          stopSpeech(true);
          return;
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
            setTimeout(onDone, 50);
          } else {
            console.log(`[TTS] Web speech finished but stop was requested. Index: ${index}`);
          }
        };

        utter.onerror = () => {
          console.error('[TTS] Web Speech Synthesis error');
          currentUtterance.current = null;
          stopSpeech(true);
        };

        synth.current.speak(utter);
      }
    } catch (e) {
      console.error(`[TTS] Error speaking index ${index}:`, e);
      stopSpeech(true);
    }
  }, [isNative, setCurrentIndex, smoothCenter, stopSpeech, getTtsSettings]);

  /* ------------------------- Play-next routine ------------------------- */
  // <<< generation 파라미터 추가 >>>
  const playFrom = useCallback((startIndex: number, generation: number) => {
    // 시작 시점에서도 generation 체크
    if (!mounted.current || stopRequested.current || generation !== playGeneration.current) {
      if (generation !== playGeneration.current) console.log(`[TTS] playFrom(${startIndex}) aborted (generation mismatch). ReqGen: ${generation}, CurrentGen: ${playGeneration.current}`);
      return;
    }

    if (startIndex >= sentences.length) {
      console.log(`[TTS] Reached end of sentences. Gen: ${generation}`);
      stopSpeech(true); return;
    }

    const textToSpeak = sentences[startIndex];
    if (!textToSpeak?.trim()) {
      console.log(`[TTS] Skipping empty sentence at index: ${startIndex}, Gen: ${generation}`);
      playFrom(startIndex + 1, generation); // 같은 generation으로 다음 호출
      return;
    }

    // speakText 호출 시 현재 generation 전달, onDone 콜백에서도 generation 체크 후 다음 playFrom 호출
    speakText(textToSpeak, startIndex, () => {
      // onDone 콜백이 실행될 때도 generation 체크 필수!
      if (mounted.current && !stopRequested.current && generation === playGeneration.current) {
        playFrom(startIndex + 1, generation); // 다음 문장 재생 (같은 generation)
      } else {
        console.log(`[TTS] onDone for index ${startIndex} aborted (generation mismatch or stop req). ReqGen: ${generation}, CurrentGen: ${playGeneration.current}`);
      }
    }, generation);
  }, [sentences, speakText, stopSpeech]);

  /* ------------------------- Control handlers -------------------------- */
  const handlePlayPause = useCallback(async () => {
    if (isSpeaking) {
      stopSpeech(true);
    } else {
      // <<< 새 재생 시작 시 generation 증가 >>>
      const currentGeneration = playGeneration.current + 1;
      playGeneration.current = currentGeneration;
      console.log(`[TTS] Play requested from index: ${internalIndex.current}. New Gen: ${currentGeneration}`);

      stopRequested.current = false;
      KeepAwake.keepAwake().catch(() => {});

      if (isNative) {
        // MusicControls 생성/업데이트 (현재 인덱스와 재생 상태 전달)
        await createMusicControls(true, internalIndex.current);
        // await setMusicControlsPlaying(true); // create에서 isPlaying:true로 설정했으므로 중복 호출 제거 가능
      } else if (isIOSWeb) { /* ... iOS Web 예열 ... */ }

      // <<< playFrom 호출 시 새 generation 전달 >>>
      playFrom(internalIndex.current, currentGeneration);
    }
  }, [isSpeaking, isNative, isIOSWeb, internalIndex, stopSpeech, createMusicControls, /* setMusicControlsPlaying, */ playFrom]); // internalIndex는 ref

  const skip = useCallback(async (direction: 1 | -1) => {
    const nextIndex = internalIndex.current + direction;
    if (nextIndex < 0 || nextIndex >= sentences.length) return;

    const wasSpeaking = isSpeaking;
    // <<< Skip 시에도 새로운 재생 세대 시작 >>>
    const currentGeneration = playGeneration.current + 1;
    playGeneration.current = currentGeneration;
    console.log(`[TTS] Skipping ${direction > 0 ? 'forward' : 'backward'} to index: ${nextIndex}. New Gen: ${currentGeneration}. Was speaking: ${wasSpeaking}`);

    // 1. 현재 발화 중지 (stopRequested는 건드리지 않음, generation이 바뀌었으므로 이전 콜백은 실행 안 됨)
    if (isNative) {
      try { await TextToSpeech.stop(); } catch(e) { console.warn('[TTS] TextToSpeech.stop error during skip:', e); }
    } else { cancelWebUtterance(); }

    // iOS 타이밍 지연 (필요시 유지)
    if (isNative && platform === 'ios') {
        await new Promise(resolve => setTimeout(resolve, 50));
        console.log('[TTS] Added 50ms delay after TTS stop for iOS skip.');
    }

    // 2. 인덱스 이동 및 UI 업데이트
    internalIndex.current = nextIndex;
    setCurrentIndex(nextIndex);
    smoothCenter(nextIndex);

    // 3. MusicControls 상태 업데이트 (변경된 인덱스, 이전 재생 상태 기준)
    if (isNative) { // musicReady 체크 없이 시도 (create 내부에서 처리 or 실패 로깅)
      await createMusicControls(wasSpeaking, nextIndex); // isPlaying은 이전 상태 유지, 인덱스 반영
    }

    // 4. 새 위치에서 재생 시작 (만약 스킵 전에 재생 중이었다면)
    if (wasSpeaking) {
       stopRequested.current = false; // 새 generation 재생을 위해 리셋
       console.log(`[TTS] Calling playFrom(${nextIndex}) after skip. Gen: ${currentGeneration}`);
       // <<< playFrom 호출 시 새 generation 전달 >>>
       playFrom(nextIndex, currentGeneration);
    } else {
       console.log('[TTS] Skip finished, was not speaking, not calling playFrom.');
       // 멈춤 상태에서 스킵했으면 MusicControls 상태를 확실히 '일시정지'로
       if (isNative) await setMusicControlsPlaying(false);
    }
  }, [isNative, platform, sentences.length, isSpeaking, setCurrentIndex, smoothCenter, playFrom, createMusicControls, setMusicControlsPlaying]); // internalIndex는 ref

  /* ----------------------------- Lifecycle ----------------------------- */
  useEffect(() => {
    mounted.current = true;
    console.log(`[TTS] Component mounted. Platform: ${platform}, Native: ${isNative}`);

    if (!isNative && 'speechSynthesis' in window) {
      const currentSynth = window.speechSynthesis;
      synth.current = currentSynth;
      if (isIOSWeb) {
        waitUntilVoicesReady().then(() => {
          if (currentSynth) {
            try {
              const warm = new SpeechSynthesisUtterance(' ');
              warm.volume = 0;
              currentSynth.speak(warm);
            } catch (e) {
              console.warn('[TTS] iOS Web warmup speech failed (likely needs user gesture):', e);
            }
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
            // 중요: 리스너 콜백 내에서 상태 변경 함수(handlePlayPause, skip) 호출 시,
            // 해당 함수들이 최신 상태(isSpeaking 등)를 참조하도록 useCallback 의존성 배열 관리 필요.
            // 현재 구조에서는 handlePlayPause, skip이 useCallback으로 감싸져 있고,
            // isSpeaking 등의 상태를 의존성 배열에 포함하고 있으므로 괜찮을 것으로 예상됨.
            switch (info.action) {
              case 'music-controls-play': handlePlayPause(); break; // isSpeaking 체크는 handlePlayPause 내부에서 함
              case 'music-controls-pause': handlePlayPause(); break; // isSpeaking 체크는 handlePlayPause 내부에서 함
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
      // stopSpeech 호출 시 내부적으로 TextToSpeech.stop(), musicControlsPlaying(false) 등 호출됨
      stopSpeech(false);

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
    // handlePlayPause, skip, stopSpeech 등을 의존성 배열에 넣어야 최신 함수 참조 보장
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNative, isIOSWeb, platform, stopSpeech, handlePlayPause, skip, destroyMusicControls]); // 초기화 로직 + 주요 핸들러 포함

  /* 외부 인덱스 변경 감지 */
  useEffect(() => {
    if (mounted.current && externalIndex !== internalIndex.current) {
      console.log(`[TTS] External index changed to ${externalIndex}. Internal was ${internalIndex.current}. Speaking: ${isSpeaking}`);
      if (isSpeaking) {
        // 외부에서 인덱스 변경 시, 현재 재생 중단 및 새 세대 시작 (선택적)
        // stopSpeech(false); // 일단 멈추기만 함
        // 또는 skip처럼 새 generation 시작? -> 사용성에 따라 결정
        const currentGeneration = playGeneration.current + 1;
        playGeneration.current = currentGeneration;
        stopSpeech(false); // 현재 재생 중단
        console.log(`[TTS] External index change interrupted playback. New Gen: ${currentGeneration}`);
      }
      internalIndex.current = externalIndex;
    }
  }, [externalIndex, isSpeaking, stopSpeech]);

  /* 재생 상태 변경 시 외부 콜백 호출 */
  useEffect(() => {
    if (mounted.current) onPlaybackStateChange?.(isSpeaking);
  }, [isSpeaking, onPlaybackStateChange]);

  /* -------------------------------- Render ------------------------------- */
  return (
    <div className="fixed bottom-[84px] left-1/2 -translate-x-1/2 flex items-center gap-4 z-50 bg-white/80 backdrop-blur-sm p-2 rounded-full shadow-lg">
      {/* 이전 버튼 */}
      <button onClick={() => skip(-1)} aria-label="이전 문장" disabled={internalIndex.current <= 0 || sentences.length === 0} className="bg-red-light text-white rounded-full w-12 h-12 flex items-center justify-center shadow-md disabled:opacity-50 transition-opacity duration-200">
        <SkipBack size={24} />
      </button>
      {/* 재생/일시정지 버튼 */}
      <button onClick={handlePlayPause} aria-label={isSpeaking ? '일시정지' : '재생'} disabled={sentences.length === 0} className="bg-red-light text-white rounded-full w-16 h-16 flex items-center justify-center shadow-lg disabled:opacity-50 transition-opacity duration-200">
        {isSpeaking ? <Pause size={36} fill="currentColor" /> : <Play size={36} fill="currentColor" />}
      </button>
      {/* 다음 버튼 */}
      <button onClick={() => skip(1)} aria-label="다음 문장" disabled={internalIndex.current >= sentences.length - 1 || sentences.length === 0} className="bg-red-light text-white rounded-full w-12 h-12 flex items-center justify-center shadow-md disabled:opacity-50 transition-opacity duration-200">
        <SkipForward size={24} />
      </button>
    </div>
  );
};

export default TTSPlayer;