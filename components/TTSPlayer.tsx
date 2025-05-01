'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';
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
  const isMounted = useRef(false);

  /* -------------------------------------------------- */
  /* mount / unmount                                    */
  /* -------------------------------------------------- */
  useEffect(() => {
    isMounted.current = true;
    console.log(
      `[TTS] mount – platform=${platform.current}, native=${isNative.current}, iOSWeb=${isIOSWeb.current}`
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
      stopSpeech(false);
      if (isNative.current) TextToSpeech.stop().catch(() => {});
      else synth.current?.cancel();
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
      } // eslint-disable-next-line @typescript-eslint/no-unused-vars
      catch (_) 
       {
        /* noop */
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
  const speakText = useCallback(
    async (text: string, index: number, onEnd: () => void) => {
      if (!isMounted.current || stopRequested.current) return;

      internalCurrentIndex.current = index;
      setParentCurrentIndex(index);
      smoothCenter(index);
      setIsSpeakingState(true);

      try {
        if (isNative.current) {
          await TextToSpeech.speak({
            text,
            lang: 'ko-KR',
            rate: 0.7,
            pitch: 0.7,
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
          utter.rate = 0.6;
          utter.pitch = 0.1;
          
          utter.onend = () => {
            currentUtterance.current = null;
            if (!stopRequested.current && isMounted.current) {
              // 👉 문장 끝난 뒤 500ms 쉬고 다음으로 넘어감
              setTimeout(() => {
                onEnd();
              }, 500); // ← 이 값을 조절하면 문장 간 간격이 바뀜
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
    [setParentCurrentIndex, smoothCenter, stopSpeech]
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
  /* render                                             */
  /* -------------------------------------------------- */
  return (
    <button
      onClick={handlePlayPause}
      className="fixed bottom-[84px] left-1/2 -translate-x-1/2 bg-red-light text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg z-50"
      aria-label={isSpeakingState ? '일시정지' : '재생'}
      disabled={sentences.length === 0}
    >
      {isSpeakingState ? <Pause size={32} /> : <Play size={32} />}
    </button>
  );
};

export default TTSPlayer;
