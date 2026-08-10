export interface TTSPlayerProps {
  sentences: string[];
  currentIndex: number;
  setCurrentIndex: (idx: number) => void;
  smoothCenter: (idx: number, instant?: boolean) => void;
  onPlaybackStateChange: (isSpeaking: boolean) => void;
  className?: string;
  bottomOffset?: string;
}
