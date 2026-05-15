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
  className?: string;
  bottomOffset?: string; // CSS 표현식 (예: 'calc(env(safe-area-inset-bottom) + 130px)'). default '96px'
}

const PlayerControlsUI: React.FC<PlayerControlsUIProps> = ({
  isPlaying,
  onPlayPause,
  onSkipBackward,
  onSkipForward,
  isBackwardDisabled,
  isForwardDisabled,
  isPlayPauseDisabled,
  className = '',
  bottomOffset = '96px',
}) => {
  return (
    <div
      className={`fixed left-1/2 -translate-x-1/2 flex items-center gap-4 z-50 bg-surface-elevated/80 backdrop-blur-sm p-2 rounded-full shadow-2xl ring-1 ring-black/10 ${className}`}
      style={{
        bottom: bottomOffset,
        boxShadow: '0 12px 32px -4px rgba(0,0,0,0.45), 0 4px 12px -2px rgba(0,0,0,0.3)',
      }}
    >
      <button
        onClick={onSkipBackward}
        disabled={isBackwardDisabled}
        className="bg-accent-soft text-on-brand rounded-full w-12 h-12 flex items-center justify-center shadow-lg disabled:opacity-50 transition-opacity duration-200"
        aria-label="이전 문장"
      >
        <SkipBack size={24} />
      </button>

      <button
        onClick={onPlayPause}
        disabled={isPlayPauseDisabled}
        className="bg-accent-soft text-on-brand rounded-full w-16 h-16 flex items-center justify-center shadow-xl disabled:opacity-50 transition-opacity duration-200"
        aria-label={isPlaying ? '일시정지' : '재생'}
      >
        {isPlaying ? <Pause size={36} fill="currentColor" /> : <Play size={36} fill="currentColor" />}
      </button>

      <button
        onClick={onSkipForward}
        disabled={isForwardDisabled}
        className="bg-accent-soft text-on-brand rounded-full w-12 h-12 flex items-center justify-center shadow-lg disabled:opacity-50 transition-opacity duration-200"
        aria-label="다음 문장"
      >
        <SkipForward size={24} />
      </button>
    </div>
  );
};

export default PlayerControlsUI;
