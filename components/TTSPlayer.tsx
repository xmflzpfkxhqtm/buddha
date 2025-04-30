// components/TTSPlayer.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';
import { KeepAwake } from '@capacitor-community/keep-awake';

interface TTSPlayerProps {
  sentences: string[];
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  onPlaybackStateChange?: (isPlaying: boolean) => void;
  smoothCenter: (index: number) => void;
}

const TTSPlayer: React.FC<TTSPlayerProps> = ({
  sentences,
  currentIndex,
  setCurrentIndex,
  onPlaybackStateChange,
  smoothCenter,
}) => {
  const [isSpeakingState, setIsSpeakingState] = useState(false); // 내부 재생 상태
  const synth = useRef<SpeechSynthesis | null>(null);
  const currentUtterance = useRef<SpeechSynthesisUtterance | null>(null);
  const requestedIndex = useRef<number>(currentIndex); // 재생 요청된 인덱스
  const stopRequested = useRef<boolean>(false); // 사용자가 중지 눌렀는지

  // --- 초기화 ---
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synth.current = window.speechSynthesis;
      // 페이지 로드/새로고침 시 남아있을 수 있는 발화 정리
      synth.current?.cancel();
      // 목소리 로드 감지 (선택적)
      const logVoices = () => console.log('Voices changed/loaded.');
      if (synth.current?.onvoiceschanged !== undefined) {
        synth.current.onvoiceschanged = logVoices;
      }
    } else {
      console.warn('Web Speech API (SpeechSynthesis) is not supported.');
    }
    // 언마운트 시 정리
    return () => {
      if (synth.current) {
        synth.current.cancel();
        synth.current.onvoiceschanged = null;
      }
      KeepAwake.allowSleep().catch(); // 화면 꺼짐 허용
    };
  }, []);

  // --- 외부 인덱스 변경 감지 (단순화) ---
  // 외부에서 currentIndex가 바뀌면 일단 요청 인덱스 업데이트
  useEffect(() => {
    console.log(`[TTSPlayer] currentIndex prop changed to: ${currentIndex}`);
    // 재생 중이고 외부에서 인덱스가 바뀌었다면 멈춤 (스크롤 동기화 등)
    // 주의: 부모에서 isTTSSpeaking을 관리하고 스크롤 동기화를 막는다면 이 로직 불필요
    if (isSpeakingState && currentIndex !== requestedIndex.current) {
        console.log('[TTSPlayer] External index change detected while speaking, stopping.');
        stopSpeech(); // 재생 중지
    }
    requestedIndex.current = currentIndex; // 요청 인덱스 업데이트
  }, [currentIndex, isSpeakingState]); // isSpeakingState 추가

  // --- 재생 상태 변경 시 콜백 호출 ---
  useEffect(() => {
    onPlaybackStateChange?.(isSpeakingState);
  }, [isSpeakingState, onPlaybackStateChange]);


  // --- 중지 함수 ---
  const stopSpeech = useCallback(() => {
    stopRequested.current = true; // 중지 플래그 설정
    console.log('[TTSPlayer] stopSpeech called.');
    // 이벤트 리스너 먼저 제거 (중요!)
    if (currentUtterance.current) {
      currentUtterance.current.onstart = null;
      currentUtterance.current.onend = null;
      currentUtterance.current.onerror = null;
      currentUtterance.current = null;
    }
    if (synth.current) {
      synth.current.cancel(); // 발화 취소
    }
    if (isSpeakingState) { // 상태가 true일 때만 false로 변경
       setIsSpeakingState(false);
    }
    KeepAwake.allowSleep().catch();
  }, [isSpeakingState]);


  // --- 재생 함수 ---
  const playSpeech = useCallback((index: number) => {
    if (!synth.current || index >= sentences.length || stopRequested.current) {
      console.warn(`[TTSPlayer] playSpeech condition not met: index=${index}, stopRequested=${stopRequested.current}`);
      stopSpeech(); // 조건 안 맞으면 확실히 중지
      return;
    }

    console.log(`[TTSPlayer] playSpeech called for index: ${index}`);
    // 이전 발화 확실히 취소 후 잠시 대기 (이벤트 루프 틱)
    synth.current.cancel();

    setTimeout(() => {
        // setTimeout 콜백 시점에 다시 조건 확인
        if (stopRequested.current) {
            console.log('[TTSPlayer] Play cancelled during timeout.');
            stopSpeech();
            return;
        }

        requestedIndex.current = index; // 현재 재생하려는 인덱스 기록
        setCurrentIndex(index); // 부모 UI 업데이트
        smoothCenter(index);    // 스크롤

        const textToSpeak = sentences[index];
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        currentUtterance.current = utterance; // 현재 발화 객체 참조

        utterance.lang = 'ko-KR';
        // ... (목소리 선택 로직 - 이전과 동일) ...
        const voices = synth.current?.getVoices();
        let selectedVoice: SpeechSynthesisVoice | null = null;
        if (voices && voices.length > 0) {
            const koreanVoices = voices.filter(voice => voice.lang === 'ko-KR');
            selectedVoice = koreanVoices.find(voice => voice.name.includes('Yuna')) ?? null;
            if (!selectedVoice) selectedVoice = koreanVoices.find(voice => voice.name.includes('Google 한국')) ?? null;
            if (!selectedVoice) selectedVoice = koreanVoices.find(voice => voice.default === true) ?? null;
            if (!selectedVoice && koreanVoices.length > 0) selectedVoice = koreanVoices[0];
        }
        // if (selectedVoice) utterance.voice = selectedVoice;
        utterance.rate = 0.9;
        utterance.pitch = 0.5;

        utterance.onstart = () => {
            console.log(`[TTSPlayer] onstart: index ${index}`);
             // 시작 시점에 stopRequested 확인
             if(stopRequested.current) {
                 stopSpeech();
                 return;
             }
             if (!isSpeakingState) { // 혹시 상태가 false면 true로 (동기화)
                 setIsSpeakingState(true);
             }
        };

        utterance.onend = () => {
          console.log(`[TTSPlayer] onend: index ${index}`);
          // 현재 참조가 맞는지, 중지 요청이 없었는지 확인
          if (currentUtterance.current === utterance && !stopRequested.current) {
            currentUtterance.current = null; // 참조 해제
            const nextIndex = index + 1;
            if (nextIndex < sentences.length) {
              console.log(`[TTSPlayer] Requesting next index: ${nextIndex}`);
              playSpeech(nextIndex); // 다음 문장 재생 요청
            } else {
              console.log('[TTSPlayer] Finished all sentences.');
              stopSpeech(); // 완료 후 중지
            }
          } else {
              console.log('[TTSPlayer] onend ignored: utterance mismatch or stop requested.');
          }
        };

        utterance.onerror = (event) => {
          console.error(`[TTSPlayer] onerror: index ${index}`, event.error);
          if (currentUtterance.current === utterance) { // 현재 발화에 대한 에러인지 확인
             stopSpeech(); // 에러 시 중지
          }
        };

        // speak 호출
        console.log(`[TTSPlayer] Calling synth.speak for index ${index}`);
        synth.current?.speak(utterance);

    }, 0); // cancel 후 이벤트 루프가 처리할 시간을 줌 (0ms)

  }, [sentences, setCurrentIndex, smoothCenter, stopSpeech, isSpeakingState]); // isSpeakingState 추가


  // --- 버튼 핸들러 ---
  const handlePlayPause = useCallback(() => {
    if (!synth.current) return;

    if (isSpeakingState) {
      stopSpeech();
    } else {
      stopRequested.current = false; // 재생 시작 시 중지 요청 리셋
      setIsSpeakingState(true);     // 즉시 재생 상태로 (UI 반응성)
      KeepAwake.keepAwake().catch();
      console.log(`[TTSPlayer] User clicked play, starting from index: ${requestedIndex.current}`);
      playSpeech(requestedIndex.current); // 현재 요청된 인덱스부터 재생 시작
    }
  }, [isSpeakingState, playSpeech, stopSpeech]);


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
