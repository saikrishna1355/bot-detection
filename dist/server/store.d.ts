import type { SessionInfo } from '../types';
export declare class InMemorySessionStore {
    private sessions;
    private ttlMs;
    constructor(ttlMs?: number);
    get(id: string): SessionInfo | undefined;
    upsert(partial: Omit<SessionInfo, 'createdAt' | 'lastSeen' | 'requestCount'> & Partial<SessionInfo>): SessionInfo;
    cleanup(): void;
}
