'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Capacitor } from '@capacitor/core';

interface TTSPlayerProps {
  sentences: string[];
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  onPlaybackStateChange?: (isPlaying: boolean) => void;
  smoothCenter: (index: number) => void;
}

/* -------------------------------------------------- */
/* iOS-Web 전용 : voices 로드 대기 & 예열 유틸        */
/* -------------------------------------------------- */
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

const TTSPlayer: React.FC<TTSPlayerProps> = ({
  sentences,
  currentIndex: parentCurrentIndex,
  setCurrentIndex: setParentCurrentIndex,
  onPlaybackStateChange,
  smoothCenter,
}) => {
  /* -------------------------------------------------- */
  /* refs & states                                      */
  /* -------------------------------------------------- */
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

  /* -------------------------------------------------- */
  /* mount / unmount                                    */
  /* -------------------------------------------------- */
  useEffect(() => {
    isMounted.current = true;
    console.log(
      `[TTS] mount – platform=${platform.current}, native=${isNative.current}, iOSWeb=${isIOSWeb.current}, AndroidWeb=${isAndroidWeb.current}`
    );

    if (!isNative.current && 'speechSynthesis' in window) {
      synth.current = window.speechSynthesis;
      // iOS Safari 예열용 (무음 한 글자)
      if (isIOSWeb.current) {
        const warm = new SpeechSynthesisUtterance(' ');
        synth.current.speak(warm);
      }
    }

    return () => {
      isMounted.current = false;
      const isNativeAtCleanup = isNative.current;
      if (isNativeAtCleanup) {
        TextToSpeech.stop().catch(() => {});
      } else {
        synth.current?.cancel();
      }
      KeepAwake.allowSleep().catch(() => {});
    };
  }, []);

  /* 외부로 재생상태 알리기 */
  useEffect(() => {
    onPlaybackStateChange?.(isSpeakingState);
  }, [isSpeakingState, onPlaybackStateChange]);

  /* -------------------------------------------------- */
  /* stop                                               */
  /* -------------------------------------------------- */
  const stopSpeech = useCallback(
    async (updateParentIndex = true) => {
      stopRequested.current = true;
         try {
             if (isNative.current) await TextToSpeech.stop();
             else synth.current?.cancel();
           } catch (_) { /* noop */ 
        
   
      } finally {
        if (isMounted.current) {
          setIsSpeakingState(false);
          if (updateParentIndex) setParentCurrentIndex(internalCurrentIndex.current);
        }
        KeepAwake.allowSleep().catch(() => {});
      }
    },
    [setParentCurrentIndex]
  );

  /* -------------------------------------------------- */
  /* speakText                                          */
  /* -------------------------------------------------- */
  const getTtsSettings = useCallback(() => {
    if (isNative.current) {
      return { rate: 1.0, pitch: 0.7 };
    }
    if (isAndroidWeb.current) {
      return { rate: 1, pitch: 0.5 };
    }
    // PC Chrome 등
    return { rate: 0.8, pitch: 0.2 };
  }, []);

  const speakText = useCallback(
    async (text: string, index: number, onEnd: () => void) => {
      if (!isMounted.current || stopRequested.current) return;

      internalCurrentIndex.current = index;
      setParentCurrentIndex(index);
      smoothCenter(index);
      setIsSpeakingState(true);

      try {
        if (isNative.current) {
          const settings = getTtsSettings();
          await TextToSpeech.speak({
            text,
            lang: 'ko-KR',
            rate: settings.rate,
            pitch: settings.pitch,
            volume: 1.0,
            category: 'ambient',
          });
          if (!stopRequested.current && isMounted.current) onEnd();
        } else {
          if (!synth.current) {
            setIsSpeakingState(false);
            return;
          }

          const utter = new SpeechSynthesisUtterance(text);
          currentUtterance.current = utter;
          utter.lang = 'ko-KR';
          const settings = getTtsSettings();
          utter.rate = settings.rate;
          utter.pitch = settings.pitch;

          utter.onend = () => {
            currentUtterance.current = null;
            if (!stopRequested.current && isMounted.current) {
              setTimeout(() => {
                onEnd();
              }, 500);
            }
          };
          utter.onerror = () => stopSpeech(false);

          synth.current.speak(utter);
        }
      } catch (e) {
        console.error('[TTS] speak error', e);
        stopSpeech(false);
      }
    },
    [setParentCurrentIndex, smoothCenter, stopSpeech, getTtsSettings]
  );

  /* -------------------------------------------------- */
  /* playNext                                           */
  /* -------------------------------------------------- */
  const playNextSpeech = useCallback(
    (cur: number) => {
      const next = cur + 1;
      if (next >= sentences.length || stopRequested.current) {
        stopSpeech(false);
        return;
      }
      const txt = sentences[next];
      if (!txt?.trim()) {
        playNextSpeech(next);
        return;
      }
      speakText(txt, next, () => setTimeout(() => playNextSpeech(next), 120));
    },
    [sentences, speakText, stopSpeech]
  );

  /* -------------------------------------------------- */
  /* button handler                                     */
  /* -------------------------------------------------- */
  const handlePlayPause = useCallback(async () => {
    if (isSpeakingState) {
      stopSpeech();
      return;
    }

    stopRequested.current = false;
    KeepAwake.keepAwake().catch(() => {});

    if (isIOSWeb.current) await waitUntilVoicesReady();

    const txt = sentences[parentCurrentIndex];
    if (!txt?.trim()) return;

    speakText(txt, parentCurrentIndex, () =>
      setTimeout(() => playNextSpeech(parentCurrentIndex), 120)
    );
  }, [isSpeakingState, parentCurrentIndex, sentences, speakText, playNextSpeech, stopSpeech]);

  /* -------------------------------------------------- */
  /* 외부 index 변경 시 동기화                          */
  /* -------------------------------------------------- */
  useEffect(() => {
    if (isSpeakingState && parentCurrentIndex !== internalCurrentIndex.current) {
      stopSpeech(false);
    } else if (!isSpeakingState) {
      internalCurrentIndex.current = parentCurrentIndex;
    }
  }, [parentCurrentIndex, isSpeakingState, stopSpeech]);

  /* -------------------------------------------------- */
  /* skip                                               */
  /* -------------------------------------------------- */
  const cancelCurrentSpeech = async () => {
    if (isNative.current) {
      // 네이티브는 onend 콜백이 없어도 stop() 만 호출하면 OK
      await TextToSpeech.stop().catch(() => {});
    } else {
      // 웹 TTS: 기존 utter.onend 가 playNextSpeech 를 호출하지 못하게 제거
      if (currentUtterance.current) {
        currentUtterance.current.onend = null;
        currentUtterance.current.onerror = null;
      }
      synth.current?.cancel();
    }
  };
  /* ===================================================== */
  
  /* ---------- skipForward ------------------------------ */
  const skipForward = useCallback(async () => {
    if (internalCurrentIndex.current >= sentences.length - 1) return;
  
    const hadBeenPlaying = isSpeakingState;
  
    /* ① 현재 발화만 즉시 취소 (stopRequested 건드리지 않음) */
    await cancelCurrentSpeech();
  
    /* ② 다음 문장으로 이동 */
    internalCurrentIndex.current += 1;
    setParentCurrentIndex(internalCurrentIndex.current);
    smoothCenter(internalCurrentIndex.current);
  
    /* ③ 자동 재생 */
    const txt = sentences[internalCurrentIndex.current];
    if (!txt?.trim()) { skipForward(); return; }
  
    speakText(txt, internalCurrentIndex.current, () => {
      if (hadBeenPlaying) playNextSpeech(internalCurrentIndex.current);
    });
  }, [sentences, speakText, playNextSpeech, setParentCurrentIndex, isSpeakingState, smoothCenter]);
  
  /* ---------- skipBackward (구조 동일, 인덱스 -1) ------- */
  const skipBackward = useCallback(async () => {
    if (internalCurrentIndex.current <= 0) return;
    const hadBeenPlaying = isSpeakingState;
  
    await cancelCurrentSpeech();
  
    internalCurrentIndex.current -= 1;
    setParentCurrentIndex(internalCurrentIndex.current);
    smoothCenter(internalCurrentIndex.current);
  
    const txt = sentences[internalCurrentIndex.current];
    if (!txt?.trim()) { skipBackward(); return; }
  
    speakText(txt, internalCurrentIndex.current, () => {
      if (hadBeenPlaying) playNextSpeech(internalCurrentIndex.current);
    });
  }, [sentences, speakText, playNextSpeech, setParentCurrentIndex, isSpeakingState, smoothCenter]);
  
  /* -------------------------------------------------- */
  /* render                                             */
  /* -------------------------------------------------- */
  return (
    <div className="fixed bottom-[84px] left-1/2 -translate-x-1/2 flex items-center gap-4 z-50">
      <button
        onClick={skipBackward}
        className="bg-red-light text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg"
        aria-label="이전 문장"
        disabled={internalCurrentIndex.current <= 0}
      >
        <SkipBack size={24} />
      </button>
      <button
        onClick={handlePlayPause}
        className="bg-red-light text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg"
        aria-label={isSpeakingState ? '일시정지' : '재생'}
        disabled={sentences.length === 0}
      >
        {isSpeakingState ? <Pause size={32} /> : <Play size={32} />}
      </button>
      <button
        onClick={skipForward}
        className="bg-red-light text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg"
        aria-label="다음 문장"
        disabled={internalCurrentIndex.current >= sentences.length - 1}
      >
        <SkipForward size={24} />
      </button>
    </div>
  );
};

export default TTSPlayer;