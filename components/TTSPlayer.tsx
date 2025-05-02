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
/* MusicControls 플러그인 타입 ------------------------------------------------ */
interface MusicControlsPlugin {
  create(options: {
    track: string;
    artist: string;
    album?: string;
    isPlaying: boolean;
    dismissable: boolean; // 백그라운드에서 알림을 스와이프하여 닫을 수 있는지 여부
    hasPrev: boolean;
    hasNext: boolean;
    // ticker?: string; // 상태 표시줄 텍스트 (Android)
    // cover?: string; // 앨범 아트 URL (file:// 또는 http(s)://)
    // duration?: number; // 트랙 길이 (초)
    // elapsed?: number; // 경과 시간 (초)
  }): Promise<void>;
  updateIsPlaying(options: { isPlaying: boolean /*; elapsed?: number*/ }): Promise<void>; // 필요시 elapsed 추가
  destroy(): Promise<void>;
  addListener(
    eventName: 'controlsNotification', // 이벤트 이름 명시
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
    | 'music-controls-stop' // Android only?
    | 'music-controls-destroy'; // Android only?
}
/* -------------------------------------------------------------------------- */

interface TTSPlayerProps {
  sentences: string[];
  scriptureName: string; // MusicControls에 표시될 이름
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  onPlaybackStateChange?: (isPlaying: boolean) => void;
  smoothCenter: (index: number) => void;
}

/* ------------------------------------ Utils ------------------------------- */
const waitUntilVoicesReady = (): Promise<void> => {
  // ... (이전 코드와 동일)
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

  const synth = useRef<SpeechSynthesis | null>(null);
  const currentUtterance = useRef<SpeechSynthesisUtterance | null>(null);

  const stopRequested = useRef(false); // 사용자가 명시적으로 중지/일시정지를 요청했는지 여부
  const internalIndex = useRef<number>(externalIndex); // 내부적으로 추적하는 현재 인덱스

  const musicReady = useRef(false); // MusicControls.create가 성공적으로 호출되었는지 여부
  const listenerHandle = useRef<PluginListenerHandle | null>(null); // MusicControls 리스너 핸들

  const platform = Capacitor.getPlatform();
  const isNative = platform !== 'web';
  const isIOSWeb = !isNative && /iPad|iPhone|iPod/.test(navigator.userAgent);
  // const isAndroidWeb = !isNative && /Android/.test(navigator.userAgent); // 필요시 사용

  const mounted = useRef(false); // 컴포넌트 마운트 상태 추적

  /* ------------------------- Music-controls helpers ---------------------- */
  // MusicControls 생성 (재생 시작 시 한 번만 호출되도록 설계)
  const createMusicControls = useCallback(async () => {
    if (!isNative || musicReady.current) return;

    console.log('[TTS] Creating MusicControls...');
    try {
      await MusicControls.create({
        track: scriptureName || '경전 낭독',
        artist: '연등',
        // album: '연등', // 필요시 추가
        isPlaying: true, // 생성 시점에는 재생 중 상태로 시작
        dismissable: false, // 알림을 사용자가 닫지 못하게 설정
        hasPrev: internalIndex.current > 0,
        hasNext: internalIndex.current < sentences.length - 1,
      });
      musicReady.current = true;
      console.log('[TTS] MusicControls created successfully.');
    } catch (error) {
      console.error('[TTS] Failed to create MusicControls:', error);
      musicReady.current = false; // 실패 시 플래그 리셋
    }
  }, [isNative, scriptureName, sentences.length]); // internalIndex는 동적으로 바뀌므로 의존성 배열에서 제외하고, 호출 시점의 값 사용

  // MusicControls 재생 상태 업데이트
  const setMusicControlsPlaying = useCallback(
    async (playing: boolean) => {
      // MusicControls가 생성된 후에만 업데이트 시도
      if (isNative && musicReady.current) {
        try {
          await MusicControls.updateIsPlaying({ isPlaying: playing });
        } catch (error) {
          console.error('[TTS] Failed to update MusicControls playing state:', error);
        }
      }
    },
    [isNative] // musicReady는 ref이므로 의존성 배열 불필요
  );

  // MusicControls 제거 (컴포넌트 언마운트 시)
  const destroyMusicControls = useCallback(async () => {
    if (isNative && musicReady.current) {
      console.log('[TTS] Destroying MusicControls...');
      try {
        await MusicControls.destroy();
        musicReady.current = false;
        console.log('[TTS] MusicControls destroyed.');
      } catch (error) {
        console.error('[TTS] Failed to destroy MusicControls:', error);
      }
    }
  }, [isNative]); // musicReady는 ref이므로 의존성 배열 불필요


  /* --------------------------- Speech helpers ---------------------------- */
  // 플랫폼별 TTS 설정 가져오기
  const getTtsSettings = (): Partial<SpeakOptions> & { pitch?: number; rate?: number } => {
    // SpeakOptions에는 pitch가 없을 수 있으므로 별도 타입 정의 또는 Partial 사용
    if (isNative) {
      if (Capacitor.getPlatform() === 'android') {
        return { rate: 1.0, pitch: 0.5 }; // Android Native
      }
      return { rate: 1.0, pitch: 0.7 }; // iOS Native
    }
    // 웹 환경 설정 (필요에 따라 세분화)
    // if (isAndroidWeb) { return { rate: 1.0, pitch: 0.5 }; }
    // if (isIOSWeb) { return { rate: 0.9, pitch: 0.7 }; }
    return { rate: 0.9, pitch: 0.7 }; // Other Web (Desktop Chrome, etc.)
  };

  // 웹 SpeechSynthesis Utterance 취소
  const cancelWebUtterance = () => {
    if (currentUtterance.current) {
      currentUtterance.current.onend = null;
      currentUtterance.current.onerror = null;
      currentUtterance.current = null;
    }
    synth.current?.cancel();
  };

  // TTS 중지 (일시정지 포함)
  const stopSpeech = useCallback(
    async (syncParent = true) => { // 외부 상태 동기화 여부
      if (!mounted.current) return; // 이미 언마운트되었으면 실행 안 함

      console.log('[TTS] Stopping speech...');
      stopRequested.current = true; // 중지 요청 플래그 설정

      if (isNative) {
        try {
          await TextToSpeech.stop();
        } catch (e) { console.warn('[TTS] TextToSpeech.stop error:', e); }
      } else {
        cancelWebUtterance();
      }

      // 상태 업데이트는 네이티브/웹 공통
      setIsSpeaking(false);
      await setMusicControlsPlaying(false); // MusicControls 상태 '일시정지'로 업데이트
      KeepAwake.allowSleep().catch(() => {}); // 화면 꺼짐 방지 해제

      if (syncParent) {
        // 사용자가 직접 중지/일시정지 누른 경우, 현재 위치를 부모와 동기화
        setCurrentIndex(internalIndex.current);
      }
       console.log(`[TTS] Speech stopped. Index: ${internalIndex.current}`);
    },
    [isNative, setCurrentIndex, setMusicControlsPlaying] // mounted, internalIndex는 ref
  );

  /* ---------------------------- speakText (Simplified) ------------------- */
  // 특정 텍스트를 읽고, 완료되면 onDone 콜백 실행
  const speakText = useCallback(
    async (text: string, index: number, onDone: () => void) => {
      if (!mounted.current || stopRequested.current || !text?.trim()) {
        if (stopRequested.current) {
           console.log(`[TTS] Speak request ignored because stop was requested. Index: ${index}`);
        }
        // 재생 중지 요청이 있었거나, 텍스트가 비었으면 여기서 종료 (onDone 호출 안 함)
        return;
      }

      console.log(`[TTS] Speaking index: ${index}, Text: "${text.substring(0, 20)}..."`);
      internalIndex.current = index; // 내부 인덱스 업데이트
      setCurrentIndex(index); // 외부(부모) 인덱스 업데이트
      smoothCenter(index); // 화면 중앙 정렬

      setIsSpeaking(true); // 재생 상태로 변경 (실제 재생 시작 전 UI 업데이트)
      // MusicControls 관련 호출은 여기서 제거됨!

      try {
        if (isNative) {
          const settings = getTtsSettings();
          await TextToSpeech.speak({
            text,
            lang: 'ko-KR',
            rate: settings.rate ?? 1.0,
            pitch: settings.pitch ?? 1.0,
            volume: 1.0,
            category: 'ambient', // iOS 오디오 세션 카테고리
          });

          // 네이티브 speak 함수는 재생이 끝나면 resolve됨
          if (!stopRequested.current && mounted.current) {
            console.log(`[TTS] Native speech finished. Index: ${index}`);
            onDone(); // 중지 요청이 없었다면 다음 작업 수행
          } else {
             console.log(`[TTS] Native speech finished but stop was requested. Index: ${index}`);
          }
        } else {
          // Web Speech API
          if (!synth.current) {
            console.error('[TTS] Web Speech Synthesis not available.');
            stopSpeech(true); // 문제가 있으면 중지
            return;
          }

          const utter = new SpeechSynthesisUtterance(text);
          currentUtterance.current = utter; // 현재 발화 저장
          const settings = getTtsSettings();
          utter.lang = 'ko-KR';
          utter.rate = settings.rate ?? 1.0;
          utter.pitch = settings.pitch ?? 1.0;

          utter.onend = () => {
            currentUtterance.current = null; // 발화 끝났으므로 참조 제거
            if (!stopRequested.current && mounted.current) {
              console.log(`[TTS] Web speech finished. Index: ${index}`);
              // 웹에서는 onend 후 약간의 딜레이를 주는 것이 자연스러울 수 있음
              setTimeout(onDone, 50); // 다음 문장 재생 (약간의 딜레이)
            } else {
               console.log(`[TTS] Web speech finished but stop was requested. Index: ${index}`);
            }
          };

          utter.onerror = (event) => {
            console.error('[TTS] Web Speech Synthesis error:', event.error);
            currentUtterance.current = null;
            // 웹 에러 시 사용자 경험을 위해 현재 위치에서 멈춤
            stopSpeech(true);
          };

          synth.current.speak(utter);
        }
      } catch (e) {
        console.error(`[TTS] Error speaking index ${index}:`, e);
        // 예외 발생 시 현재 위치에서 멈춤
        stopSpeech(true);
      }
    },
    [isNative, setCurrentIndex, smoothCenter, stopSpeech] // mounted, internalIndex, stopRequested는 ref
  );

  /* ------------------------- Play-next routine ------------------------- */
  // 지정된 인덱스부터 순차적으로 재생
  const playFrom = useCallback(
    (startIndex: number) => {
      if (!mounted.current || stopRequested.current) return;

      if (startIndex >= sentences.length) {
        console.log('[TTS] Reached end of sentences.');
        stopSpeech(true); // 마지막 문장까지 재생 완료 시 현재 위치에서 정지
        return;
      }

      const textToSpeak = sentences[startIndex];
      if (!textToSpeak?.trim()) {
        // 현재 문장이 비어있으면 다음 문장으로 건너뛰기
        console.log(`[TTS] Skipping empty sentence at index: ${startIndex}`);
        playFrom(startIndex + 1);
        return;
      }

      // speakText 호출, 완료되면 다음 인덱스(startIndex + 1)로 playFrom 재귀 호출
      speakText(textToSpeak, startIndex, () => {
        if (mounted.current && !stopRequested.current) {
          playFrom(startIndex + 1);
        }
      });
    },
    [sentences, speakText, stopSpeech] // mounted, stopRequested는 ref
  );

  /* ------------------------- Control handlers -------------------------- */
  // 재생/일시정지 버튼 핸들러
  const handlePlayPause = useCallback(async () => {
    if (isSpeaking) {
      // 재생 중일 때 -> 일시정지
      stopSpeech(true); // 현재 위치에서 멈추고 상태 동기화
    } else {
      // 멈춤 상태일 때 -> 재생 시작
      console.log(`[TTS] Play requested from index: ${internalIndex.current}`);
      stopRequested.current = false; // 중지 요청 플래그 해제
      KeepAwake.keepAwake().catch(() => {}); // 화면 꺼짐 방지 활성화

      if (isNative) {
        // 네이티브 환경: MusicControls 생성 (아직 안 만들어졌다면) 및 상태 업데이트
        await createMusicControls(); // 이미 생성되었다면 내부는 무시됨
        await setMusicControlsPlaying(true); // 재생 상태로 업데이트
      } else if (isIOSWeb) {
        // iOS 웹: voices 로드 대기 및 예열 (필요시)
        await waitUntilVoicesReady();
        if (synth.current && synth.current.speaking) {
            // iOS 웹에서 가끔 speak 직후 speaking 상태가 true인데 소리가 안나는 경우, cancel 후 재시도
             console.warn('[TTS] iOS Web: synth was already speaking, cancelling before new play.');
             synth.current.cancel();
        }
      }

      // 현재 internalIndex부터 재생 시작
      playFrom(internalIndex.current);
    }
  }, [isSpeaking, isNative, isIOSWeb, internalIndex, stopSpeech, createMusicControls, setMusicControlsPlaying, playFrom]); // internalIndex는 ref

  // 이전/다음 건너뛰기 핸들러
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
           await TextToSpeech.stop(); // 진행 중인 네이티브 TTS 중단
        } catch(e) { console.warn('[TTS] TextToSpeech.stop error during skip:', e); }
      } else {
        cancelWebUtterance(); // 진행 중인 웹 TTS 중단
      }

      // 2. 상태 즉시 업데이트 (setIsSpeaking은 playFrom에서 관리)
      // setIsSpeaking(false); // 여기서는 isSpeaking 상태를 바로 바꾸지 않음 (playFrom에서 바뀜)

      // 3. 인덱스 이동 및 UI 업데이트
      internalIndex.current = nextIndex;
      setCurrentIndex(nextIndex);
      smoothCenter(nextIndex);

      // 4. MusicControls 상태 업데이트 (hasPrev/hasNext) - 중요!
      //    create를 다시 호출하여 hasPrev/hasNext 업데이트 (plugin이 별도 update 미지원 가정)
      if (isNative && musicReady.current) {
         try {
            console.log(`[TTS] Re-creating MusicControls for skip update. Index: ${nextIndex}`);
            await MusicControls.create({
               track: scriptureName || '경전 낭독',
               artist: '연등',
               isPlaying: wasSpeaking, // 스킵 후에도 이전 재생 상태 유지 시도
               dismissable: false,
               hasPrev: nextIndex > 0,
               hasNext: nextIndex < sentences.length - 1,
             });
             // isPlaying 상태가 create 후에도 유지되는지 확인 필요, 안되면 updateIsPlaying 추가 호출
             if (!wasSpeaking) await setMusicControlsPlaying(false); // 만약 멈춤 상태에서 스킵했다면, create 후 false로 맞춰줌

         } catch(e) {
             console.error('[TTS] Failed to re-create MusicControls during skip:', e);
         }
      }

      // 5. 새 위치에서 재생 시작 (만약 스킵 전에 재생 중이었다면)
      if (wasSpeaking) {
         stopRequested.current = false; // 재생을 계속할 것이므로 중지 요청 해제
         playFrom(nextIndex); // 새 위치에서 재생 시작
      } else {
         // 멈춤 상태에서 스킵한 경우: 재생은 시작하지 않고 인덱스만 이동됨
         // (사용자가 다시 플레이 버튼을 눌러야 재생 시작)
      }
    },
    [isNative, sentences.length, scriptureName, isSpeaking, setCurrentIndex, smoothCenter, playFrom, setMusicControlsPlaying] // internalIndex, musicReady, stopRequested는 ref
  );


  /* ----------------------------- Lifecycle ----------------------------- */
  useEffect(() => {
    mounted.current = true; // 컴포넌트 마운트됨
    console.log(`[TTS] Component mounted. Platform: ${platform}, Native: ${isNative}`);

    // Web Speech API 초기화 (웹 환경에서만)
    if (!isNative && 'speechSynthesis' in window) {
      synth.current = window.speechSynthesis;
      // iOS Safari 예열 (페이지 로드 후 첫 speak 호출 지연 방지용)
      if (isIOSWeb) {
        waitUntilVoicesReady().then(() => {
          if (synth.current) {
             // 무음 발화 시도 (사용자 제스처 필요할 수 있음)
            try {
                const warm = new SpeechSynthesisUtterance(' ');
                warm.volume = 0;
                synth.current.speak(warm);
            } catch (e) {
                console.warn('[TTS] iOS Web warmup speech failed (likely needs user gesture):', e);
            }
          }
        });
      }
    }

    // 네이티브 환경: MusicControls 리스너 등록
    let handle: PluginListenerHandle | null = null;
    const registerMusicControlsListener = async () => {
      if (isNative) {
        try {
          console.log('[TTS] Adding MusicControls listener...');
          handle = await MusicControls.addListener(
            'controlsNotification',
            (info) => {
              if (!mounted.current) return; // 언마운트 후 이벤트 무시
              console.log('[TTS] MusicControls notification received:', info.action);
              switch (info.action) {
                case 'music-controls-play':
                  // 네이티브 컨트롤에서 '재생' 누르면 handlePlayPause 호출
                  if (!isSpeaking) handlePlayPause();
                  break;
                case 'music-controls-pause':
                  // 네이티브 컨트롤에서 '일시정지' 누르면 handlePlayPause 호출
                  if (isSpeaking) handlePlayPause();
                  break;
                case 'music-controls-next':
                  skip(1);
                  break;
                case 'music-controls-previous':
                  skip(-1);
                  break;
                case 'music-controls-stop': // Android stop 버튼 등
                case 'music-controls-destroy': // Android 알림 닫기 등
                  stopSpeech(true); // 완전 중지 처리
                  // 필요시 추가 작업 (예: 앱 종료 로직과 연동)
                  break;
              }
            }
          );
          listenerHandle.current = handle; // 핸들 저장
           console.log('[TTS] MusicControls listener added.');
        } catch (error) {
          console.error('[TTS] Failed to add MusicControls listener:', error);
        }
      }
    };

    registerMusicControlsListener();

    // Cleanup 함수 (컴포넌트 언마운트 시)
    return () => {
      mounted.current = false; // 컴포넌트 언마운트됨
      console.log('[TTS] Component unmounting...');

      // 진행 중인 모든 작업 중지
      stopSpeech(false); // 언마운트 시에는 부모 상태 동기화 불필요

      // 리스너 제거
      if (listenerHandle.current) {
        console.log('[TTS] Removing MusicControls listener...');
        listenerHandle.current.remove().catch((e) => console.error('[TTS] Failed to remove listener:', e));
        listenerHandle.current = null;
      }

      // MusicControls 제거
      destroyMusicControls(); // 네이티브 리소스 정리

      // Web Speech API 정리 (필요시)
      if (synth.current) {
        synth.current.cancel(); // 남아있는 발화 취소
      }
      console.log('[TTS] Component unmounted cleanup finished.');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNative, isIOSWeb, platform, stopSpeech, handlePlayPause, skip, destroyMusicControls]); // 초기화 로직이므로 의존성 최소화

  /* 외부 인덱스 변경 감지 -> 재생 중이면 멈추고 내부 인덱스 동기화 */
  useEffect(() => {
    if (mounted.current && externalIndex !== internalIndex.current) {
      console.log(`[TTS] External index changed to ${externalIndex}. Internal was ${internalIndex.current}. Speaking: ${isSpeaking}`);
      if (isSpeaking) {
        stopSpeech(false); // 재생 중이었다면 멈춤 (부모 상태는 이미 변경되었으므로 false)
      }
      // 외부 변경에 따라 내부 인덱스 즉시 동기화
      internalIndex.current = externalIndex;
    }
  }, [externalIndex, isSpeaking, stopSpeech]); // internalIndex는 ref이므로 의존성 불필요

  // 재생 상태 변경 시 외부 콜백 호출
  useEffect(() => {
    if (mounted.current) {
        onPlaybackStateChange?.(isSpeaking);
    }
  }, [isSpeaking, onPlaybackStateChange]); // mounted는 ref

  /* -------------------------------- Render ------------------------------- */
  return (
    <div className="fixed bottom-[84px] left-1/2 -translate-x-1/2 flex items-center gap-4 z-50 bg-white/80 backdrop-blur-sm p-2 rounded-full shadow-lg">
      {/* 이전 버튼 */}
      <button
        onClick={() => skip(-1)}
        aria-label="이전 문장"
        disabled={internalIndex.current <= 0 || sentences.length === 0} // 문장 없거나 첫 문장일 때 비활성화
        className="bg-red-light text-white rounded-full w-12 h-12 flex items-center justify-center shadow-md disabled:opacity-50 transition-opacity duration-200"
      >
        <SkipBack size={24} />
      </button>

      {/* 재생/일시정지 버튼 */}
      <button
        onClick={handlePlayPause}
        aria-label={isSpeaking ? '일시정지' : '재생'}
        disabled={sentences.length === 0} // 문장 없으면 비활성화
        className="bg-red-light text-white rounded-full w-16 h-16 flex items-center justify-center shadow-lg disabled:opacity-50 transition-opacity duration-200"
      >
        {isSpeaking ? <Pause size={36} fill="currentColor" /> : <Play size={36} fill="currentColor" />}
      </button>

      {/* 다음 버튼 */}
      <button
        onClick={() => skip(1)}
        aria-label="다음 문장"
        disabled={internalIndex.current >= sentences.length - 1 || sentences.length === 0} // 문장 없거나 마지막 문장일 때 비활성화
        className="bg-red-light text-white rounded-full w-12 h-12 flex items-center justify-center shadow-md disabled:opacity-50 transition-opacity duration-200"
      >
        <SkipForward size={24} />
      </button>
    </div>
  );
};

export default TTSPlayer;