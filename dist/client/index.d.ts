import type { ClientFingerprint } from '../types';
export type ClientOptions = {
    sampleMs?: number;
    onUpdate?: (fp: ClientFingerprint) => void;
};
export declare function initClient(options?: ClientOptions): {
    stop: () => void;
};
export declare function sendTelemetry(url: string, data: ClientFingerprint): Promise<{
    ok: boolean;
}>;
export { collectFingerprint } from './sensor';
