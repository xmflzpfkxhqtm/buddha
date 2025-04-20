import { create } from 'zustand';

type AskStore = {
  question: string;
  selectedModel: string;
  showModal: boolean;
  parentId: string | null; // ✅ follow-up 기능용 추가

  setQuestion: (q: string) => void;
  setSelectedModel: (m: string) => void;
  setShowModal: (s: boolean) => void;
  setParentId: (id: string | null) => void; // ✅ follow-up 기능용 추가
};

export const useAskStore = create<AskStore>((set) => ({
  question: '',
  selectedModel: 'gpt4.1',
  showModal: false,
  parentId: null, // ✅ 초기값

  setQuestion: (q) => set({ question: q }),
  setSelectedModel: (m) => set({ selectedModel: m }),
  setShowModal: (s) => set({ showModal: s }),
  setParentId: (id) => set({ parentId: id }), // ✅ 설정 함수
}));
