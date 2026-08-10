'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function PaginationControls({ currentPage, totalPages, onPageChange }: PaginationControlsProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex justify-center items-center gap-4 mt-6">
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="이전 페이지"
        className="w-10 h-10 flex items-center justify-center rounded-lg text-accent hover:bg-accent/5 active:bg-accent/10 transition-colors disabled:text-ink-subtle disabled:hover:bg-transparent"
      >
        <ChevronLeft size={20} />
      </button>
      <span className="text-sm text-ink-muted tabular-nums">
        {currentPage} / {totalPages}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="다음 페이지"
        className="w-10 h-10 flex items-center justify-center rounded-lg text-accent hover:bg-accent/5 active:bg-accent/10 transition-colors disabled:text-ink-subtle disabled:hover:bg-transparent"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
