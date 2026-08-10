'use client';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  message?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmModal({
  isOpen,
  message = '정말 삭제할까요?',
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps) {
  if (!isOpen) return null;
  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface-elevated rounded-xl p-6 w-full max-w-[360px] text-center shadow-xl"
      >
        <p className="text-base font-semibold text-ink mb-5">{message}</p>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-11 rounded-lg border border-line text-sm text-ink-muted hover:bg-surface-sunken transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 h-11 rounded-lg bg-accent text-on-brand text-sm font-semibold hover:bg-accent-soft transition-colors"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}
