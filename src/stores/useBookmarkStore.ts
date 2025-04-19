import { create } from 'zustand';

type BookmarkState = {
  title: string | null;
  index: number | null;
  setBookmark: (title: string, index: number) => void;
  clearBookmark: () => void;
};

export const useBookmarkStore = create<BookmarkState>((set) => ({
  title: null,
  index: null,
  setBookmark: (title, index) => set({ title, index }),
  clearBookmark: () => set({ title: null, index: null }),
}));
