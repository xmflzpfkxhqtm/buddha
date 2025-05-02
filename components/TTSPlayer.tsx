'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Capacitor } from '@capacitor/core';
// @ts-ignore - MusicControls 타입 정의가 없을 경우 사용
import MusicControls from 'capacitor-music-controls-plugin';

// --- Interfaces ---

interface TTSPlayerProps {
  sentences: string[];
  scriptureName: string; // ★ 부모로부터 받을 경전명
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  onPlaybackStateChange?: (isPlaying: boolean) => void;
  smoothCenter: (index: number) => void;
}

// MusicControls 업데이트 시 사용할 옵션 타입 정의
interface MusicControlsInfo {
  track: string;
  artist: string;
  album?: string; // 앨범은 선택적
  isPlaying: boolean;
  hasNext: boolean;
  hasPrev: boolean;
}

// MusicControls 이벤트 리스너 타입 정의
interface MusicControlsNotification {
  action: 'music-controls-next' | 'music-controls-previous' | 'music-controls-pause' | 'music-controls-play' | 'music-controls-stop' | 'music-controls-destroy';
}

// --- iOS Web 전용 유틸 ---
function waitUntilVoicesReady(): Promise<void> {
  // (기존 코드와 동일)
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
}


// --- Component ---

const TTSPlayer: React.FC<TTSPlayerProps> = ({
  sentences,
  scriptureName, // ★ props 추가
  currentIndex: parentCurrentIndex,
  setCurrentIndex: setParentCurrentIndex,
  onPlaybackStateChange,
  smoothCenter,
}) => {
  // --- Refs & States ---
  const [isSpeakingState, setIsSpeakingState] = useState(false);
  const synth = useRef<SpeechSynthesis | null>(null);
  const currentUtterance = useRef<SpeechSynthesisUtterance | null>(null);
  const stopRequested = useRef(false); // 사용자가 명시적으로 중지/일시정지 요청했는지 여부
  const internalCurrentIndex = useRef<number>(parentCurrentIndex); // 내부 상태 관리용 인덱스

  const platform = useRef(Capacitor.getPlatform());
  const isNative = useRef(platform.current !== 'web');
  const isIOSWeb = useRef(
    platform.current === 'web' && /iPad|iPhone|iPod/.test(navigator.userAgent)
  );
  const isAndroidWeb = useRef(
    platform.current === 'web' && /Android/.test(navigator.userAgent)
  );
  const isMounted = useRef(false);
  const musicControlsCreated = useRef(false); // MusicControls 최초 생성 여부

  // --- Music Controls ---

  const getMusicControlOptions = useCallback((index: number, playing: boolean): MusicControlsInfo => {
    return {
      track: scriptureName || '경전 낭독',
      artist: '연등',
      isPlaying: playing,
      hasNext: index < sentences.length - 1,
      hasPrev: index > 0,
    };
  }, [scriptureName, sentences.length]);

  const updateMusicControls = useCallback(async (info: MusicControlsInfo) => {
    if (!isNative.current || !isMounted.current) return;

    try {
      if (!musicControlsCreated.current) {
        console.log('[MusicControls] Creating:', info);
        // @ts-ignore
        await MusicControls.create({
          track: info.track,
          artist: info.artist,
          album: info.album || '연등',
          isPlaying: info.isPlaying,
          dismissable: false,
          hasPrev: info.hasPrev,
          hasNext: info.hasNext,
        });
        // @ts-ignore
        if (Capacitor.getPlatform() === 'ios') {
          // @ts-ignore
          await MusicControls.updateIsPlaying(info.isPlaying);
        }
        musicControlsCreated.current = true;
      } else {
        console.log('[MusicControls] Updating:', info);
        // @ts-ignore
        await MusicControls.updateIsPlaying(info.isPlaying);
      }
    } catch (error) {
      console.error('[TTS] Failed to update Music Controls:', error);
      musicControlsCreated.current = false;
      try { 
        // @ts-ignore
        await MusicControls.destroy(); 
      } catch { /* ignore */ }
    }
  }, [isNative]);

  // --- TTS Core Logic ---

  const stopSpeech = useCallback(
    async (resetIndexToParent = false) => {
      console.log('[TTS] Stopping speech...');
      stopRequested.current = true;
      if (currentUtterance.current) {
        currentUtterance.current.onend = null;
        currentUtterance.current.onerror = null;
        currentUtterance.current = null;
      }

      try {
        if (isNative.current) {
          await TextToSpeech.stop();
        } else {
          synth.current?.cancel();
        }
      } catch (error) {
        console.error('[TTS] Error stopping speech:', error);
      } finally {
        if (isMounted.current) {
          const finalIndex = internalCurrentIndex.current;
          setIsSpeakingState(false);
          if (resetIndexToParent) {
            setParentCurrentIndex(finalIndex);
          }
          updateMusicControls(getMusicControlOptions(finalIndex, false));
        }
        KeepAwake.allowSleep().catch(() => {});
      }
    },
    [isNative, setParentCurrentIndex, updateMusicControls, getMusicControlOptions]
  );

  // --- Lifecycle Effects ---

  useEffect(() => {
    isMounted.current = true;
    console.log(
      `[TTS] Mount – Platform=${platform.current}, Native=${isNative.current}, iOSWeb=${isIOSWeb.current}, AndroidWeb=${isAndroidWeb.current}`
    );

    // Android 알림 권한 요청
    if (isNative.current && Capacitor.getPlatform() === 'android') {
      // @ts-ignore
      Capacitor.Permissions.requestPermission('notifications').catch(() => {});
    }

    // 웹 TTS 초기화
    if (!isNative.current && 'speechSynthesis' in window) {
      synth.current = window.speechSynthesis;
      if (isIOSWeb.current) {
        waitUntilVoicesReady().then(() => {
          const warm = new SpeechSynthesisUtterance(' ');
          warm.volume = 0;
          synth.current?.speak(warm);
        }).catch((e: Error) => console.error("Error warming up iOS Web TTS", e));
      } else {
        waitUntilVoicesReady().catch((e: Error) => console.error("Error waiting for voices", e));
      }
    }

    // 네이티브 MusicControls 이벤트 리스너 설정
    let musicControlsListener: any = null;
    if (isNative.current) {
      // @ts-ignore
      musicControlsListener = MusicControls.addListener('controlsNotification', (info: MusicControlsNotification) => {
        console.log(`[MusicControls] Event received: ${info.action}`);
        switch (info.action) {
          case 'music-controls-next':
            skipForward();
            break;
          case 'music-controls-previous':
            skipBackward();
            break;
          case 'music-controls-pause':
            if (isSpeakingState) handlePlayPause();
            break;
          case 'music-controls-play':
            if (!isSpeakingState) handlePlayPause();
            break;
          case 'music-controls-stop':
          case 'music-controls-destroy':
            stopSpeech(true);
            break;
        }
      });
    }

    return () => {
      isMounted.current = false;
      console.log('[TTS] Unmount');

      if (isNative.current) {
        TextToSpeech.stop().catch(() => {});
      } else {
        synth.current?.cancel();
      }

      if (musicControlsListener) {
        musicControlsListener.remove();
      }
      if (isNative.current && musicControlsCreated.current) {
        // @ts-ignore
        MusicControls.destroy().catch(() => {});
        musicControlsCreated.current = false;
      }

      KeepAwake.allowSleep().catch(() => {});
    };
  }, []);

  // 외부로 재생 상태 전파
  useEffect(() => {
    onPlaybackStateChange?.(isSpeakingState);
  }, [isSpeakingState, onPlaybackStateChange]);

  // 부모로부터 받은 currentIndex가 변경되면 내부 상태 동기화 및 재생 중지 (선택적)
  useEffect(() => {
    // 재생 중에 외부에서 인덱스가 강제로 변경되면 일단 중지
    if (isSpeakingState && parentCurrentIndex !== internalCurrentIndex.current) {
       console.log(`[TTS] External index change (${parentCurrentIndex}) while playing. Stopping.`);
       stopSpeech(false); // 부모 인덱스를 다시 업데이트할 필요는 없음
       internalCurrentIndex.current = parentCurrentIndex; // 내부 인덱스는 동기화
    } else if (!isSpeakingState) {
       // 재생 중이 아닐 때는 내부 인덱스를 부모 인덱스와 맞춰줌
       internalCurrentIndex.current = parentCurrentIndex;
    }
 }, [parentCurrentIndex, isSpeakingState, stopSpeech]); // isSpeakingState와 stopSpeech 추가

  // --- TTS Core Logic ---

  // TTS 설정 가져오기 (플랫폼별)
  const getTtsSettings = useCallback(() => {
    if (isNative.current) {
      // 네이티브 TTS 설정 (Android/iOS 공통 또는 분기)
      return { rate: 1.0, pitch: 1.0, volume: 1.0 }; // 필요에 따라 조절
    }
    // 웹 TTS 설정
    if (isAndroidWeb.current) {
      return { rate: 1.0, pitch: 1.0 }; // Android Web
    }
    // iOS Web 및 기타 데스크탑 Web
    return { rate: 0.9, pitch: 1.1 }; // 예시 값
  }, [isNative, isAndroidWeb]);

  // 텍스트 음성 변환 실행
  const speakText = useCallback(
    async (text: string, index: number, onEndCallback: () => void) => {
      if (!isMounted.current || stopRequested.current || !text?.trim()) {
        console.log('[TTS] Speak cancelled or invalid text');
        if (!text?.trim()) { // 빈 텍스트면 바로 종료 콜백 호출 (다음 문장으로)
          onEndCallback();
        } else {
           setIsSpeakingState(false);
           updateMusicControls(getMusicControlOptions(index, false));
        }
        return;
      }

      console.log(`[TTS] Speaking index ${index}: "${text.substring(0, 30)}..."`);
      internalCurrentIndex.current = index;
      setParentCurrentIndex(index); // 부모에게 현재 인덱스 알림
      smoothCenter(index);          // UI 스크롤
      setIsSpeakingState(true);
      await updateMusicControls(getMusicControlOptions(index, true)); // MusicControls 업데이트 (재생 중)

      try {
        if (isNative.current) {
          const settings = getTtsSettings();
          await TextToSpeech.speak({
            text,
            lang: 'ko-KR',
            rate: settings.rate,
            pitch: settings.pitch,
            volume: settings.volume,
            category: 'playback', // 'ambient' 대신 'playback' 사용 시 오디오 포커싱 유리
          });
          // 네이티브 TTS는 speak Promise가 완료되면 종료된 것으로 간주
          if (isMounted.current && !stopRequested.current) {
            onEndCallback(); // 정상 종료 시 다음 작업 실행
          } else {
             // 중간에 멈춘 경우
             console.log('[TTS] Native speech ended prematurely or component unmounted.');
             if (isMounted.current) {
                setIsSpeakingState(false);
                updateMusicControls(getMusicControlOptions(internalCurrentIndex.current, false));
             }
          }
        } else {
          // Web Speech API
          if (!synth.current) throw new Error('Web Speech Synthesis not available.');

          const utter = new SpeechSynthesisUtterance(text);
          currentUtterance.current = utter;
          utter.lang = 'ko-KR';
          const settings = getTtsSettings();
          utter.rate = settings.rate;
          utter.pitch = settings.pitch;
          utter.volume = 1.0;

          utter.onend = () => {
            if (currentUtterance.current !== utter) return; // 다른 발화가 시작된 경우 무시
            currentUtterance.current = null;
            console.log(`[TTS] Web speech ended for index ${index}`);
            if (isMounted.current && !stopRequested.current) {
              // 약간의 딜레이 후 다음 작업 실행 (목소리 잘림 방지)
              setTimeout(onEndCallback, 50);
            } else {
               if (isMounted.current) {
                   setIsSpeakingState(false);
                   updateMusicControls(getMusicControlOptions(internalCurrentIndex.current, false));
               }
            }
          };

          utter.onerror = (event) => {
            if (currentUtterance.current !== utter) return;
            currentUtterance.current = null;
            console.error('[TTS] Web speech error:', event.error);
            stopSpeech(false); // 에러 발생 시 중지 (부모 인덱스는 현재 인덱스로 유지)
            updateMusicControls(getMusicControlOptions(internalCurrentIndex.current, false));
          };

          synth.current.speak(utter);
        }
      } catch (error) {
        console.error('[TTS] Speak error:', error);
        if (isMounted.current) {
          stopSpeech(false); // 에러 시 중지
          updateMusicControls(getMusicControlOptions(internalCurrentIndex.current, false));
        }
      }
    },
    [setParentCurrentIndex, smoothCenter, updateMusicControls, getMusicControlOptions, isNative, getTtsSettings, stopSpeech] // stopSpeech 추가
  );

  // 다음 문장 재생 로직
  const playNextSpeech = useCallback(
    (currentIndex: number) => {
      if (!isMounted.current || stopRequested.current) return;

      const nextIndex = currentIndex + 1;
      if (nextIndex >= sentences.length) {
        console.log('[TTS] Reached end of sentences.');
        stopSpeech(true); // 마지막 문장까지 끝나면 중지 (부모 인덱스 업데이트 함)
        return;
      }

      const nextText = sentences[nextIndex];
      // 빈 문장이면 다음으로 건너뛰기 (재귀 호출)
      if (!nextText?.trim()) {
        console.log(`[TTS] Skipping empty sentence at index ${nextIndex}`);
        playNextSpeech(nextIndex);
        return;
      }

      // 다음 문장 재생 호출
      speakText(nextText, nextIndex, () => {
         // 다음 문장 재생이 정상적으로 끝나면 다시 playNext 호출
         if (isMounted.current && !stopRequested.current) {
            playNextSpeech(nextIndex);
         }
      });
    },
    [sentences, speakText, stopSpeech] // sentences.length 대신 sentences 사용
  );

  // --- Event Handlers ---

  // 재생/일시정지 버튼 핸들러
  const handlePlayPause = useCallback(async () => {
    if (isSpeakingState) {
      console.log('[TTS] Pausing playback.');
      stopSpeech(false); // 일시정지 (인덱스는 현재 위치 유지, 부모 업데이트 X)
    } else {
      console.log('[TTS] Starting playback.');
      stopRequested.current = false; // 재생 시작 시 중지 요청 해제
      KeepAwake.keepAwake().catch(() => {}); // 화면 켜짐 유지

      // iOS Web TTS 준비 확인 (필요시)
      if (!isNative.current && isIOSWeb.current) {
        try {
           await waitUntilVoicesReady();
        } catch (e) {
           console.error("iOS Web TTS not ready", e);
           return; // 준비 안되면 재생 불가
        }
      }

      const startIndex = internalCurrentIndex.current; // 현재 내부 인덱스에서 시작
      const startText = sentences[startIndex];

      if (!startText?.trim()) {
        console.warn(`[TTS] Cannot start playback from empty sentence at index ${startIndex}. Trying next...`);
        // 현재 문장이 비어있으면 다음 문장부터 재생 시도
        playNextSpeech(startIndex);
        return;
      }

      // 현재 인덱스부터 재생 시작
      speakText(startText, startIndex, () => {
         // 첫 문장 재생이 끝나면 다음 문장 재생 로직 호출
         if (isMounted.current && !stopRequested.current) {
            playNextSpeech(startIndex);
         }
      });
    }
  }, [isSpeakingState, stopSpeech, isNative, isIOSWeb, sentences, speakText, playNextSpeech, internalCurrentIndex]);

  // 현재 발화 중인 것을 즉시 취소 (skip 로직용)
  const cancelCurrentSpeech = useCallback(async () => {
    console.log('[TTS] Cancelling current speech for skip...');
    if (currentUtterance.current) { // 웹 TTS 콜백 정리
        currentUtterance.current.onend = null;
        currentUtterance.current.onerror = null;
        currentUtterance.current = null;
    }
    if (isNative.current) {
        await TextToSpeech.stop().catch(() => {}); // 네이티브는 stop 호출
    } else {
        synth.current?.cancel(); // 웹은 cancel 호출
    }
    // Music Controls 상태는 speakText가 이어서 업데이트하므로 여기서 변경 불필요할 수 있음
    // 필요하다면 updateMusicControls(getMusicControlOptions(internalCurrentIndex.current, false)); 호출
  }, [isNative]);


  // 다음 문장으로 건너뛰기
  const skipForward = useCallback(async () => {
    const currentIdx = internalCurrentIndex.current;
    if (currentIdx >= sentences.length - 1) return; // 마지막 문장이면 무시

    console.log('[TTS] Skipping forward.');
    const wasSpeaking = isSpeakingState; // 스킵 전 재생 상태 기억
    stopRequested.current = false; // 스킵 후 재생될 수 있으므로 중지 요청 해제

    await cancelCurrentSpeech(); // 현재 발화 취소

    const nextIndex = currentIdx + 1;
    internalCurrentIndex.current = nextIndex; // 내부 인덱스 업데이트

    // 다음 문장 즉시 재생 (원래 재생 중이었던 경우에만 자동 재생)
    const nextText = sentences[nextIndex];
    if (!nextText?.trim()) {
       // 다음 문장이 비었으면 한 번 더 스킵 시도 (재귀는 위험할 수 있으니 상태 업데이트만)
       console.log(`[TTS] Skipped to empty sentence at ${nextIndex}, stopping.`);
       setParentCurrentIndex(nextIndex); // 부모 인덱스 업데이트
       smoothCenter(nextIndex);
       setIsSpeakingState(false);
       updateMusicControls(getMusicControlOptions(nextIndex, false));
       return;
    }

    // 다음 문장 텍스트로 speakText 호출
    speakText(nextText, nextIndex, () => {
       // 스킵된 문장의 재생이 끝나면, *원래 재생 중이었다면* 다음 문장 자동 재생
       if (wasSpeaking && isMounted.current && !stopRequested.current) {
          playNextSpeech(nextIndex);
       } else if (isMounted.current) {
          // 원래 재생 중이 아니었거나 중간에 멈췄다면 정지 상태로 둠
          setIsSpeakingState(false);
          updateMusicControls(getMusicControlOptions(nextIndex, false));
       }
    });

  }, [sentences, isSpeakingState, cancelCurrentSpeech, speakText, playNextSpeech, setParentCurrentIndex, smoothCenter, updateMusicControls, getMusicControlOptions]);


  // 이전 문장으로 건너뛰기
  const skipBackward = useCallback(async () => {
    const currentIdx = internalCurrentIndex.current;
    if (currentIdx <= 0) return; // 첫 문장이면 무시

    console.log('[TTS] Skipping backward.');
    const wasSpeaking = isSpeakingState;
    stopRequested.current = false;

    await cancelCurrentSpeech();

    const prevIndex = currentIdx - 1;
    internalCurrentIndex.current = prevIndex;

    const prevText = sentences[prevIndex];
     if (!prevText?.trim()) {
       console.log(`[TTS] Skipped back to empty sentence at ${prevIndex}, stopping.`);
       setParentCurrentIndex(prevIndex);
       smoothCenter(prevIndex);
       setIsSpeakingState(false);
       updateMusicControls(getMusicControlOptions(prevIndex, false));
       return;
    }

    // 이전 문장 텍스트로 speakText 호출
    speakText(prevText, prevIndex, () => {
      if (wasSpeaking && isMounted.current && !stopRequested.current) {
        playNextSpeech(prevIndex);
      } else if (isMounted.current) {
         setIsSpeakingState(false);
         updateMusicControls(getMusicControlOptions(prevIndex, false));
      }
    });

  }, [sentences, isSpeakingState, cancelCurrentSpeech, speakText, playNextSpeech, setParentCurrentIndex, smoothCenter, updateMusicControls, getMusicControlOptions]);


  // --- Render ---
  return (
    <div className="fixed bottom-[84px] left-1/2 -translate-x-1/2 flex items-center gap-4 z-50 bg-white/80 backdrop-blur-sm p-2 rounded-full shadow-lg">
      <button
        onClick={skipBackward}
        className="bg-red-light text-white rounded-full w-12 h-12 flex items-center justify-center shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="이전 문장"
        disabled={internalCurrentIndex.current <= 0 || sentences.length === 0}
      >
        <SkipBack size={24} />
      </button>
      <button
        onClick={handlePlayPause}
        className="bg-red-dark text-white rounded-full w-16 h-16 flex items-center justify-center shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label={isSpeakingState ? '일시정지' : '재생'}
        disabled={sentences.length === 0}
      >
        {isSpeakingState ? <Pause size={36} /> : <Play size={36} fill="currentColor" />}
      </button>
      <button
        onClick={skipForward}
        className="bg-red-light text-white rounded-full w-12 h-12 flex items-center justify-center shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="다음 문장"
        disabled={internalCurrentIndex.current >= sentences.length - 1 || sentences.length === 0}
      >
        <SkipForward size={24} />
      </button>
    </div>
  );
};

export default TTSPlayer;
