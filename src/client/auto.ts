import { collectFingerprint } from './sensor';
import { sendTelemetry } from './index';
import type { ClientFingerprint } from '../types';

type AutoOptions = {
  telemetryUrl?: string;
  sampleMs?: number;
  attachFetch?: boolean;
  attachXHR?: boolean;
  headerName?: string;
};

let stopCollector: (() => void) | null = null;
let restoreFetch: (() => void) | null = null;
let restoreXHR: (() => void) | null = null;
let latest: ClientFingerprint | null = null;

function base64(str: string) {
  try { return btoa(str); }
  catch {
    try {
      const g: any = globalThis as any;
      if (g && g.Buffer) return g.Buffer.from(str, 'utf8').toString('base64');
    } catch {}
    return str;
  }
}

function attachFetchHeader(headerName: string) {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return () => {};
  const original = window.fetch.bind(window);
  const isSameOrigin = (url: string) => {
    try {
      const u = new URL(url, window.location.href);
      return u.origin === window.location.origin;
    } catch { return true; }
  };
  const patchedFetch: any = (input: any, init?: any) => {
    try {
      const url = typeof input === 'string' ? input : (input as any).url || String(input);
      if (latest && isSameOrigin(url)) {
        const hdr = base64(JSON.stringify(latest));
        init = init || {};
        const headers = new Headers(init.headers || (typeof (input as any).headers !== 'undefined' ? (input as any).headers : undefined));
        headers.set(headerName, hdr);
        init.headers = headers;
      }
    } catch {}
    return original(input as any, init as any);
  };
  (window as any).fetch = patchedFetch;
  return () => { window.fetch = original; };
}

function attachXHRHeader(headerName: string) {
  if (typeof window === 'undefined' || typeof XMLHttpRequest === 'undefined') return () => {};
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  let lastHeaders: Record<string, string> = {};
  (XMLHttpRequest.prototype as any).open = function (...args: any[]) {
    // Reset headers per request
    lastHeaders = {};
    return origOpen.apply(this, args as any);
  };
  (XMLHttpRequest.prototype as any).setRequestHeader = function (name: string, value: string) {
    lastHeaders[name.toLowerCase()] = value;
    return (XMLHttpRequest.prototype as any).setRequestHeader.call(this, name, value);
  };
  (XMLHttpRequest.prototype as any).send = function (body?: any) {
    try {
      if (latest) {
        const hdr = base64(JSON.stringify(latest));
        if (typeof (this as any).setRequestHeader === 'function') {
          (this as any).setRequestHeader(headerName, hdr);
        }
      }
    } catch {}
    return origSend.call(this, body);
  };
  return () => {
    XMLHttpRequest.prototype.open = origOpen;
    XMLHttpRequest.prototype.send = origSend;
  };
}

export function initAuto(options: AutoOptions = {}) {
  if (typeof window === 'undefined') return { stop() {} };
  const globalCfg = (window as any).__BOT_DETECTION__ || {};
  const cfg: Required<AutoOptions> = {
    telemetryUrl: options.telemetryUrl ?? globalCfg.telemetryUrl ?? '/_bot/telemetry',
    sampleMs: options.sampleMs ?? globalCfg.sampleMs ?? 2000,
    attachFetch: options.attachFetch ?? (globalCfg.attachFetch ?? true),
    attachXHR: options.attachXHR ?? (globalCfg.attachXHR ?? false),
    headerName: options.headerName ?? globalCfg.headerName ?? 'x-bot-features',
  } as any;

  // Start collector
  stopCollector?.();
  stopCollector = collectFingerprint({
    intervalMs: cfg.sampleMs,
    onUpdate(fp) {
      latest = fp;
      // send telemetry periodically
      sendTelemetry(cfg.telemetryUrl, fp);
    },
  });

  // Attach fetch/XHR headers
  if (cfg.attachFetch) restoreFetch = attachFetchHeader(cfg.headerName);
  if (cfg.attachXHR) restoreXHR = attachXHRHeader(cfg.headerName);

  return {
    stop() {
      stopCollector?.();
      restoreFetch?.();
      restoreXHR?.();
      stopCollector = null;
      restoreFetch = null;
      restoreXHR = null;
    }
  };
}

// Auto-run on import for zero-config usage
if (typeof window !== 'undefined') {
  try { initAuto(); } catch {}
}
