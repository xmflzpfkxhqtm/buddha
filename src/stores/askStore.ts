import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type AskStore = {
  question: string;
  selectedModel: string;
  selectedLength: string;
  showModal: boolean;
  parentId: string | null;

  setQuestion: (q: string) => void;
  setSelectedModel: (m: string) => void;
  setSelectedLength: (l: string) => void;
  setShowModal: (s: boolean) => void;
  setParentId: (id: string | null) => void;
};

export const useAskStore = create<AskStore>()(
  persist(
    (set) => ({
      question: '',
      selectedModel: 'gpt-4.1-mini', // ✅ 여기!
      selectedLength: 'short',
      showModal: false,
      parentId: null,

      setQuestion: (q) => set({ question: q }),
      setSelectedModel: (m) => set({ selectedModel: m }),
      setSelectedLength: (l) => set({ selectedLength: l }),
      setShowModal: (s) => set({ showModal: s }),
      setParentId: (id) => set({ parentId: id }),
    }),
    {
      name: 'ask-store',
      partialize: (state) => ({
        question: state.question,
        selectedModel: state.selectedModel,
        selectedLength: state.selectedLength,
        parentId: state.parentId,
      }),
    }
  )
);
