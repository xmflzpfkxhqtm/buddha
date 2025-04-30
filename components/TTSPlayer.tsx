import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';
import { KeepAwake } from '@capacitor-community/keep-awake';

interface TTSPlayerProps {
  sentences: string[];
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  onPlaybackStateChange?: (isPlaying: boolean) => void;
  smoothCenter: (index: number) => void;
  // selectedVoiceName?: string | null; // 목소리 선택 기능은 안정화 후 추가
}

const TTSPlayer: React.FC<TTSPlayerProps> = ({
  sentences,
  currentIndex,
  setCurrentIndex,
  onPlaybackStateChange,
  smoothCenter,
  // selectedVoiceName,
}) => {
  const [isSpeakingState, setIsSpeakingState] = useState(false);
  const synth = useRef<SpeechSynthesis | null>(null);
  const currentUtterance = useRef<SpeechSynthesisUtterance | null>(null);
  const requestedIndex = useRef<number>(currentIndex);
  const stopRequested = useRef<boolean>(false);
  const isSynthReady = useRef<boolean>(false);

  // 초기화
  useEffect(() => {
    let timeoutFallback: NodeJS.Timeout | null = null; // 타입 명시
    const initializeSynth = () => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            synth.current = window.speechSynthesis;
            synth.current.cancel();
            synth.current.getVoices(); // 목소리 로드 트리거
            isSynthReady.current = false; // 초기엔 false

            // 일정 시간 후에도 ready 안되면 강제 설정 (WebView 등 대비)
            timeoutFallback = setTimeout(() => {
                if (!isSynthReady.current) {
                    console.warn('[TTSPlayer] Synth readiness forced true after timeout.');
                    isSynthReady.current = true;
                }
            }, 1000); // 1초 대기

            // voiceschanged 이벤트로 ready 상태 감지
            if (synth.current && synth.current.onvoiceschanged !== undefined) {
                synth.current.onvoiceschanged = () => {
                    console.log('[TTSPlayer] voiceschanged fired');
                    isSynthReady.current = true;
                    if (timeoutFallback) clearTimeout(timeoutFallback); // 타임아웃 클리어
                };
            } else {
                 // onvoiceschanged 지원 안할 경우 대비 (위의 setTimeout이 처리)
                 console.warn('[TTSPlayer] onvoiceschanged event not supported?');
            }

            // 초기 목소리 목록 확인 (이미 로드된 경우)
            const initialVoices = synth.current.getVoices();
            if(initialVoices.length > 0 && !isSynthReady.current) {
                 console.log('[TTSPlayer] Voices already available on init.');
                 isSynthReady.current = true;
                 if (timeoutFallback) clearTimeout(timeoutFallback);
            }

        } else {
            console.warn('Web Speech API (SpeechSynthesis) is not supported.');
        }
    };

    // 컴포넌트 마운트 시 초기화 실행
    initializeSynth();

    // 언마운트 시 정리
    return () => {
        if (timeoutFallback) clearTimeout(timeoutFallback);
        if (synth.current) {
            synth.current.cancel();
            synth.current.onvoiceschanged = null;
        }
        KeepAwake.allowSleep().catch();
    };
  }, []); // 마운트 시 한번만 실행

  // 외부 인덱스 변경 감지
  useEffect(() => {
    // console.log(`[TTSPlayer] currentIndex prop changed to: ${currentIndex}`);
    if (isSpeakingState && currentIndex !== requestedIndex.current) {
        // 외부 변경(스크롤 등) 시 재생 중지
        // console.log('[TTSPlayer] External index change detected while speaking, stopping.');
        stopSpeech();
    }
    // requestedIndex는 항상 현재 prop 값으로 업데이트
    requestedIndex.current = currentIndex;
  }, [currentIndex, isSpeakingState]); // isSpeakingState 추가

  // 재생 상태 변경 시 콜백 호출
  useEffect(() => {
    onPlaybackStateChange?.(isSpeakingState);
  }, [isSpeakingState, onPlaybackStateChange]);

  // 중지 함수
  const stopSpeech = useCallback(() => {
    stopRequested.current = true;
    // console.log('[TTSPlayer] stopSpeech called.');
    if (currentUtterance.current) {
        currentUtterance.current.onstart = null;
        currentUtterance.current.onend = null;
        currentUtterance.current.onerror = null;
        currentUtterance.current = null;
    }
    if (synth.current?.speaking || synth.current?.pending) {
        synth.current.cancel();
    }
    if (isSpeakingState) setIsSpeakingState(false);
    KeepAwake.allowSleep().catch();
  }, [isSpeakingState]);

  // 재생 함수
  const playSpeech = useCallback((index: number | undefined) => {
    // index 유효성 검사 강화
    const safeIndex = (typeof index === 'number' && !isNaN(index) && index >= 0 && index < sentences.length) ? index : 0;

    if (!synth.current || !isSynthReady.current || stopRequested.current) {
      console.warn(`[TTSPlayer] Cannot speak. Ready=${isSynthReady.current}, index=${safeIndex}, stop=${stopRequested.current}, sentenceLength=${sentences.length}`);
      if (isSpeakingState) stopSpeech(); // 재생 중이었다면 중지
      return;
    }
    // 인덱스가 범위를 벗어난 경우도 중지
    if (safeIndex >= sentences.length) {
        console.log('[TTSPlayer] Reached end of sentences in playSpeech.');
        stopSpeech();
        return;
    }


    console.log(`[TTSPlayer] Attempting to play index: ${safeIndex}`);
    // speak 호출 전에 이전 발화 정리 (cancel 호출 최소화)
    if (synth.current.speaking) {
        console.log('[TTSPlayer] Canceling previous speech before speaking new one.');
        synth.current.cancel();
    }

    // 상태 업데이트 및 UI 동기화
    requestedIndex.current = safeIndex;
    setCurrentIndex(safeIndex); // 부모 컴포넌트 상태 업데이트
    smoothCenter(safeIndex); // 스크롤 이동

    // Utterance 생성 및 설정
    const utterance = new SpeechSynthesisUtterance(sentences[safeIndex]);
    currentUtterance.current = utterance; // 현재 발화 객체 참조
    utterance.lang = 'ko-KR';
    utterance.rate = 0.8; // 속도
    utterance.pitch = 1.0; // 피치 (1.0 권장)
    // 목소리 설정은 안정화를 위해 제외

    // 이벤트 핸들러 설정
    utterance.onstart = () => {
      console.log(`[TTSPlayer] onstart: ${safeIndex}`);
      if (stopRequested.current) { stopSpeech(); return; }
      // onstart에서 isSpeakingState를 true로 설정하는 것이 더 정확할 수 있음
      if (!isSpeakingState) setIsSpeakingState(true);
    };

    utterance.onend = () => {
      console.log(`[TTSPlayer] onend: ${safeIndex}`);
      // 참조 비교 및 중지 요청 확인
      if (currentUtterance.current === utterance && !stopRequested.current) {
        currentUtterance.current = null; // 참조 해제
        const nextIndex = safeIndex + 1;
        if (nextIndex < sentences.length) {
          console.log(`[TTSPlayer] Requesting next index: ${nextIndex}`);
          playSpeech(nextIndex); // 다음 문장 재생
        } else {
          console.log('[TTSPlayer] Finished all sentences.');
          stopSpeech(); // 완료
        }
      } else {
         console.log(`[TTSPlayer] onend ignored: utterance mismatch or stop requested (current: ${currentUtterance.current === utterance}, stopped: ${stopRequested.current}).`);
      }
    };

    utterance.onerror = (e) => {
      console.error(`[TTSPlayer] onerror: ${safeIndex}`, e.error, e);
      if (currentUtterance.current === utterance) stopSpeech(); // 오류 시 중지
    };

    // speak 호출 (setTimeout 없이)
    console.log(`[TTSPlayer] Speaking: "${utterance.text.substring(0,20)}..." (index ${safeIndex})`);
    synth.current.speak(utterance);

  }, [sentences, setCurrentIndex, smoothCenter, stopSpeech, isSpeakingState]); // isSpeakingState 추가


  // 버튼 핸들러
  const handlePlayPause = useCallback(() => {
    if (!synth.current) {
        console.error('[TTSPlayer] Synth not initialized.');
        return;
    }

    if (isSpeakingState) {
      stopSpeech();
    } else {
      stopRequested.current = false;
      // 즉시 재생 상태로 바꾸지 않고, onstart에서 바꾸도록 시도
      // setIsSpeakingState(true);
      KeepAwake.keepAwake().catch();
      console.log(`[TTSPlayer] User clicked play, requested index: ${requestedIndex.current}`);

      // synth 준비 상태 확인 및 재생 시도
      if (!isSynthReady.current) {
        console.warn('[TTSPlayer] Synth not ready, attempting to force ready and play.');
        // 강제로 ready 상태로 만들고 재생 시도 (WebView 등 대비)
        isSynthReady.current = true;
        // resume() 재시도
        if(synth.current.paused) synth.current.resume();
      }

      // 요청된 인덱스로 재생 시작
      playSpeech(requestedIndex.current);
    }
  }, [isSpeakingState, playSpeech, stopSpeech]);

  return (
    <button
      onClick={handlePlayPause}
      className="fixed bottom-[84px] left-1/2 -translate-x-1/2 bg-red-light text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg z-50"
      aria-label={isSpeakingState ? '일시정지' : '재생'}
      // 버튼 활성화 조건 단순화 (synth 객체만 확인)
      disabled={!synth.current}
    >
      {isSpeakingState ? <Pause size={32} /> : <Play size={32} />}
    </button>
  );
};

export default TTSPlayer;
