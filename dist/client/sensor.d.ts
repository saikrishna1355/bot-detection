import type { ClientFingerprint } from '../types';
type Options = {
    intervalMs?: number;
    onUpdate?: (fp: ClientFingerprint) => void;
};
export declare function collectFingerprint(opts?: Options): () => void;
export {};
