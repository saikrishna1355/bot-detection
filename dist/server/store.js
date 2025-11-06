"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemorySessionStore = void 0;
class InMemorySessionStore {
    constructor(ttlMs = 1000 * 60 * 30) {
        var _a;
        this.sessions = new Map();
        this.ttlMs = ttlMs;
        // periodic cleanup
        const h = setInterval(() => this.cleanup(), Math.min(ttlMs, 60000));
        (_a = h === null || h === void 0 ? void 0 : h.unref) === null || _a === void 0 ? void 0 : _a.call(h);
    }
    get(id) {
        const s = this.sessions.get(id);
        if (!s)
            return undefined;
        const now = Date.now();
        if (now - s.lastSeen > this.ttlMs) {
            this.sessions.delete(id);
            return undefined;
        }
        return s;
    }
    upsert(partial) {
        const existing = this.sessions.get(partial.id);
        const now = Date.now();
        const merged = existing ? {
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
            if (now - s.lastSeen > this.ttlMs)
                this.sessions.delete(id);
        }
    }
}
exports.InMemorySessionStore = InMemorySessionStore;
