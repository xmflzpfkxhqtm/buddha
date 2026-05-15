// 사용자별 경전(그룹) 즐겨찾기 클라이언트 캐시.
// supabase RLS 가 user-scoping 을 자동 처리하므로 별도 API route 없이 직접 호출.
// Layer 1 의 "내 즐겨찾기" 섹션과 Layer 2 의 ★ 토글이 같은 store 를 구독.

import { create } from 'zustand';
import { supabase } from '@/lib/supabaseClient';

export type FavoriteGroup = {
  group_key: string;
  display_name: string | null;
  chinese_title: string | null;
  volume_total: number | null;
  k_code: string | null;
};

interface FavoritesState {
  loaded: boolean;            // 한 번이라도 load 시도했는지
  loading: boolean;
  userId: string | null;      // 현재 캐시가 어느 사용자 것인지
  keys: Set<string>;          // 빠른 isFavorited 조회용
  groups: FavoriteGroup[];    // 최신순 (Layer 1 표시용)
  load: (userId: string) => Promise<void>;
  add: (userId: string, group: FavoriteGroup) => Promise<{ ok: boolean; error?: string }>;
  remove: (userId: string, groupKey: string) => Promise<{ ok: boolean; error?: string }>;
  reset: () => void;
}

export const useScriptureFavoritesStore = create<FavoritesState>((set, get) => ({
  loaded: false,
  loading: false,
  userId: null,
  keys: new Set(),
  groups: [],

  load: async (userId) => {
    if (!userId) return;
    // 다른 사용자로 바뀌면 캐시 폐기
    if (get().userId && get().userId !== userId) {
      set({ keys: new Set(), groups: [], loaded: false, userId });
    }
    if (get().loading) return;
    set({ loading: true, userId });
    const { data, error } = await supabase
      .from('scripture_favorites')
      .select('group_key, scripture_groups (display_name, chinese_title, volume_total, k_code)')
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('즐겨찾기 로드 실패', error);
      set({ loading: false, loaded: true });
      return;
    }
    type Row = {
      group_key: string;
      scripture_groups: {
        display_name: string | null;
        chinese_title: string | null;
        volume_total: number | null;
        k_code: string | null;
      } | null;
    };
    const rows = (data ?? []) as unknown as Row[];
    const groups: FavoriteGroup[] = rows.map((r) => ({
      group_key: r.group_key,
      display_name: r.scripture_groups?.display_name ?? null,
      chinese_title: r.scripture_groups?.chinese_title ?? null,
      volume_total: r.scripture_groups?.volume_total ?? null,
      k_code: r.scripture_groups?.k_code ?? null,
    }));
    set({
      keys: new Set(groups.map((g) => g.group_key)),
      groups,
      loading: false,
      loaded: true,
    });
  },

  add: async (userId, group) => {
    if (!userId) return { ok: false, error: 'no-user' };
    // optimistic
    const prev = get();
    if (prev.keys.has(group.group_key)) return { ok: true };
    const nextKeys = new Set(prev.keys);
    nextKeys.add(group.group_key);
    set({ keys: nextKeys, groups: [group, ...prev.groups] });
    const { error } = await supabase
      .from('scripture_favorites')
      .insert({ user_id: userId, group_key: group.group_key });
    if (error) {
      // rollback
      set({ keys: prev.keys, groups: prev.groups });
      console.warn('즐겨찾기 추가 실패', error);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  },

  remove: async (userId, groupKey) => {
    if (!userId) return { ok: false, error: 'no-user' };
    const prev = get();
    if (!prev.keys.has(groupKey)) return { ok: true };
    const nextKeys = new Set(prev.keys);
    nextKeys.delete(groupKey);
    set({
      keys: nextKeys,
      groups: prev.groups.filter((g) => g.group_key !== groupKey),
    });
    const { error } = await supabase
      .from('scripture_favorites')
      .delete()
      .eq('user_id', userId)
      .eq('group_key', groupKey);
    if (error) {
      set({ keys: prev.keys, groups: prev.groups });
      console.warn('즐겨찾기 삭제 실패', error);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  },

  reset: () => set({ loaded: false, loading: false, userId: null, keys: new Set(), groups: [] }),
}));
