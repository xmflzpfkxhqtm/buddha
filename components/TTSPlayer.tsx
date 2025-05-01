// components/TTSPlayer.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';
import { KeepAwake } from '@capacitor-community/keep-awake';

interface TTSPlayerProps {
  sentences: string[];
  currentIndex: number; // 부모가 관리하는 현재 인덱스 (스크롤 동기화용)
  setCurrentIndex: (index: number) => void; // 부모 인덱스 업데이트 함수
  onPlaybackStateChange?: (isPlaying: boolean) => void;
  smoothCenter: (index: number) => void;
}

const TTSPlayer: React.FC<TTSPlayerProps> = ({
  sentences,
  currentIndex: parentCurrentIndex, // prop 이름 변경하여 내부 상태와 구분
  setCurrentIndex: setParentCurrentIndex, // prop 이름 변경
  onPlaybackStateChange,
  smoothCenter,
}) => {
  const [isSpeakingState, setIsSpeakingState] = useState(false);
  const synth = useRef<SpeechSynthesis | null>(null);
  const currentUtterance = useRef<SpeechSynthesisUtterance | null>(null);
  const stopRequested = useRef<boolean>(false);
  const hasInteracted = useRef<boolean>(false);
  // --- 👇 TTSPlayer 내부에서 실제로 재생중인 인덱스를 관리 ---
  const internalCurrentIndex = useRef<number>(parentCurrentIndex);

  // --- 초기화 ---
  useEffect(() => {
    let synthRef: SpeechSynthesis | null = null;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef = window.speechSynthesis;
      synth.current = synthRef;
      synthRef.cancel();
      synthRef.getVoices();
      console.log('[TTSPlayer] Synth initialized.');
    } else {
      console.warn('Web Speech API (SpeechSynthesis) is not supported.');
    }
    return () => {
      if (synthRef) {
        console.log('[TTSPlayer] Unmounting, canceling speech.');
        synthRef.cancel();
      }
      KeepAwake.allowSleep().catch();
    };
  }, []);

  // --- 재생 상태 변경 시 콜백 ---
  useEffect(() => {
    onPlaybackStateChange?.(isSpeakingState);
  }, [isSpeakingState, onPlaybackStateChange]);

  // --- 중지 함수 ---
  const stopSpeech = useCallback((updateParentIndex = true) => { // 부모 인덱스 업데이트 여부 제어
    stopRequested.current = true;
    console.log('[TTSPlayer] stopSpeech called.');
    if (currentUtterance.current) {
      currentUtterance.current.onstart = null;
      currentUtterance.current.onend = null;
      currentUtterance.current.onerror = null;
      currentUtterance.current = null;
    }
    if (synth.current && (synth.current.speaking || synth.current.pending)) {
      synth.current.cancel();
    }
    if (isSpeakingState) setIsSpeakingState(false);
    // 중지 시, 현재 내부 인덱스를 부모에게 반영할지 결정
    if (updateParentIndex) {
       setParentCurrentIndex(internalCurrentIndex.current); // 중지된 위치 반영
    }
    KeepAwake.allowSleep().catch();
  }, [isSpeakingState, setParentCurrentIndex]); // setParentCurrentIndex 추가


  // --- 재생 함수 ---
  const playSpeech = useCallback((index: number) => {
    if (!synth.current || index >= sentences.length || stopRequested.current) {
      if (isSpeakingState) stopSpeech(false); // 재생 중 아니면 부모 인덱스 업데이트 안 함
      return;
    }

    // 내부 인덱스 업데이트
    internalCurrentIndex.current = index;
    // 부모 인덱스 업데이트는 onstart에서

    const textToSpeak = sentences[index];
    if (!textToSpeak?.trim()) {
      const nextIndex = index + 1;
      if (nextIndex < sentences.length) playSpeech(nextIndex);
      else stopSpeech();
      return;
    }

    console.log(`[TTSPlayer] Creating utterance for index: ${index}`);
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    currentUtterance.current = utterance;
    utterance.lang = 'ko-KR';
    utterance.rate = 0.9;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      console.log(`[TTSPlayer] onstart: index ${index}`);
      if (stopRequested.current) { stopSpeech(); return; }
      if (!isSpeakingState) setIsSpeakingState(true);
      // --- 👇 실제 발화 시작 시 부모 인덱스 업데이트 및 스크롤 ---
      setParentCurrentIndex(index);
      smoothCenter(index);
    };

    utterance.onend = () => {
      console.log(`[TTSPlayer] onend: index ${index}`);
      if (currentUtterance.current === utterance && !stopRequested.current) {
        currentUtterance.current = null;
        const nextIndex = index + 1;
        if (nextIndex < sentences.length) {
          playSpeech(nextIndex);
        } else {
          stopSpeech(); // 완료 시 중지 (부모 인덱스는 마지막 인덱스로 유지됨)
        }
      }
    };

    utterance.onerror = (e) => {
      console.error(`[TTSPlayer] onerror: index ${index}`, e.error, e);
      if (currentUtterance.current === utterance) stopSpeech();
    };

    console.log(`[TTSPlayer] Calling speak for index ${index}: "${utterance.text.substring(0, 20)}..."`);
    synth.current.speak(utterance);

  }, [sentences, setParentCurrentIndex, smoothCenter, stopSpeech, isSpeakingState]); // setParentCurrentIndex, smoothCenter, isSpeakingState


  // --- 버튼 핸들러 ---
  const handlePlayPause = useCallback(() => {
    if (!synth.current) return;

    if (isSpeakingState) {
      stopSpeech();
    } else {
      stopRequested.current = false;
      KeepAwake.keepAwake().catch();
      // 재생 시작 시 부모의 현재 인덱스(스크롤 위치)를 사용
      const targetIndex = parentCurrentIndex;
      console.log(`[TTSPlayer] Play button clicked. Starting from parent index: ${targetIndex}`);

      if (!hasInteracted.current) {
        hasInteracted.current = true;
        try {
          if (synth.current.paused) synth.current.resume();
          const warmUpUtterance = new SpeechSynthesisUtterance(" ");
          warmUpUtterance.volume = 0;
          warmUpUtterance.onerror = (e) => console.warn('[TTSPlayer] Warm-up error (ignored):', e.error);
          synth.current.speak(warmUpUtterance);
        } catch (e) { console.warn('[TTSPlayer] Warm-up attempt failed:', e); }
      }

      // Warm-up 또는 즉시 재생 요청 (짧은 지연 후)
      setTimeout(() => {
        if (!stopRequested.current) {
          // setIsSpeakingState(true); // onstart에서 처리
          playSpeech(targetIndex); // 부모의 현재 인덱스부터 시작
        }
      }, 10);
    }
  // parentCurrentIndex는 재생 시작 시점의 값만 필요하므로 의존성 배열에 넣지 않음
  }, [isSpeakingState, playSpeech, stopSpeech]);


  // --- 👇 외부 인덱스 변경(스크롤 등) 감지 및 처리 ---
  useEffect(() => {
    // 재생 중이 아닐 때는 requestedIndex 업데이트 불필요 (항상 parentCurrentIndex 사용)
    // 재생 중일 때 부모의 인덱스(스크롤 위치)와 내부 재생 인덱스가 다르면 중지
    if (isSpeakingState && parentCurrentIndex !== internalCurrentIndex.current) {
      console.log(`[TTSPlayer] External index change (scroll?). Stopping. Parent: ${parentCurrentIndex}, Internal: ${internalCurrentIndex.current}`);
      // 중지하되, 부모 인덱스는 스크롤 위치이므로 업데이트 안 함 (false 전달)
      stopSpeech(false);
    }
  // parentCurrentIndex가 변경될 때마다 실행
  }, [parentCurrentIndex, isSpeakingState, stopSpeech]);


  return (
    <button
      onClick={handlePlayPause}
      className="fixed bottom-[84px] left-1/2 -translate-x-1/2 bg-red-light text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg z-50"
      aria-label={isSpeakingState ? '일시정지' : '재생'}
      disabled={!synth.current}
    >
      {isSpeakingState ? <Pause size={32} /> : <Play size={32} />}
    </button>
  );
};

export default TTSPlayer;
