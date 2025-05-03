import { get, set, del, keys } from 'idb-keyval';

export async function saveStroke(sessionId: string, idx: number, svg: string) {
  await set(`${sessionId}:${idx}`, svg);
}

export async function getStroke(sessionId: string, idx: number) {
  return get<string>(`${sessionId}:${idx}`);
}

export async function deleteStroke(sessionId: string, idx: number) {
  await del(`${sessionId}:${idx}`);
}

export async function clearSession(sessionId: string) {
  for (const k of await keys()) {
    if (typeof k === 'string' && k.startsWith(`${sessionId}:`)) {
      await del(k);
    }
  }
}
