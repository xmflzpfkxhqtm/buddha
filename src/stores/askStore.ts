import { create } from 'zustand';

type AskStore = {
  question: string;
  selectedModel: string;
  showModal: boolean;
  setQuestion: (q: string) => void;
  setSelectedModel: (m: string) => void;
  setShowModal: (s: boolean) => void;
};

export const useAskStore = create<AskStore>((set) => ({
  question: '',
  selectedModel: 'gpt4.1',
  showModal: false,
  setQuestion: (q) => set({ question: q }),
  setSelectedModel: (m) => set({ selectedModel: m }),
  setShowModal: (s) => set({ showModal: s }),
}));
