import type { SessionInfo } from '../types';

export class InMemorySessionStore {
  private sessions = new Map<string, SessionInfo>();
  private ttlMs: number;

  constructor(ttlMs = 1000 * 60 * 30) {
    this.ttlMs = ttlMs;
    // periodic cleanup
    const h = setInterval(() => this.cleanup(), Math.min(ttlMs, 60_000));
    (h as any)?.unref?.();
  }

  get(id: string) {
    const s = this.sessions.get(id);
    if (!s) return undefined;
    const now = Date.now();
    if (now - s.lastSeen > this.ttlMs) {
      this.sessions.delete(id);
      return undefined;
    }
    return s;
  }

  upsert(partial: Omit<SessionInfo, 'createdAt' | 'lastSeen' | 'requestCount'> & Partial<SessionInfo>) {
    const existing = this.sessions.get(partial.id);
    const now = Date.now();
    const merged: SessionInfo = existing ? {
      ...existing,
      ...partial,
      lastSeen: now,
      requestCount: existing.requestCount + 1,
    } : {
      id: partial.id,
      ip: partial.ip || '',
      ua: partial.ua || '',
      createdAt: now,
      lastSeen: now,
      requestCount: 1,
      heuristic: partial.heuristic,
      ml: partial.ml,
    };
    this.sessions.set(merged.id, merged);
    return merged;
  }

  cleanup() {
    const now = Date.now();
    for (const [id, s] of this.sessions) {
      if (now - s.lastSeen > this.ttlMs) this.sessions.delete(id);
    }
  }
}
