// components/TTSPlayer.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';
import { KeepAwake } from '@capacitor-community/keep-awake';

interface TTSPlayerProps {
  sentences: string[]; // 전체 문장 목록
  currentIndex: number; // 부모 컴포넌트가 관리하는 현재 문장 인덱스
  setCurrentIndex: (index: number) => void; // 현재 인덱스 업데이트 함수
  onPlaybackStateChange?: (isPlaying: boolean) => void; // 재생 상태 변경 시 부모에게 알림 (선택 사항)
  smoothCenter: (index: number) => void; // 스크롤 함수
}

const TTSPlayer: React.FC<TTSPlayerProps> = ({
  sentences,
  currentIndex,
  setCurrentIndex,
  onPlaybackStateChange,
  smoothCenter,
}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const synth = useRef<SpeechSynthesis | null>(null);
  const stopRequested = useRef(false); // 중지 요청 플래그

  // SpeechSynthesis 초기화
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synth.current = window.speechSynthesis;
      // 컴포넌트 언마운트 시 정리
      return () => {
        if (synth.current?.speaking) {
          synth.current.cancel();
        }
      };
    } else {
      console.warn('Web Speech API (SpeechSynthesis) is not supported.');
    }
  }, []);

  // isSpeaking 상태 변경 시 부모에게 알림
  useEffect(() => {
    onPlaybackStateChange?.(isSpeaking);
  }, [isSpeaking, onPlaybackStateChange]);

   // 외부에서 currentIndex가 변경되었을 때 (예: 스크롤 동기화), 재생 중이면 멈춤
   const prevIndexRef = useRef(currentIndex);
   useEffect(() => {
       if (synth.current?.speaking && currentIndex !== prevIndexRef.current) {
           console.log('[TTSPlayer] Index changed externally, stopping playback.');
           stopTTS();
       }
       prevIndexRef.current = currentIndex;
   }, [currentIndex]); // stopTTS를 의존성에 넣으면 무한루프 가능성, 내부에서 직접 호출

  // TTS 중지 함수
  const stopTTS = useCallback(() => {
    stopRequested.current = true; // 중지 요청 플래그 설정
    if (synth.current?.speaking) {
      console.log('[TTSPlayer] Stopping speech synthesis via cancel().');
      synth.current.cancel(); // 즉시 중지
    }
    setIsSpeaking(false);
    utteranceRef.current = null;
    KeepAwake.allowSleep().catch(e => console.warn('[TTSPlayer] KeepAwake.allowSleep error:', e));
  }, []); // 의존성 없음

  // 재생/일시정지 핸들러
  const handlePlayPause = useCallback(() => {
    if (!synth.current) {
      console.error('SpeechSynthesis not available.');
      // 사용자에게 알림 (부모 컴포넌트에서 처리하는 것이 좋을 수 있음)
      return;
    }

    if (isSpeaking) {
      stopTTS();
    } else {
      if (currentIndex >= sentences.length) {
        console.log('[TTSPlayer] Already at the end of sentences.');
        return;
      }

      stopRequested.current = false; // 재생 시작 시 중지 요청 플래그 초기화
      setIsSpeaking(true);
      KeepAwake.keepAwake().catch(e => console.warn('[TTSPlayer] KeepAwake.keepAwake error:', e));

      const playSentence = (index: number) => {
        // 중지 요청 플래그 확인 또는 문장 끝 도달 시 종료
        if (stopRequested.current || index >= sentences.length) {
          if (isSpeaking) { // 재생 중이었다면 최종 상태 정리
             setIsSpeaking(false); // 여기서 isSpeaking을 false로 설정
             KeepAwake.allowSleep().catch(e => console.warn('[TTSPlayer] KeepAwake.allowSleep error:', e));
          }
          return;
        }

        const textToSpeak = sentences[index];
        console.log(`[TTSPlayer] Speaking index ${index}`);
        setCurrentIndex(index); // 부모의 인덱스 업데이트
        smoothCenter(index);    // 스크롤

        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = 'ko-KR';

        const voices = synth.current?.getVoices();
        if (voices) {
          const koreanVoice = voices.find(voice => voice.lang === 'ko-KR');
          if (koreanVoice) utterance.voice = koreanVoice;
        }

        utterance.onend = () => {
          console.log(`[TTSPlayer] Finished index ${index}`);
          utteranceRef.current = null;
          // 중지 요청이 없었으면 다음 문장 재생
          if (!stopRequested.current) {
            playSentence(index + 1);
          } else {
              setIsSpeaking(false); // onend에서 stop 상태 반영
              KeepAwake.allowSleep().catch(e => console.warn('[TTSPlayer] KeepAwake.allowSleep error:', e));
          }
        };

        utterance.onerror = (event) => {
          console.error(`[TTSPlayer] Error at index ${index}:`, event.error);
          utteranceRef.current = null;
          stopTTS(); // 오류 시 중지
          // 오류 메시지 알림 (부모에게 전달)
        };

        utteranceRef.current = utterance;

        // speak 호출 전에 이전 발화가 완전히 취소되도록 잠시 대기 (선택적 안정화)
        setTimeout(() => {
           if (!stopRequested.current && synth.current) { // 그 사이에 중지되지 않았는지 확인
              synth.current.speak(utterance);
           } else if (!stopRequested.current) {
               console.warn("[TTSPlayer] Synth not ready for speak call.");
               stopTTS(); // synth 없으면 중지
           }
        }, 50); // 짧은 지연
      };

       // 목소리 로딩 지연 고려 및 재생 시작
       setTimeout(() => {
          if (!stopRequested.current) { // 그 사이에 중지되지 않았는지 확인
             playSentence(currentIndex);
          }
       }, 100);
    }
  }, [isSpeaking, currentIndex, sentences, setCurrentIndex, smoothCenter, stopTTS]); // stopTTS 추가

  return (
    <button
      onClick={handlePlayPause}
      className="fixed bottom-[84px] left-1/2 -translate-x-1/2 bg-red-light text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg z-50"
      aria-label={isSpeaking ? '일시정지' : '재생'}
      disabled={!synth.current} // TTS 사용 불가 시 비활성화
    >
      {isSpeaking ? <Pause size={32} /> : <Play size={32} />}
    </button>
  );
};

export default TTSPlayer;
