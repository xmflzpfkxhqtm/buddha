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
    }
  }, []);

  /* ---------- 외부 상태 전달 ---------- */
  useEffect(() => onPlaybackStateChange?.(isSpeakingState), [isSpeakingState, onPlaybackStateChange]);

  /* ---------- 즉시 정지 ---------- */
  const stopSpeech = useCallback((updateParentIndex = true) => {
    stopRequested.current = true;

    // ➡️ 네이티브(WebView)  
    if (isNative.current) {
      TextToSpeech.stop().catch(() => {});
    }

    // ➡️ 웹
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

  /* ---------- 말하기 ---------- */
  const speakText = (
    text: string,
    index: number,
    onEnd: () => void
  ) => {
    if (isNative.current) {
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
        .catch((e) => {
          console.error('[TTS] native error', e);
          stopSpeech();
        });
    } else {
      const utterance = new SpeechSynthesisUtterance(text);
      currentUtterance.current = utterance;
      utterance.lang = 'ko-KR';
      utterance.rate = 0.9;

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
        console.error('[TTS] web error', e);
        stopSpeech();
      };

      if (synth.current?.speaking || synth.current?.pending) {
        synth.current.cancel();
        setTimeout(() => synth.current?.speak(utterance), 80);
      } else {
        synth.current?.speak(utterance);
      }
    }
  };

  /* ---------- 연속 재생 ---------- */
  const playNextSpeech = useCallback((cur: number) => {
    const next = cur + 1;
    if (next >= sentences.length || stopRequested.current) {
      stopSpeech(false);
      return;
    }
    const nextText = sentences[next];
    if (!nextText?.trim()) {
      playNextSpeech(next);
      return;
    }
    speakText(nextText, next, () => {
      if (!stopRequested.current) setTimeout(() => playNextSpeech(next), 120);
    });
  }, [sentences, stopSpeech]);

  /* ---------- 버튼 ---------- */
  const handlePlayPause = useCallback(() => {
    if (isSpeakingState) {
      stopSpeech();
    } else {
      stopRequested.current = false;
      KeepAwake.keepAwake().catch();

      const text = sentences[parentCurrentIndex];
      if (!text?.trim()) return;

      speakText(text, parentCurrentIndex, () => {
        if (!stopRequested.current) setTimeout(() => playNextSpeech(parentCurrentIndex), 120);
      });
    }
  }, [isSpeakingState, parentCurrentIndex, sentences, stopSpeech, playNextSpeech]);

  /* ---------- 경전 변경·언마운트 시 강제 정지 ---------- */
  useEffect(() => {
    if (isSpeakingState) stopSpeech(false);
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
