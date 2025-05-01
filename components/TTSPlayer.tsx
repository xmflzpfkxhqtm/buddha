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

const TTSPlayer: React.FC<TTSPlayerProps> = ({
  sentences,
  currentIndex: parentCurrentIndex,
  setCurrentIndex: setParentCurrentIndex,
  onPlaybackStateChange,
  smoothCenter,
}) => {
  const [isSpeakingState, setIsSpeakingState] = useState(false);
  const synth = useRef<SpeechSynthesis | null>(null);
  const currentUtterance = useRef<SpeechSynthesisUtterance | null>(null);
  const stopRequested = useRef<boolean>(false);
  const internalCurrentIndex = useRef<number>(parentCurrentIndex);
  const isNative = useRef<boolean>(Capacitor.getPlatform() !== 'web');

  /* ---------- 초기화 ---------- */
  useEffect(() => {
    if (!isNative.current && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synth.current = window.speechSynthesis;
      synth.current.getVoices();
      console.log('[TTSPlayer] Web SpeechSynthesis initialized');
    }
  }, []);

  /* ---------- 외부에 상태 반영 ---------- */
  useEffect(() => {
    onPlaybackStateChange?.(isSpeakingState);
  }, [isSpeakingState, onPlaybackStateChange]);

  /* ---------- 재생·정지 ---------- */
  const stopSpeech = useCallback((updateParentIndex = true) => {
    stopRequested.current = true;

    // ⛔️ 네이티브 TTS 즉시 중단
    if (isNative.current) {
      TextToSpeech.stop().catch(() => {});
    }

    // ⛔️ 웹 TTS 즉시 중단
    if (!isNative.current && currentUtterance.current) {
      currentUtterance.current.onend = null;
      currentUtterance.current.onerror = null;
    }
    if (!isNative.current && synth.current && (synth.current.speaking || synth.current.pending)) {
      synth.current.cancel();
    }

    setIsSpeakingState(false);
    onPlaybackStateChange?.(false);

    if (updateParentIndex) {
      setParentCurrentIndex(internalCurrentIndex.current);
    }
    KeepAwake.allowSleep().catch();
  }, [setParentCurrentIndex, onPlaybackStateChange]);

  const speakText = (
    text: string,
    index: number,
    onEnd: () => void
  ) => {
    if (isNative.current) {
      /* ----- Native (Capacitor) ----- */
      stopRequested.current = false;
      setIsSpeakingState(true);
      onPlaybackStateChange?.(true);
      internalCurrentIndex.current = index;
      setParentCurrentIndex(index);
      smoothCenter(index);

      TextToSpeech.speak({
        text,
        lang: 'ko-KR',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
        category: 'ambient',
      })
        .then(() => {
          if (stopRequested.current) return;
          setIsSpeakingState(false);
          onPlaybackStateChange?.(false);
          onEnd();
        })
        .catch(e => {
          console.error('[TTSPlayer] Native TTS Error:', e);
          stopSpeech();
        });
    } else {
      /* ----- Web SpeechSynthesis ----- */
      const utterance = new SpeechSynthesisUtterance(text);
      currentUtterance.current = utterance;
      utterance.lang = 'ko-KR';
      utterance.rate = 0.9;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        if (stopRequested.current) {
          stopSpeech();
          return;
        }
        setIsSpeakingState(true);
        onPlaybackStateChange?.(true);
        internalCurrentIndex.current = index;
        setParentCurrentIndex(index);
        smoothCenter(index);
      };

      utterance.onend = () => {
        currentUtterance.current = null;
        setIsSpeakingState(false);
        onPlaybackStateChange?.(false);
        onEnd();
      };

      utterance.onerror = (e) => {
        console.error('[TTSPlayer] Web TTS Error:', e);
        stopSpeech();
      };

      if (synth.current?.speaking || synth.current?.pending) {
        synth.current.cancel();
        setTimeout(() => synth.current?.speak(utterance), 100);
      } else {
        synth.current?.speak(utterance);
      }
    }
  };

  const playNextSpeech = useCallback((currentIndex: number) => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= sentences.length || stopRequested.current) {
      stopSpeech(false);
      return;
    }
    const nextText = sentences[nextIndex];
    if (!nextText?.trim()) {
      playNextSpeech(nextIndex);
      return;
    }
    speakText(nextText, nextIndex, () => {
      if (!stopRequested.current) {
        setTimeout(() => playNextSpeech(nextIndex), 120);
      }
    });
  }, [sentences, stopSpeech]);

  const handlePlayPause = useCallback(() => {
    if (isSpeakingState) {
      stopSpeech();
    } else {
      stopRequested.current = false;
      KeepAwake.keepAwake().catch();

      const text = sentences[parentCurrentIndex];
      if (!text?.trim()) return;

      speakText(text, parentCurrentIndex, () => {
        if (!stopRequested.current) {
          setTimeout(() => playNextSpeech(parentCurrentIndex), 120);
        }
      });
    }
  }, [isSpeakingState, parentCurrentIndex, sentences, stopSpeech, playNextSpeech]);

  /* ---------- sentences 변경·언마운트 시 정지 ---------- */
  useEffect(() => {
    if (isSpeakingState) {
      stopSpeech(false);
    }
  }, [sentences, isSpeakingState, stopSpeech]);

  useEffect(() => () => stopSpeech(false), [stopSpeech]);

  /* ---------- 렌더 ---------- */
  return (
    <button
      onClick={handlePlayPause}
      className="fixed bottom-[84px] left-1/2 -translate-x-1/2 bg-red-light text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg z-50"
      aria-label={isSpeakingState ? '일시정지' : '재생'}
    >
      {isSpeakingState ? <Pause size={32} /> : <Play size={32} />}
    </button>
  );
};

export default TTSPlayer;
