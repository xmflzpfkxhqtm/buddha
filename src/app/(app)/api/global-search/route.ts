// app/api/global-search/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

const splitSentences = (text: string): string[] =>
  text
    .split(/(?<=[.!?]["”'’]?)\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

const parseScriptureSentences = (content: string): string[] => {
  const lines = content.split('\n');
  const paragraphs: string[] = [];
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;
    const paragraphText = paragraphBuffer.join(' ').trim();
    if (paragraphText) paragraphs.push(paragraphText);
    paragraphBuffer = [];
  };

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed === '---' || /^#{1,6}\s+/.test(trimmed) || /^>\s?/.test(trimmed)) {
      flushParagraph();
      return;
    }

    paragraphBuffer.push(trimmed);
  });

  flushParagraph();
  return paragraphs.flatMap((paragraph) => splitSentences(paragraph));
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query')?.trim();

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  // pg_trgm GIN index가 ILIKE '%query%'를 자동 활용
  const escaped = query.replace(/[%_\\]/g, (c) => `\\${c}`);

  const { data, error } = await supabase
    .from('scriptures')
    .select('title, content')
    .not('title', 'ilike', '%용어사전%')
    .ilike('content', `%${escaped}%`);

  if (error) {
    console.error('global-search 오류:', error);
    return NextResponse.json({ error: 'DB error', results: [] }, { status: 500 });
  }

  const results: { title: string; index: number; text: string }[] = [];
  for (const row of data ?? []) {
    const title = (row.title as string)
      .trim()
      .replace(/﻿/g, '')
      .replace(/\s/g, '')
      .normalize('NFC');
    const sentences = parseScriptureSentences(row.content as string);
    sentences.forEach((sentence, index) => {
      if (sentence.includes(query)) {
        results.push({ title, index, text: sentence });
      }
    });
  }

  return NextResponse.json({ results });
}
