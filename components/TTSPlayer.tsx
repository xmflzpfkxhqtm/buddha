'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { MusicControls } from 'capacitor-music-controls-plugin';
// import * as MusicControls from 'capacitor-music-controls-plugin'; // ★ 제거

// --- Interfaces --- (기존과 동일)
interface TTSPlayerProps {
  sentences: string[];
  scriptureName: string;
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  onPlaybackStateChange?: (isPlaying: boolean) => void;
  smoothCenter: (index: number) => void;
}

interface MusicControlsInfo {
  track: string;
  artist: string;
  album?: string;
  isPlaying: boolean;
  hasNext: boolean;
  hasPrev: boolean;
}

interface MusicControlsNotification {
  action: 'music-controls-next' | 'music-controls-previous' | 'music-controls-pause' | 'music-controls-play' | 'music-controls-stop' | 'music-controls-destroy';
}


// --- iOS Web 전용 유틸 --- (기존과 동일)
function waitUntilVoicesReady(): Promise<void> {
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
  scriptureName,
  currentIndex: parentCurrentIndex,
  setCurrentIndex: setParentCurrentIndex,
  onPlaybackStateChange,
  smoothCenter,
}) => {
  // --- Refs & States --- (기존과 동일)
  const [isSpeakingState, setIsSpeakingState] = useState(false);
  const synth = useRef<SpeechSynthesis | null>(null);
  const currentUtterance = useRef<SpeechSynthesisUtterance | null>(null);
  const stopRequested = useRef(false);
  const internalCurrentIndex = useRef<number>(parentCurrentIndex);

  const platform = useRef(Capacitor.getPlatform());
  const isNative = useRef(platform.current !== 'web');
  const isIOSWeb = useRef(
    platform.current === 'web' && /iPad|iPhone|iPod/.test(navigator.userAgent)
  );
  const isAndroidWeb = useRef(
    platform.current === 'web' && /Android/.test(navigator.userAgent)
  );
  const isMounted = useRef(false);
  const musicControlsCreated = useRef(false);

  // ★ MusicControls 플러그인 가져오기 (네이티브에서만 유효)
  const NativeMusicControls = isNative.current ? Plugins.MusicControls : undefined;

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
        await MusicControls.create({
          track: info.track,
          artist: info.artist,
          album: info.album || '연등',
          isPlaying: info.isPlaying,
          dismissable: false,
          hasPrev: info.hasPrev,
          hasNext: info.hasNext,
        });
        // iOS는 create 후 isPlaying 업데이트가 필요할 수 있음 (플러그인 특성)
        if (Capacitor.getPlatform() === 'ios') {
          // @ts-expect-error: MusicControls 플러그인 타입 정의가 불완전할 수 있음
          await MusicControls.updateIsPlaying(info.isPlaying);
        }
        musicControlsCreated.current = true;
      } else {
        console.log('[MusicControls] Updating isPlaying state:', info.isPlaying);
        // @ts-expect-error: MusicControls 플러그인 타입 정의가 불완전할 수 있음
        await MusicControls.updateIsPlaying(info.isPlaying);
        // 참고: 트랙명 등 메타데이터 업데이트가 필요하다면 destroy/create 또는 플러그인 기능 확인 필요
      }
    } catch (error) {
      console.error('[TTS] Failed to update Music Controls:', error);
      musicControlsCreated.current = false; // 실패 시 생성 플래그 리셋
      // destroy 호출 시도 (오류 무시)
      try {
        // @ts-expect-error: MusicControls 플러그인 타입 정의가 불완전할 수 있음
        if (MusicControls) await MusicControls.destroy();
      } catch { /* ignore */ }
    }
    // ★ 의존성 배열에서 isNative 제거 (컴포넌트 마운트 시 고정값이므로 불필요)
    // ★ MusicControls는 isNative.current에 의존하므로, isNative가 바뀌지 않는 이상 불필요
  }, [getMusicControlOptions]); // updateMusicControls 자체는 MusicControls에 의존하지 않음 (내부에서 사용만 함)


  // --- Event Handlers (handlePlayPause, skipForward, skipBackward) ---
  // 이 함수들은 내부적으로 updateMusicControls를 호출하므로,
  // updateMusicControls의 의존성 배열이 올바르게 설정되어 있다면 별도 수정 불필요.

  // --- TTS Core Logic (stopSpeech, speakText, playNextSpeech, cancelCurrentSpeech) ---

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
              // ★ updateMusicControls 호출 시점에는 MusicControls가 유효해야 함
              updateMusicControls(getMusicControlOptions(finalIndex, false));
            }
            KeepAwake.allowSleep().catch(() => {});
          }
        },
        // ★ isNative는 고정값이므로 의존성 제거, MusicControls도 제거 (updateMusicControls 내부 사용)
        [setParentCurrentIndex, updateMusicControls, getMusicControlOptions]
      );


    const getTtsSettings = useCallback(() => {
        if (isNative.current) {
          return { rate: 1.0, pitch: 1.0, volume: 1.0 };
        }
        if (isAndroidWeb.current) {
          return { rate: 1.0, pitch: 1.0 };
        }
        return { rate: 0.9, pitch: 1.1 };
        // ★ isNative, isAndroidWeb은 고정값이므로 의존성 제거
      }, []);


      const speakText = useCallback(
        async (text: string, index: number, onEndCallback: () => void) => {
          // ... (speakText 시작 부분 로직 동일) ...
          if (!isMounted.current || stopRequested.current || !text?.trim()) {
            // ...
            // ★ updateMusicControls 호출
             updateMusicControls(getMusicControlOptions(index, false));
            // ...
            return;
          }

          // ... (인덱스, 상태 업데이트 등) ...
          setIsSpeakingState(true);
          // ★ updateMusicControls 호출
          await updateMusicControls(getMusicControlOptions(index, true));

          try {
            if (isNative.current) {
              const settings = getTtsSettings();
              await TextToSpeech.speak({ /* ... */ });
              if (isMounted.current && !stopRequested.current) {
                onEndCallback();
              } else {
                 if (isMounted.current) {
                    setIsSpeakingState(false);
                    // ★ updateMusicControls 호출
                    updateMusicControls(getMusicControlOptions(internalCurrentIndex.current, false));
                 }
              }
            } else {
              // ... (Web Speech API 로직) ...
              utter.onend = () => {
                // ...
                if (isMounted.current) {
                   setIsSpeakingState(false);
                   // ★ updateMusicControls 호출
                   updateMusicControls(getMusicControlOptions(internalCurrentIndex.current, false));
               }
                // ...
              };
              utter.onerror = (event) => {
                 // ...
                stopSpeech(false);
                // ★ updateMusicControls 호출 (stopSpeech 내부에서도 호출되지만 명시)
                 updateMusicControls(getMusicControlOptions(internalCurrentIndex.current, false));
              };
              synth.current.speak(utter);
            }
          } catch (error) {
            console.error('[TTS] Speak error:', error);
            if (isMounted.current) {
              stopSpeech(false);
              // ★ updateMusicControls 호출 (stopSpeech 내부에서도 호출되지만 명시)
              updateMusicControls(getMusicControlOptions(internalCurrentIndex.current, false));
            }
          }
        },
        // ★ 의존성 배열 업데이트: isNative 제거, getTtsSettings, stopSpeech 추가
        [setParentCurrentIndex, smoothCenter, updateMusicControls, getMusicControlOptions, getTtsSettings, stopSpeech]
      );


      const playNextSpeech = useCallback(
        (currentIndex: number) => {
           // ... (로직 동일) ...
           speakText(nextText, nextIndex, () => {
             if (isMounted.current && !stopRequested.current) {
                playNextSpeech(nextIndex);
             }
          });
        },
        // ★ 의존성 배열 업데이트
        [sentences, speakText, stopSpeech]
      );


      const handlePlayPause = useCallback(async () => {
        if (isSpeakingState) {
          console.log('[TTS] Pausing playback.');
          stopSpeech(false);
        } else {
          console.log('[TTS] Starting playback.');
          stopRequested.current = false;
          KeepAwake.keepAwake().catch(() => {});

          if (!isNative.current && isIOSWeb.current) {
            // ... (waitUntilVoicesReady) ...
          }

          const startIndex = internalCurrentIndex.current;
          const startText = sentences[startIndex];

          if (!startText?.trim()) {
             playNextSpeech(startIndex);
            return;
          }
          speakText(startText, startIndex, () => {
             if (isMounted.current && !stopRequested.current) {
                playNextSpeech(startIndex);
             }
          });
        }
        // ★ 의존성 배열 업데이트: isNative, isIOSWeb 제거
      }, [isSpeakingState, stopSpeech, sentences, speakText, playNextSpeech]);


      const cancelCurrentSpeech = useCallback(async () => {
        console.log('[TTS] Cancelling current speech for skip...');
        if (currentUtterance.current) {
            currentUtterance.current.onend = null;
            currentUtterance.current.onerror = null;
            currentUtterance.current = null;
        }
        if (isNative.current) {
            await TextToSpeech.stop().catch(() => {});
        } else {
            synth.current?.cancel();
        }
      }, [isNative]); // ★ isNative 의존성 유지 (조건문에서 사용)


      const skipForward = useCallback(async () => {
        // ... (skipForward 로직 앞부분 동일) ...
         if (!nextText?.trim()) {
           // ...
           // ★ updateMusicControls 호출
           updateMusicControls(getMusicControlOptions(nextIndex, false));
           return;
        }

        speakText(nextText, nextIndex, () => {
           if (wasSpeaking && isMounted.current && !stopRequested.current) {
              playNextSpeech(nextIndex);
           } else if (isMounted.current) {
              setIsSpeakingState(false);
              // ★ updateMusicControls 호출
              updateMusicControls(getMusicControlOptions(nextIndex, false));
           }
        });
        // ★ 의존성 배열 업데이트
      }, [sentences, isSpeakingState, cancelCurrentSpeech, speakText, playNextSpeech, setParentCurrentIndex, smoothCenter, updateMusicControls, getMusicControlOptions]);


      const skipBackward = useCallback(async () => {
         // ... (skipBackward 로직 앞부분 동일) ...
         if (!prevText?.trim()) {
           // ...
           // ★ updateMusicControls 호출
           updateMusicControls(getMusicControlOptions(prevIndex, false));
           return;
        }

        speakText(prevText, prevIndex, () => {
          if (wasSpeaking && isMounted.current && !stopRequested.current) {
            playNextSpeech(prevIndex);
          } else if (isMounted.current) {
             setIsSpeakingState(false);
             // ★ updateMusicControls 호출
             updateMusicControls(getMusicControlOptions(prevIndex, false));
          }
        });
        // ★ 의존성 배열 업데이트
      }, [sentences, isSpeakingState, cancelCurrentSpeech, speakText, playNextSpeech, setParentCurrentIndex, smoothCenter, updateMusicControls, getMusicControlOptions]);



  // --- Lifecycle Effects ---

  useEffect(() => {
    isMounted.current = true;
    const currentPlatform = Capacitor.getPlatform(); // 내부 변수로 사용
    const isNativePlatform = currentPlatform !== 'web'; // 내부 변수로 사용

    console.log(
      `[TTS] Mount – Platform=${currentPlatform}, Native=${isNativePlatform}`
    );

    // Android 알림 권한 요청 (Capacitor 5+ 스타일)
    if (isNativePlatform && currentPlatform === 'android') {
      // Capacitor Core의 Permissions 사용
      import('@capacitor/core').then(({ Permissions }) => {
          Permissions.query({ name: 'notifications' as any }).then(status => { // 'notifications'가 PermissionName 타입에 없을 수 있어 any 사용
             if (status.state === 'prompt') {
               Permissions.requestPermission({ name: 'notifications' as any }).catch(e => console.error("Notification permission request failed", e));
             } else if (status.state === 'denied') {
                console.warn("Notification permission was denied.");
             }
           }).catch(e => console.error("Notification permission query failed", e));
      }).catch(e => console.error("Failed to load Capacitor Permissions", e));
    }

    // 웹 TTS 초기화
    if (!isNativePlatform && 'speechSynthesis' in window) {
      synth.current = window.speechSynthesis;
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        waitUntilVoicesReady().then(() => {
          if (!synth.current) return;
          const warm = new SpeechSynthesisUtterance(' ');
          warm.volume = 0;
          synth.current.speak(warm);
        }).catch((e) => console.error("Error warming up iOS Web TTS", e));
      } else {
        waitUntilVoicesReady().catch((e) => console.error("Error waiting for voices", e));
      }
    }

    // 네이티브 MusicControls 이벤트 리스너 설정
    let musicControlsListener: PluginListenerHandle | null = null;
    // ★ MusicControls 사용
    if (MusicControls) {
        // @ts-expect-error: MusicControls 플러그인 타입 정의가 불완전할 수 있음
        MusicControls.addListener('controlsNotification', (info: MusicControlsNotification) => {
          console.log(`[MusicControls] Event received: ${info.action}`);
          // ★ 의존성 배열에 추가된 함수들 사용
          switch (info.action) {
            case 'music-controls-next':     skipForward();  break;
            case 'music-controls-previous': skipBackward(); break;
            case 'music-controls-pause':    if (isSpeakingState) handlePlayPause(); break;
            case 'music-controls-play':     if (!isSpeakingState) handlePlayPause(); break;
            case 'music-controls-stop':
            case 'music-controls-destroy':  stopSpeech(true); break;
            default: break; // 알려지지 않은 액션 무시
          }
        }).then(handle => {
            musicControlsListener = handle; // 리스너 핸들 저장
        }).catch(e => console.error("Failed to add MusicControls listener", e));
    }

    // 컴포넌트 언마운트 시 정리 작업
    return () => {
      isMounted.current = false;
      console.log('[TTS] Unmount');

      // ★ isNativePlatform 변수 사용
      if (isNativePlatform) {
        TextToSpeech.stop().catch(() => {});
      } else {
        synth.current?.cancel();
      }

      // 리스너 제거
      if (musicControlsListener) {
        musicControlsListener.remove().catch(e => console.error("Failed to remove listener", e));
      }
      // ★ MusicControls 사용 및 musicControlsCreated 확인
      if (MusicControls && musicControlsCreated.current) {
        // @ts-expect-error: MusicControls 플러그인 타입 정의가 불완전할 수 있음
        MusicControls.destroy().catch(() => {});
        musicControlsCreated.current = false;
      }

      KeepAwake.allowSleep().catch(() => {});
    };
    // ★ ESLint exhaustive-deps 수정: 필요한 콜백 함수들 추가
  }, [MusicControls, handlePlayPause, skipBackward, skipForward, stopSpeech, isSpeakingState]); // isSpeakingState 추가 (리스너 콜백 내부 조건에서 사용)


  // 외부로 재생 상태 전파 (기존과 동일)
  useEffect(() => {
    onPlaybackStateChange?.(isSpeakingState);
  }, [isSpeakingState, onPlaybackStateChange]);

  // 부모 currentIndex 변경 감지 (기존과 동일, 의존성 확인)
  useEffect(() => {
    if (isSpeakingState && parentCurrentIndex !== internalCurrentIndex.current) {
       console.log(`[TTS] External index change (${parentCurrentIndex}) while playing. Stopping.`);
       stopSpeech(false);
       internalCurrentIndex.current = parentCurrentIndex;
    } else if (!isSpeakingState) {
       internalCurrentIndex.current = parentCurrentIndex;
    }
 }, [parentCurrentIndex, isSpeakingState, stopSpeech]); // stopSpeech 의존성 확인


  // --- Render --- (기존과 거의 동일, unescaped entities 수정)
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
        // ★ isSpeakingState 값에 따라 aria-label 변경
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