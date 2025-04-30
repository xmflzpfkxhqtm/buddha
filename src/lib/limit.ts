// lib/limit.ts
import pLimit from 'p-limit';
export const ttsLimit = pLimit(2);   // 동시에 최대 2개만 실행
