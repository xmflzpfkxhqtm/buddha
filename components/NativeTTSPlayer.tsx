// NativeTTSPlayer.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { KeepAwake } from '@capacitor-community/keep-awake';
// import { MusicControls, PluginListenerHandle } from './path/to/musicControls'; // 필요 시 MusicControls 관련 import
import PlayerControlsUI from './PlayerControlsUI'; // 경로 수정 필요

/* -------------------------------------------------------------------------- */
/* Props (WebTTSPlayer와 동일하게 유지) ------------------------------------ */
interface NativeTTSPlayerProps {
  sentences: string[];
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  smoothCenter: (index: number, instant?: boolean) => void;
  onPlaybackStateChange: (isSpeaking: boolean) => void;
}

/* -------------------------------------------------------------------------- */
/* Component ---------------------------------------------------------------- */
export default function NativeTTSPlayer({
  sentences,
  currentIndex,
  setCurrentIndex,
  smoothCenter,
  onPlaybackStateChange,
}: NativeTTSPlayerProps) {
  /* ------------------------------ state / refs --------------------------- */
  const [isSpeaking, setIsSpeaking] = useState(false);
  const stopRequested = useRef(false);
  const internalIndex = useRef(currentIndex);
  const playGeneration = useRef(0);
  const mounted = useRef(false);
  const platform = Capacitor.getPlatform(); // android 또는 ios

  // --- MusicControls 관련 refs (필요 시) ---
  // const musicReady = useRef(false);
  // const listenerHandle = useRef<PluginListenerHandle | null>(null);
  // --- ---

  /* ----------------------------- helper funcs ---------------------------- */
  const getTtsSettings = useCallback((): { rate: number; pitch: number } => {
    // 네이티브 플랫폼별 설정
    return platform === 'android'
      ? { rate: 1.0, pitch: 0.5 }
      : { rate: 0.9, pitch: 0.4 }; // iOS 설정 (예시)
  }, [platform]);

  // --- MusicControls 관련 함수들 (필요 시) ---
  // const createMusicControls = useCallback(...)
  // const setMusicControlsPlaying = useCallback(...)
  // const destroyMusicControls = useCallback(...)
  // --- ---

  const stopSpeech = useCallback(async (syncParent = true) => {
    if (!mounted.current) return;
    stopRequested.current = true;
    playGeneration.current += 1;

    try { await TextToSpeech.stop(); } catch {} // 네이티브 TTS 중지
    // await setMusicControlsPlaying(false); // 필요 시
    KeepAwake.allowSleep().catch(() => {}); // 네이티브 화면 유지 해제

    setIsSpeaking(false);
    if (syncParent) setCurrentIndex(internalIndex.current);
  }, [setCurrentIndex /*, setMusicControlsPlaying */]); // mounted, internalIndex, playGeneration, stopRequested ref 불필요

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

    try {
      const { rate, pitch } = getTtsSettings(); // 네이티브 설정
      await TextToSpeech.speak({
        text,
        lang: 'ko-KR',
        rate,
        pitch,
        volume: 1.0,
        category: 'ambient' // iOS 오디오 세션
      });

      // 네이티브 speak는 완료 후 resolve됨
      if (!stopRequested.current && gen === playGeneration.current && mounted.current) {
        onDone(); // 다음 작업 수행
      }
    } catch (e) {
      console.error('[TTS Native] speak error', e);
      stopSpeech(true);
    }
  }, [setCurrentIndex, smoothCenter, stopSpeech, getTtsSettings]); // mounted, stopRequested, playGeneration, internalIndex ref 불필요

  /* --------------------------- playFrom (재귀) --------------------------- */
  /* --------------------------- playFrom (재귀) --------------------------- */
  const playFrom = useCallback((startIdx: number, gen: number) => {
    if (!mounted.current || stopRequested.current || gen !== playGeneration.current) return;
    if (startIdx >= sentences.length) { stopSpeech(true); return; }

    const txt = sentences[startIdx];
    if (!txt?.trim()) { playFrom(startIdx + 1, gen); return; }

    // speakText 호출 시, onDone 콜백 내부에 setTimeout 추가
    speakText(txt, startIdx, gen, () => { // 이 함수가 onDone 콜백
        if(mounted.current && !stopRequested.current && gen === playGeneration.current) {
            // === 여기에 딜레이 추가 ===
            const delayBetweenSentences = 500; // 예시: 300ms (0.3초) 쉼
            console.log(`[TTS Native] Sentence ${startIdx} finished, starting ${delayBetweenSentences}ms delay.`);
            setTimeout(() => {
                // 딜레이 후에도 상태 재확인 (그 사이에 stop/skip 눌렸을 수 있음)
                if(mounted.current && !stopRequested.current && gen === playGeneration.current) {
                    console.log(`[TTS Native] Delay finished, calling playFrom(${startIdx + 1})`);
                    playFrom(startIdx + 1, gen); // 딜레이 후 다음 문장 재생
                } else {
                     console.log(`[TTS Native] Aborted during delay before playing index ${startIdx + 1}.`);
                }
            }, delayBetweenSentences);
            // =======================
        } else {
            // console.log(`[TTS Native] onDone aborted for index ${startIdx}.`);
        }
    });
  }, [sentences, speakText, stopSpeech]); // mounted, stopRequested, playGeneration ref 불필요
  // 
  //   /* --------------------------- control handlers -------------------------- */
  const handlePlayPause = useCallback(async () => {
    if (isSpeaking) {
      stopSpeech(true);
      return;
    }

    stopRequested.current = false;
    KeepAwake.keepAwake().catch(() => {}); // 네이티브 화면 유지
    playGeneration.current += 1;
    const gen = playGeneration.current;

    // await createMusicControls(true, internalIndex.current); // 필요 시
    // await setMusicControlsPlaying(true); // 필요 시

    playFrom(internalIndex.current, gen);
  }, [isSpeaking, playFrom, stopSpeech /*, createMusicControls, setMusicControlsPlaying */]); // internalIndex, stopRequested, playGeneration ref 불필요

  const skip = useCallback(async (dir: 1 | -1) => {
    const next = internalIndex.current + dir;
    if (next < 0 || next >= sentences.length) return;

    const wasPlaying = isSpeaking;
    playGeneration.current += 1;
    const gen = playGeneration.current;

    await TextToSpeech.stop().catch(() => {}); // 네이티브 TTS 중지
    // iOS 딜레이 (필요 시 유지)
    if (platform === 'ios') {
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    // await createMusicControls(wasPlaying, next); // 필요 시

    internalIndex.current = next;
    setCurrentIndex(next);
    smoothCenter(next);
    stopRequested.current = false;

    if (wasPlaying) {
        playFrom(next, gen);
    } else {
        setIsSpeaking(false);
        // await setMusicControlsPlaying(false); // 필요 시
    }
  }, [platform, sentences.length, isSpeaking, setCurrentIndex, smoothCenter, playFrom /*, createMusicControls, setMusicControlsPlaying */]); // internalIndex, playGeneration, stopRequested ref 불필요

  /* ------------------------------ lifecycle ------------------------------ */
  useEffect(() => {
    mounted.current = true;
    console.log(`[TTS Native] Component mounted on ${platform}.`);

    // --- MusicControls 리스너 등록 (필요 시) ---
    // registerMusicControlsListener();
    // --- ---

    return () => {
      mounted.current = false;
      console.log('[TTS Native] Component unmounting...');
      // stopSpeech 내부에서 TextToSpeech.stop(), KeepAwake.allowSleep() 호출됨
      stopSpeech(false);
      // --- MusicControls 리스너 및 컨트롤 제거 (필요 시) ---
      // if (listenerHandle.current) listenerHandle.current.remove().catch(()=>{});
      // destroyMusicControls();
      // --- ---
    };
  // }, [platform, stopSpeech, registerMusicControlsListener, destroyMusicControls]); // 필요 시 의존성 추가
  }, [platform, stopSpeech]); // MusicControls 없으면 이것만

  /* 외부 인덱스 변경 */
  useEffect(() => {
    if (mounted.current && currentIndex !== internalIndex.current) {
       console.log(`[TTS Native] External index changed to ${currentIndex}.`);
      if (isSpeaking) {
        playGeneration.current += 1;
        stopSpeech(false);
      }
      internalIndex.current = currentIndex;
    }
  }, [currentIndex, isSpeaking, stopSpeech]);

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
}