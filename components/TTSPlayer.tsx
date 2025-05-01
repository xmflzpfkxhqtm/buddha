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

  // --- 초기화 ---
  useEffect(() => {
    if (!isNative.current && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synth.current = window.speechSynthesis;
      synth.current.getVoices();
      console.log('[TTSPlayer] Synth initialized.');
    }
  }, []);

  useEffect(() => {
    onPlaybackStateChange?.(isSpeakingState);
  }, [isSpeakingState, onPlaybackStateChange]);

  const stopSpeech = useCallback((updateParentIndex = true) => {
    stopRequested.current = true;
    if (!isNative.current && currentUtterance.current) {
      currentUtterance.current.onend = null;
      currentUtterance.current.onerror = null;
    }
    if (!isNative.current && synth.current && (synth.current.speaking || synth.current.pending)) {
      synth.current.cancel();
    }
    setIsSpeakingState(false);
    if (updateParentIndex) setParentCurrentIndex(internalCurrentIndex.current);
    KeepAwake.allowSleep().catch();
  }, [setParentCurrentIndex]);

  const speakText = async (text: string, index: number, onEnd: () => void) => {
    if (isNative.current) {
      try {
        await TextToSpeech.speak({
          text,
          lang: 'ko-KR',
          rate: 1.0,
          pitch: 1.0,
          volume: 1.0,
          category: 'ambient',
        });
        onEnd(); // 수동 호출 필요
      } catch (e) {
        console.error('[TTSPlayer] Native TTS Error:', e);
        stopSpeech();
      }
    } else {
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
        internalCurrentIndex.current = index;
        setParentCurrentIndex(index);
        smoothCenter(index);
      };

      utterance.onend = () => {
        currentUtterance.current = null;
        onEnd();
      };

      utterance.onerror = (e) => {
        console.error('[TTSPlayer] Web TTS Error:', e);
        stopSpeech();
      };

      if (synth.current?.speaking || synth.current?.pending) {
        synth.current.cancel();
        setTimeout(() => {
          synth.current?.speak(utterance);
        }, 100);
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

  useEffect(() => {
    if (isSpeakingState && parentCurrentIndex !== internalCurrentIndex.current) {
      stopSpeech(false);
    }
  }, [parentCurrentIndex, isSpeakingState, stopSpeech]);

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
