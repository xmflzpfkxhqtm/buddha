'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';
import { KeepAwake } from '@capacitor-community/keep-awake';
// 👇 SpeakOptions import 제거
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
  const isMounted = useRef<boolean>(false);

  useEffect(() => {
    isMounted.current = true;
    console.log('[TTSPlayer] Component mounted');

    if (!isNative.current && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synth.current = window.speechSynthesis;
      synth.current.getVoices();
      if (synth.current.speaking || synth.current.pending) {
        console.log('[TTSPlayer] Initializing: Cancelling existing web speech');
        synth.current.cancel();
      }
      console.log('[TTSPlayer] Web SpeechSynthesis initialized');
    } else if (isNative.current) {
      TextToSpeech.stop().catch(e => console.warn('[TTSPlayer] Initial native stop failed (may be normal):', e));
      console.log('[TTSPlayer] Native TTS platform detected');
    }

    return () => {
      isMounted.current = false;
      console.log('[TTSPlayer] Component unmounting, stopping speech.');
      stopSpeech(false);
      if (isNative.current) {
        TextToSpeech.stop().catch(e => console.error("Error stopping native TTS on unmount:", e));
      } else if (synth.current) {
        synth.current.cancel();
      }
      KeepAwake.allowSleep().catch();
      console.log('[TTSPlayer] Cleanup complete.');
    };
  }, []);

  useEffect(() => {
    if (isMounted.current) {
      onPlaybackStateChange?.(isSpeakingState);
    }
  }, [isSpeakingState, onPlaybackStateChange]);

  const stopSpeech = useCallback(async (updateParentIndex = true) => {
    console.log(`[TTSPlayer] stopSpeech called. updateParentIndex: ${updateParentIndex}, current internalIndex: ${internalCurrentIndex.current}, isNative: ${isNative.current}`);
    stopRequested.current = true;

    try {
      if (isNative.current) {
        console.log('[TTSPlayer] Stopping native TTS engine...');
        await TextToSpeech.stop();
        console.log('[TTSPlayer] Native TTS engine stopped.');
      } else {
        if (currentUtterance.current) {
          currentUtterance.current.onend = null;
          currentUtterance.current.onerror = null;
          currentUtterance.current.onstart = null;
        }
        if (synth.current && (synth.current.speaking || synth.current.pending)) {
          console.log('[TTSPlayer] Cancelling web speech synthesis...');
          synth.current.cancel();
          console.log('[TTSPlayer] Web speech synthesis cancelled.');
        }
        currentUtterance.current = null;
      }
    } catch (e) {
        console.error('[TTSPlayer] Error during stopSpeech:', e);
    } finally {
        if (isMounted.current) {
            setIsSpeakingState(false);
            if (updateParentIndex) {
                console.log(`[TTSPlayer] Updating parent index to: ${internalCurrentIndex.current}`);
                setParentCurrentIndex(internalCurrentIndex.current);
            } else {
                console.log(`[TTSPlayer] Not updating parent index (updateParentIndex: ${updateParentIndex})`);
            }
        }
        KeepAwake.allowSleep().catch();
        console.log('[TTSPlayer] stopSpeech finished.');
    }
  }, [setParentCurrentIndex, isNative]);

  const speakText = useCallback(async (text: string, index: number, onEndCallback: () => void) => {
    if (!isMounted.current || stopRequested.current) {
        console.log(`[TTSPlayer] Speak request cancelled or component unmounted (index: ${index})`);
        if (isSpeakingState && isMounted.current) setIsSpeakingState(false);
        return;
    }

    console.log(`[TTSPlayer] Attempting to speak index: ${index}, isNative: ${isNative.current}`);
    internalCurrentIndex.current = index;
    if (isMounted.current) {
        setParentCurrentIndex(index);
        smoothCenter(index);
        setIsSpeakingState(true);
    }

    try {
      if (isNative.current) {
        // 👇 SpeakOptions 타입 명시 제거. 객체 리터럴을 직접 전달합니다.
        const options = {
            text,
            lang: 'ko-KR',
            rate: 1.0,
            pitch: 1.0,
            volume: 1.0,
            category: 'ambient', // iOS specific, harmless on other platforms
        };
        console.log(`[TTSPlayer] Calling Native TextToSpeech.speak for index: ${index}`);
        // 타입스크립트는 speak 메소드의 파라미터 타입 정의를 보고 options 객체가 유효한지 검사합니다.
        await TextToSpeech.speak(options);
        console.log(`[TTSPlayer] Native TextToSpeech.speak finished for index: ${index}`);

        if (isMounted.current && !stopRequested.current) {
            console.log(`[TTSPlayer] Native speech ended naturally for index: ${index}. Calling onEndCallback.`);
            onEndCallback();
        } else {
            console.log(`[TTSPlayer] Native speech ended for index: ${index}, but stop was requested or component unmounted.`);
            if(isMounted.current && isSpeakingState) setIsSpeakingState(false);
        }

      } else { // Web SpeechSynthesis
        if (!synth.current) {
          console.error('[TTSPlayer] Web SpeechSynthesis not available.');
          if (isMounted.current) setIsSpeakingState(false);
          return;
        }
        if (synth.current.speaking || synth.current.pending) {
            console.warn('[TTSPlayer] Web speech was speaking/pending when new speakText called. Cancelling previous.');
            synth.current.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        currentUtterance.current = utterance;
        utterance.lang = 'ko-KR';
        utterance.rate = 0.9;
        utterance.pitch = 1.0;

        utterance.onstart = () => {
            if (stopRequested.current || !isMounted.current) {
                console.log(`[TTSPlayer] Web speech start event for index ${index}, but stop requested or unmounted. Cancelling.`);
                stopSpeech(false);
                return;
            }
            console.log(`[TTSPlayer] Web speech started for index: ${index}`);
        };

        utterance.onend = () => {
            console.log(`[TTSPlayer] Web speech ended for index: ${index}`);
            currentUtterance.current = null;
            if (isMounted.current && !stopRequested.current) {
                 console.log(`[TTSPlayer] Web speech ended naturally for index: ${index}. Calling onEndCallback.`);
                onEndCallback();
            } else {
                 console.log(`[TTSPlayer] Web speech ended for index: ${index}, but stop was requested or component unmounted.`);
                 if(isMounted.current && isSpeakingState) setIsSpeakingState(false);
            }
        };

        utterance.onerror = (event) => {
            console.error('[TTSPlayer] Web TTS Error:', event);
            currentUtterance.current = null;
            if (isMounted.current) {
               stopSpeech(false);
            }
        };

        console.log(`[TTSPlayer] Calling Web synth.speak for index: ${index}`);
        synth.current.speak(utterance);
      }
    } catch (error) {
        console.error(`[TTSPlayer] Error during speakText for index ${index}:`, error);
        if (isMounted.current) {
           stopSpeech(false);
        }
    }
  }, [isNative, setParentCurrentIndex, smoothCenter, stopSpeech, isSpeakingState]);

  const playNextSpeech = useCallback((currentIndex: number) => {
    if (!isMounted.current || stopRequested.current) {
      console.log(`[TTSPlayer] playNextSpeech cancelled or component unmounted. stopRequested: ${stopRequested.current}`);
      if (isSpeakingState && isMounted.current) setIsSpeakingState(false);
      return;
    }

    const nextIndex = currentIndex + 1;
    console.log(`[TTSPlayer] playNextSpeech: current index ${currentIndex}, trying next index ${nextIndex}`);

    if (nextIndex >= sentences.length) {
      console.log('[TTSPlayer] Reached end of sentences.');
      if (isMounted.current) {
         setIsSpeakingState(false);
         setParentCurrentIndex(currentIndex);
      }
      KeepAwake.allowSleep().catch();
      return;
    }

    const nextText = sentences[nextIndex];
    if (!nextText?.trim()) {
      console.log(`[TTSPlayer] Skipping empty sentence at index: ${nextIndex}`);
      playNextSpeech(nextIndex);
      return;
    }

    speakText(nextText, nextIndex, () => {
      if (!stopRequested.current && isMounted.current) {
        setTimeout(() => playNextSpeech(nextIndex), 120);
      }
    });
  }, [sentences, speakText, setParentCurrentIndex, isSpeakingState]);

  const handlePlayPause = useCallback(async () => {
    console.log(`[TTSPlayer] handlePlayPause called. isSpeakingState: ${isSpeakingState}`);
    if (isSpeakingState) {
      await stopSpeech();
    } else {
      stopRequested.current = false;
      try {
          await KeepAwake.keepAwake();
      } catch(e) {
          console.warn("Failed to keep awake:", e);
      }

      const textToSpeak = sentences[parentCurrentIndex];
      if (!textToSpeak?.trim()) {
        console.log(`[TTSPlayer] Current sentence at index ${parentCurrentIndex} is empty. Cannot play.`);
        KeepAwake.allowSleep().catch();
        return;
      }

      speakText(textToSpeak, parentCurrentIndex, () => {
          if (!stopRequested.current && isMounted.current) {
              setTimeout(() => playNextSpeech(parentCurrentIndex), 120);
          }
      });
    }
  }, [isSpeakingState, parentCurrentIndex, sentences, stopSpeech, speakText, playNextSpeech]);

  useEffect(() => {
    if (isSpeakingState && parentCurrentIndex !== internalCurrentIndex.current) {
      console.log(`[TTSPlayer] External index change detected (parent: ${parentCurrentIndex}, internal: ${internalCurrentIndex.current}) while speaking. Stopping.`);
      stopSpeech(false);
    }
    else if (!isSpeakingState) {
         internalCurrentIndex.current = parentCurrentIndex;
    }
  }, [parentCurrentIndex, isSpeakingState, stopSpeech]);

  return (
    <button
      onClick={handlePlayPause}
      className="fixed bottom-[84px] left-1/2 -translate-x-1/2 bg-red-light text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg z-50"
      aria-label={isSpeakingState ? '일시정지' : '재생'}
      disabled={sentences.length === 0}
    >
      {isSpeakingState ? <Pause size={32} /> : <Play size={32} />}
    </button>
  );
};

export default TTSPlayer;
