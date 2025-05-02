// WebTTSPlayer.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import PlayerControlsUI from './PlayerControlsUI'; // 경로 수정 필요

/* -------------------------------------------------------------------------- */
/* Props (NativeTTSPlayer와 동일하게 유지) ------------------------------------ */
interface TTSPlayerProps {
  sentences: string[];
  scriptureName: string; // 웹에서는 현재 사용 안 함
  currentIndex: number;
  setCurrentIndex: (idx: number) => void;
  onPlaybackStateChange?: (playing: boolean) => void;
  smoothCenter: (idx: number) => void;
}

/* -------------------------------------------------------------------------- */
/* iOS-Web: voices 로드 대기 util ------------------------------------------ */
const waitUntilVoicesReady = (): Promise<void> => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return Promise.resolve();
  if (speechSynthesis.getVoices().length) return Promise.resolve();

  return new Promise((res) => {
    const int = setInterval(() => {
      if (speechSynthesis.getVoices().length) { clearInterval(int); res(); }
    }, 60);
    speechSynthesis.addEventListener('voiceschanged', () => { clearInterval(int); res(); }, { once: true });
  });
};

/* -------------------------------------------------------------------------- */
/* Component ---------------------------------------------------------------- */
const WebTTSPlayer: React.FC<TTSPlayerProps> = ({
  sentences,
  // scriptureName, // 웹에서는 사용 안 하므로 주석 처리 또는 제거 가능
  currentIndex: externalIndex,
  setCurrentIndex,
  onPlaybackStateChange,
  smoothCenter,
}) => {
  /* ------------------------------ state / refs --------------------------- */
  const [isSpeaking, setIsSpeaking] = useState(false);
  const synth = useRef<SpeechSynthesis | null>(null);
  const currentUtterance = useRef<SpeechSynthesisUtterance | null>(null);
  const stopRequested = useRef(false);
  const internalIndex = useRef(externalIndex);
  const playGeneration = useRef(0);
  const mounted = useRef(false);
  const isIOSWeb = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent); // 웹 전용 로직 내에서만 정의

  /* ----------------------------- helper funcs ---------------------------- */
  const getTtsSettings = useCallback((): { rate: number; pitch: number } => {
    // 웹 전용 설정만 반환
    return { rate: 0.9, pitch: 0.5 };
  }, []);

  const cancelWebUtterance = useCallback(() => {
    if (currentUtterance.current) {
      currentUtterance.current.onend = null;
      currentUtterance.current.onerror = null;
      currentUtterance.current = null;
    }
    synth.current?.cancel();
  }, []); // synth ref는 의존성 불필요

  const stopSpeech = useCallback((syncParent = true) => {
    if (!mounted.current) return;
    stopRequested.current = true;
    playGeneration.current += 1;
    cancelWebUtterance(); // 웹 TTS 중지
    setIsSpeaking(false);
    // KeepAwake 없음
    if (syncParent) setCurrentIndex(internalIndex.current);
  }, [setCurrentIndex, cancelWebUtterance]); // mounted, internalIndex ref 불필요

  /* ----------------------------- speakText ------------------------------ */
  const speakText = useCallback(async (
    text: string,
    idx: number,
    gen: number,
    onDone: () => void
  ) => {
    if (!mounted.current || stopRequested.current || gen !== playGeneration.current || !text.trim()) return;

    internalIndex.current = idx;
    setCurrentIndex(idx);
    smoothCenter(idx);
    setIsSpeaking(true);

    if (!synth.current) { // synth 초기화 확인
        console.error("[TTS] Web Speech Synthesis not initialized.");
        stopSpeech(true);
        return;
    }

    try {
      const utter = new SpeechSynthesisUtterance(text);
      currentUtterance.current = utter;
      const settings = getTtsSettings(); // 웹 설정 가져오기
      utter.lang = 'ko-KR';
      utter.rate = settings.rate;
      utter.pitch = settings.pitch;
      utter.volume = 1.0;

      utter.onend = () => {
        if (currentUtterance.current !== utter) return; // 이전 발화의 콜백 무시
        currentUtterance.current = null;
        if (!stopRequested.current && gen === playGeneration.current && mounted.current) {
            // 웹에서는 완료 후 약간의 딜레이가 자연스러움
            setTimeout(onDone, 50);
        }
      };
      utter.onerror = (event) => {
        if (currentUtterance.current !== utter) return;
        console.error('[TTS] Web Speech error:', event.error);
        currentUtterance.current = null;
        stopSpeech(true);
      };
      utter.onstart = () => {
        console.log(`[TTS] Web speech started. Index: ${idx}, Gen: ${gen}`);
      }

      console.log('[TTS] Attempting synth.speak for web...');
      synth.current.speak(utter);

    } catch (e) {
      console.error('[TTS] speakText error (web)', e);
      stopSpeech(true);
    }
  }, [setCurrentIndex, smoothCenter, stopSpeech, getTtsSettings]); // mounted, stopRequested, playGeneration, internalIndex ref 불필요

  /* --------------------------- playFrom (재귀) --------------------------- */
  const playFrom = useCallback((startIdx: number, gen: number) => {
    if (!mounted.current || stopRequested.current || gen !== playGeneration.current) return;
    if (startIdx >= sentences.length) { stopSpeech(true); return; }

    const txt = sentences[startIdx];
    if (!txt?.trim()) { playFrom(startIdx + 1, gen); return; } // 빈 문장 건너뛰기

    speakText(txt, startIdx, gen, () => {
        // onDone 콜백 시점에서도 generation 체크
        if(mounted.current && !stopRequested.current && gen === playGeneration.current) {
            playFrom(startIdx + 1, gen);
        }
    });
  }, [sentences, speakText, stopSpeech]); // mounted, stopRequested, playGeneration ref 불필요

  /* --------------------------- control handlers -------------------------- */
  const handlePlayPause = useCallback(async () => {
    if (isSpeaking) {
      stopSpeech(true);
      return;
    }

    if (!synth.current) {
        console.error("[TTS] Cannot play: Web Speech Synthesis not initialized.");
        return;
    }

    stopRequested.current = false;
    playGeneration.current += 1;
    const gen = playGeneration.current;

    // 웹 재생 전 이전 큐 클리어
    synth.current.cancel();

    if (isIOSWeb) await waitUntilVoicesReady();

    playFrom(internalIndex.current, gen);
  }, [isSpeaking, isIOSWeb, playFrom, stopSpeech]); // synth, internalIndex, stopRequested, playGeneration ref 불필요

  const skip = useCallback((dir: 1 | -1) => {
    const next = internalIndex.current + dir;
    if (next < 0 || next >= sentences.length) return;

    const wasPlaying = isSpeaking;
    playGeneration.current += 1;
    const gen = playGeneration.current;

    cancelWebUtterance(); // 웹 TTS 중지

    internalIndex.current = next;
    setCurrentIndex(next);
    smoothCenter(next);
    stopRequested.current = false;

    if (wasPlaying) {
        playFrom(next, gen);
    } else {
        // 멈춤 상태에서 스킵 시 isSpeaking 상태는 false 유지
        setIsSpeaking(false);
    }
  }, [sentences.length, isSpeaking, setCurrentIndex, smoothCenter, playFrom, cancelWebUtterance]); // internalIndex, playGeneration, stopRequested ref 불필요

  /* ------------------------------ lifecycle ------------------------------ */
  useEffect(() => {
    mounted.current = true;
    console.log('[TTS Web] Component mounted.');

    if ('speechSynthesis' in window) {
      console.log('[TTS Web] Initializing Web Speech Synthesis...');
      synth.current = window.speechSynthesis;
      if (isIOSWeb) {
        console.log('[TTS Web] Applying iOS Web warmup...');
        waitUntilVoicesReady().then(() => {
          if (mounted.current && synth.current) {
            try {
              const warm = new SpeechSynthesisUtterance(' '); warm.volume = 0;
              synth.current.speak(warm); console.log('[TTS Web] iOS Web warmup speech initiated.');
            } catch (e) { console.warn('[TTS Web] iOS Web warmup speech failed:', e); }
          }
        });
      }
    } else {
      console.error('[TTS Web] Speech Synthesis API is not supported.');
    }

    return () => {
      mounted.current = false;
      console.log('[TTS Web] Component unmounting...');
      // stopSpeech 내부에서 cancelWebUtterance 호출됨
      stopSpeech(false);
      if (synth.current) {
          // synth.current.cancel(); // stopSpeech에서 이미 호출됨
          console.log('[TTS Web] Web Speech Synthesis reference cleared.');
          synth.current = null;
      }
    };
  }, [isIOSWeb, stopSpeech]); // 초기화 로직은 isIOSWeb에만 의존

  /* 외부 인덱스 변경 */
  useEffect(() => {
    if (mounted.current && externalIndex !== internalIndex.current) {
      console.log(`[TTS Web] External index changed to ${externalIndex}.`);
      if (isSpeaking) {
        playGeneration.current += 1; // 새 generation으로 기존 콜백 무효화
        stopSpeech(false);
      }
      internalIndex.current = externalIndex;
    }
  }, [externalIndex, isSpeaking, stopSpeech]);

  /* 재생 상태 변경 시 외부 콜백 호출 */
  useEffect(() => {
    if (mounted.current) {
      onPlaybackStateChange?.(isSpeaking);
    }
  }, [isSpeaking, onPlaybackStateChange]);

  /* -------------------------------- UI ----------------------------------- */
  return (
    <PlayerControlsUI
      isPlaying={isSpeaking}
      onPlayPause={handlePlayPause}
      onSkipBackward={() => skip(-1)}
      onSkipForward={() => skip(1)}
      isBackwardDisabled={internalIndex.current <= 0 || sentences.length === 0}
      isForwardDisabled={internalIndex.current >= sentences.length - 1 || sentences.length === 0}
      isPlayPauseDisabled={sentences.length === 0}
    />
  );
};

export default WebTTSPlayer;