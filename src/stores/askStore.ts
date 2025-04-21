import { create } from 'zustand';

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

export const useAskStore = create<AskStore>((set) => ({
  question: '',
  selectedModel: 'gpt4.1',
  selectedLength: 'short',
  showModal: false,
  parentId: null,

  setQuestion: (q) => set({ question: q }),
  setSelectedModel: (m) => set({ selectedModel: m }),
  setSelectedLength: (l) => set({ selectedLength: l }),
  setShowModal: (s) => set({ showModal: s }),
  setParentId: (id) => set({ parentId: id }),
}));