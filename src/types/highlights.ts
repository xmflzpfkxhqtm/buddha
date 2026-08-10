/** highlights 테이블 기본 컬럼 (me/highlights 표시용) */
export interface DisplayHighlight {
  id: string;
  user_id: string;
  title: string;
  start_sentence: number;
  end_sentence: number;
  start_char_offset: number | null;
  end_char_offset: number | null;
  anchor_start_text: string | null;
  highlight_text: string | null;
  created_at: string;
  memo?: string | null;
}

/** highlights 테이블 전체 컬럼 (resolve-batch 처리용) */
export interface HighlightDbRow {
  id: string;
  user_id: string;
  title: string;
  start_sentence: number;
  end_sentence: number;
  start_char_offset: number | null;
  end_char_offset: number | null;
  anchor_start_text: string | null;
  anchor_end_text: string | null;
  highlight_text: string | null;
  memo: string | null;
  anchor_status: string;
  resolved_version: number;
  created_at: string;
}
