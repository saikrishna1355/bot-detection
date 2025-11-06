import { collectFingerprint } from './sensor';
import type { ClientFingerprint } from '../types';

export type ClientOptions = {
  sampleMs?: number;
  onUpdate?: (fp: ClientFingerprint) => void;
};

export function initClient(options: ClientOptions = {}) {
  const { sampleMs = 2000, onUpdate } = options;
  const start = Date.now();

  const stop = collectFingerprint({
    intervalMs: sampleMs,
    onUpdate: (fp) => {
      fp.timestamps = { start, now: Date.now() };
      if (onUpdate) onUpdate(fp);
    },
  });

  return { stop };
}

export async function sendTelemetry(url: string, data: ClientFingerprint) {
  try {
    const payload = JSON.stringify(data);
    if ('sendBeacon' in navigator) {
      const blob = new Blob([payload], { type: 'application/json' });
      (navigator as any).sendBeacon(url, blob);
      return { ok: true };
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      keepalive: true,
      body: payload,
    });
    return { ok: res.ok };
  } catch (e) {
    return { ok: false };
  }
}

export { collectFingerprint } from './sensor';

