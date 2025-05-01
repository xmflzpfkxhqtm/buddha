'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Capacitor } from '@capacitor/core'; // CapacitorHttp는 사용 안 하면 제거

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
  const platform = useRef<string>(Capacitor.getPlatform());
  const isNative = useRef<boolean>(platform.current !== 'web');
  // 👇 !window.MSStream 조건 제거
  const isIOSWeb = useRef<boolean>(platform.current === 'web' && /iPad|iPhone|iPod/.test(navigator.userAgent));
  const isMounted = useRef<boolean>(false);

  useEffect(() => {
    isMounted.current = true;
    console.log(`[TTSPlayer] Component mounted. Platform: ${platform.current}, isNative: ${isNative.current}, isIOSWeb: ${isIOSWeb.current}`);

    if (!isNative.current && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synth.current = window.speechSynthesis;
      try {
        const voices = synth.current.getVoices();
        console.log('[TTSPlayer] Initial voices count:', voices.length);
      } catch (e) {
          console.error("[TTSPlayer] Error calling getVoices initially:", e);
      }
      if (synth.current.speaking || synth.current.pending) {
        console.log('[TTSPlayer] Initializing: Cancelling existing web speech');
        synth.current.cancel();
      }
      console.log('[TTSPlayer] Web SpeechSynthesis initialized');

      const handleVoicesChanged = () => {
          if (synth.current) {
              console.log('[TTSPlayer] Voices changed. Count:', synth.current.getVoices().length);
          }
      };
      synth.current.onvoiceschanged = handleVoicesChanged;

    } else if (isNative.current) {
      TextToSpeech.stop().catch(e => console.warn('[TTSPlayer] Initial native stop failed (may be normal):', e));
      console.log('[TTSPlayer] Native TTS platform detected');
    }

    return () => {
      isMounted.current = false;
      console.log('[TTSPlayer] Component unmounting, stopping speech.');
       if (synth.current) {
           synth.current.onvoiceschanged = null;
       }
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
          currentUtterance.current = null;
        }
        if (synth.current && (synth.current.speaking || synth.current.pending)) {
          console.log('[TTSPlayer] Cancelling web speech synthesis...');
          synth.current.cancel();
          console.log('[TTSPlayer] Web speech synthesis cancelled.');
        }
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

    console.log(`[TTSPlayer] Attempting to speak index: ${index}, isNative: ${isNative.current}, isIOSWeb: ${isIOSWeb.current}`);
    internalCurrentIndex.current = index;
    if (isMounted.current) {
        setParentCurrentIndex(index);
        smoothCenter(index);
        setIsSpeakingState(true);
    }

    try {
      if (isNative.current) {
        const options = {
            text,
            lang: 'ko-KR',
            rate: 1.0,
            pitch: 1.0,
            volume: 1.0,
            category: 'ambient',
        };
        console.log(`[TTSPlayer] Calling Native TextToSpeech.speak for index: ${index}`);
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
            console.warn('[TTSPlayer] Web speech was speaking/pending. Cancelling previous.');
            synth.current.cancel();
            await new Promise(resolve => setTimeout(resolve, isIOSWeb.current ? 100 : 50));
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
            console.error('Error details:', {
                error: event.error,
                type: event.type,
                charIndex: event.charIndex,
                elapsedTime: event.elapsedTime,
                name: event.name,
                utteranceText: event.utterance?.text.substring(0, 50) + '...'
            });
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
  }, [isNative, isIOSWeb, setParentCurrentIndex, smoothCenter, stopSpeech, isSpeakingState]);

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
          } else if (isMounted.current) {
              setIsSpeakingState(false);
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