// PlayerControlsUI.tsx
import React from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';

interface PlayerControlsUIProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onSkipBackward: () => void;
  onSkipForward: () => void;
  isBackwardDisabled: boolean;
  isForwardDisabled: boolean;
  isPlayPauseDisabled: boolean;
}

const PlayerControlsUI: React.FC<PlayerControlsUIProps> = ({
  isPlaying,
  onPlayPause,
  onSkipBackward,
  onSkipForward,
  isBackwardDisabled,
  isForwardDisabled,
  isPlayPauseDisabled,
}) => {
  return (
    <div className="fixed bottom-[96px] left-1/2 -translate-x-1/2 flex items-center gap-4 z-50 bg-white/80 backdrop-blur-sm p-2 rounded-full shadow-lg">
      <button
        onClick={onSkipBackward}
        disabled={isBackwardDisabled}
        className="bg-red-light text-white rounded-full w-12 h-12 flex items-center justify-center shadow-md disabled:opacity-50 transition-opacity duration-200"
        aria-label="이전 문장"
      >
        <SkipBack size={24} />
      </button>

      <button
        onClick={onPlayPause}
        disabled={isPlayPauseDisabled}
        className="bg-red-light text-white rounded-full w-16 h-16 flex items-center justify-center shadow-lg disabled:opacity-50 transition-opacity duration-200"
        aria-label={isPlaying ? '일시정지' : '재생'}
      >
        {isPlaying ? <Pause size={36} fill="currentColor" /> : <Play size={36} fill="currentColor" />}
      </button>

      <button
        onClick={onSkipForward}
        disabled={isForwardDisabled}
        className="bg-red-light text-white rounded-full w-12 h-12 flex items-center justify-center shadow-md disabled:opacity-50 transition-opacity duration-200"
        aria-label="다음 문장"
      >
        <SkipForward size={24} />
      </button>
    </div>
  );
};

export default PlayerControlsUI;
