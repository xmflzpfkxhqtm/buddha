'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import PlayerControlsUI from './PlayerControlsUI'; // 경로 수정 필요
import type { TTSPlayerProps } from '@/types/tts';

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

const WebTTSPlayer: React.FC<TTSPlayerProps> = ({
  sentences,
  scriptureId,
  currentIndex: externalIndex,
  setCurrentIndex,
  onPlaybackStateChange,
  smoothCenter,
  className,
  bottomOffset,
}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const synth = useRef<SpeechSynthesis | null>(null);
  const currentUtterance = useRef<SpeechSynthesisUtterance | null>(null);
  const cloudAudio = useRef<HTMLAudioElement | null>(null);
  const stopRequested = useRef(false);
  const internalIndex = useRef(externalIndex);
  const playGeneration = useRef(0);
  const mounted = useRef(false);
  const isIOSWeb = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

  const suppressExternalSync = useRef(false);
  const lastSyncedIndexRef = useRef<number | null>(null);

  const getTtsSettings = useCallback(() => {
    return { rate: 0.9, pitch: 0.5 };
  }, []);

  const cancelWebUtterance = useCallback(() => {
    if (currentUtterance.current) {
      currentUtterance.current.onend = null;
      currentUtterance.current.onerror = null;
      currentUtterance.current = null;
    }
    synth.current?.cancel();
    if (cloudAudio.current) {
      cloudAudio.current.onended = null;
      cloudAudio.current.onerror = null;
      cloudAudio.current.pause();
      cloudAudio.current = null;
    }
  }, []);

  // 사전 생성된 클라우드 TTS 오디오(있으면) 재생. 실패 시 false를 반환해 브라우저 내장 TTS로 폴백한다.
  const tryCloudAudio = useCallback(async (text: string, idx: number): Promise<boolean> => {
    if (!scriptureId) return false;
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scripture_id: scriptureId, line_index: idx, text }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (!data?.url) return false;

      return await new Promise<boolean>((resolve) => {
        const audio = new Audio(data.url);
        cloudAudio.current = audio;
        audio.onended = () => resolve(true);
        audio.onerror = () => resolve(false);
        audio.play().catch(() => resolve(false));
      });
    } catch {
      return false;
    }
  }, [scriptureId]);

  const stopSpeech = useCallback((syncParent = true) => {
    if (!mounted.current) return;
    stopRequested.current = true;
    playGeneration.current += 1;
    cancelWebUtterance();
    setIsSpeaking(false);
    if (syncParent) setCurrentIndex(internalIndex.current);
  }, [setCurrentIndex, cancelWebUtterance]);

  const speakText = useCallback(async (
    text: string,
    idx: number,
    gen: number,
    onDone: () => void
  ) => {
    if (!mounted.current || stopRequested.current || gen !== playGeneration.current || !text.trim()) return;

    internalIndex.current = idx;
    suppressExternalSync.current = true;
    lastSyncedIndexRef.current = idx;
    setCurrentIndex(idx);
    setTimeout(() => suppressExternalSync.current = false, 150);

    smoothCenter(idx);
    setIsSpeaking(true);

    const playedByCloud = await tryCloudAudio(text, idx);
    if (!mounted.current || stopRequested.current || gen !== playGeneration.current) return;
    if (playedByCloud) {
      setTimeout(onDone, 50);
      return;
    }

    if (!synth.current) {
      console.error("[TTS] Web Speech Synthesis not initialized.");
      stopSpeech(true);
      return;
    }

    try {
      const utter = new SpeechSynthesisUtterance(text);
      currentUtterance.current = utter;
      const settings = getTtsSettings();
      utter.lang = 'ko-KR';
      utter.rate = settings.rate;
      utter.pitch = settings.pitch;
      utter.volume = 1.0;

      utter.onend = () => {
        if (currentUtterance.current !== utter) return;
        currentUtterance.current = null;
        if (!stopRequested.current && gen === playGeneration.current && mounted.current) {
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
      };

      console.log('[TTS] Attempting synth.speak for web...');
      synth.current.speak(utter);
    } catch (e) {
      console.error('[TTS] speakText error (web)', e);
      stopSpeech(true);
    }
  }, [setCurrentIndex, smoothCenter, stopSpeech, getTtsSettings, tryCloudAudio]);

  const playFrom = useCallback((startIdx: number, gen: number) => {
    if (!mounted.current || stopRequested.current || gen !== playGeneration.current) return;
    if (startIdx >= sentences.length) { stopSpeech(true); return; }

    const txt = sentences[startIdx];
    if (!txt?.trim()) { playFrom(startIdx + 1, gen); return; }

    speakText(txt, startIdx, gen, () => {
      if (mounted.current && !stopRequested.current && gen === playGeneration.current) {
        playFrom(startIdx + 1, gen);
      }
    });
  }, [sentences, speakText, stopSpeech]);

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

    synth.current.cancel();

    if (isIOSWeb) await waitUntilVoicesReady();

    playFrom(internalIndex.current, gen);
  }, [isSpeaking, isIOSWeb, playFrom, stopSpeech]);

  const skip = useCallback((dir: 1 | -1) => {
    const next = internalIndex.current + dir;
    if (next < 0 || next >= sentences.length) return;

    const wasPlaying = isSpeaking;
    playGeneration.current += 1;
    const gen = playGeneration.current;

    cancelWebUtterance();
    internalIndex.current = next;

    suppressExternalSync.current = true;
    lastSyncedIndexRef.current = next;
    setCurrentIndex(next);
    setTimeout(() => suppressExternalSync.current = false, 150);

    smoothCenter(next);
    stopRequested.current = false;

    if (wasPlaying) {
      playFrom(next, gen);
    } else {
      setIsSpeaking(false);
    }
  }, [sentences.length, isSpeaking, setCurrentIndex, smoothCenter, playFrom, cancelWebUtterance]);

  useEffect(() => {
    mounted.current = true;
    console.log('[TTS Web] Component mounted.');

    if ('speechSynthesis' in window) {
      console.log('[TTS Web] Initializing Web Speech Synthesis...');
      synth.current = window.speechSynthesis;
      if (isIOSWeb) {
        waitUntilVoicesReady().then(() => {
          if (mounted.current && synth.current) {
            try {
              const warm = new SpeechSynthesisUtterance(' '); warm.volume = 0;
              synth.current.speak(warm);
              console.log('[TTS Web] iOS Web warmup speech initiated.');
            } catch (e) {
              console.warn('[TTS Web] iOS Web warmup speech failed:', e);
            }
          }
        });
      }
    } else {
      console.error('[TTS Web] Speech Synthesis API is not supported.');
    }

    return () => {
      mounted.current = false;
      console.log('[TTS Web] Component unmounting...');
      stopSpeech(false);
      if (synth.current) {
        console.log('[TTS Web] Web Speech Synthesis reference cleared.');
        synth.current = null;
      }
    };
  }, [isIOSWeb, stopSpeech]);

  useEffect(() => {
    if (!mounted.current) return;
    if (suppressExternalSync.current) return;
    if (externalIndex === lastSyncedIndexRef.current) return;

    console.log(`[TTS Web] External index changed to ${externalIndex}.`);
    if (isSpeaking) {
      playGeneration.current += 1;
      stopSpeech(false);
    }
    internalIndex.current = externalIndex;
    lastSyncedIndexRef.current = externalIndex;
  }, [externalIndex, isSpeaking, stopSpeech]);

  useEffect(() => {
    if (mounted.current) {
      onPlaybackStateChange?.(isSpeaking);
    }
  }, [isSpeaking, onPlaybackStateChange]);

  return (
    <PlayerControlsUI
      isPlaying={isSpeaking}
      onPlayPause={handlePlayPause}
      onSkipBackward={() => skip(-1)}
      onSkipForward={() => skip(1)}
      isBackwardDisabled={internalIndex.current <= 0 || sentences.length === 0}
      isForwardDisabled={internalIndex.current >= sentences.length - 1 || sentences.length === 0}
      isPlayPauseDisabled={sentences.length === 0}
      className={className}
      bottomOffset={bottomOffset}
    />
  );
};

export default WebTTSPlayer;
