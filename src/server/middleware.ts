// Minimal local types to avoid requiring express type dependency at build time
type Request = {
  headers: Record<string, any>;
  method: string;
  path: string;
  cookies?: Record<string, string>;
  socket: { remoteAddress?: string | null };
  [key: string]: any;
};
type Response = { cookie?: (...args: any[]) => any; locals: any; [key: string]: any };
type NextFunction = () => void;

import type { BotDetectionResult, ClientFingerprint, HeuristicResult, MiddlewareOptions } from '../types';
import { InMemorySessionStore } from './store';
import { defaultPredict, toFeatures } from './ml';

const DEFAULT_HEADER = 'x-bot-features';
const DEFAULT_COOKIE = 'bd_sid';

function makeId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function base64DecodeJson<T = any>(val: string): T | undefined {
  try {
    // Use global Buffer if present (Node), else atob (browser)
    const g: any = globalThis as any;
    const json = g.Buffer ? g.Buffer.from(val, 'base64').toString('utf8') : (typeof atob === 'function' ? atob(val) : val);
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

function evaluateHeuristics(req: Request, fp?: ClientFingerprint): HeuristicResult {
  const reasons: string[] = [];
  let score = 0; // 0 = likely human, 1 = likely bot

  // Missing common headers
  const requiredHeaders = ['user-agent', 'accept', 'accept-language'];
  for (const h of requiredHeaders) {
    if (!req.headers[h]) { reasons.push(`missing:${h}`); score += 0.1; }
  }

  const ua = String(req.headers['user-agent'] || '');
  if (/HeadlessChrome|PhantomJS|Puppeteer|Playwright|node\.js|curl|wget|bot|spider/i.test(ua)) {
    reasons.push('ua:headless_or_bot_keyword');
    score += 0.4;
  }

  // Suspicious sec-ch-ua patterns
  if (!req.headers['sec-ch-ua']) { reasons.push('missing:sec-ch-ua'); score += 0.05; }

  // If client fingerprint present, check interaction plausibility
  if (fp) {
    if (!fp.jsEnabled) { reasons.push('js:not_executed'); score += 0.5; }
    const moves = fp.interactions.mouseMoves || 0;
    const keys = fp.interactions.keyPresses || 0;
    const time = fp.interactions.timeOnPageMs || 0;
    if (time > 1500 && moves === 0 && keys === 0) { reasons.push('no_interaction'); score += 0.2; }
    if (fp.userAgent && /HeadlessChrome|Puppeteer|Playwright/i.test(fp.userAgent)) { reasons.push('fp:headless_ua'); score += 0.3; }
  }

  // Clamp 0..1
  score = Math.max(0, Math.min(1, score));
  return { score, reasons };
}

export function createBotDetector(options: MiddlewareOptions = {}) {
  const header = (options.headerName || DEFAULT_HEADER).toLowerCase();
  const cookieName = options.sessionCookieName || DEFAULT_COOKIE;
  const telemetryPath = options.telemetryPath || '/_bot/telemetry';
  const rate = options.rateLimit || { windowMs: 60_000, max: 120 };
  const mlEnabled = options.ml?.enabled ?? true;
  const predict = options.ml?.predict || defaultPredict;

  const store = new InMemorySessionStore(options.sessionTtlMs);
  const hitsByKey = new Map<string, { ts: number[] }>();

  function rateHit(key: string) {
    const now = Date.now();
    const rec = hitsByKey.get(key) || { ts: [] };
    rec.ts.push(now);
    // drop outside window
    while (rec.ts.length && now - rec.ts[0] > rate.windowMs) rec.ts.shift();
    hitsByKey.set(key, rec);
    return rec.ts.length;
  }

  function middleware(req: Request & { botDetection?: BotDetectionResult }, res: Response, next: NextFunction) {
    // Bind or generate session id
    let sid = (req.cookies?.[cookieName] as string) || (req.headers[cookieName] as string) as string | undefined;
    if (!sid) sid = makeId();
    // Set cookie if not present
    if (!req.cookies?.[cookieName]) {
      res.cookie?.(cookieName, sid, { httpOnly: false, sameSite: 'Lax', maxAge: options.sessionTtlMs || 30 * 60_000 });
    }

    // Parse client fingerprint if provided via header
    let clientFp: ClientFingerprint | undefined;
    const hdr = req.headers[header];
    if (typeof hdr === 'string') clientFp = base64DecodeJson<ClientFingerprint>(hdr);

    const heuristic = evaluateHeuristics(req, clientFp);

    let mlRes: ReturnType<typeof predict> | undefined;
    if (mlEnabled && clientFp) {
      mlRes = predict(toFeatures({
        interactions: clientFp.interactions,
        screen: clientFp.screen,
        devicePixelRatio: clientFp.devicePixelRatio,
        timezone: clientFp.timezone,
        jsEnabled: clientFp.jsEnabled,
      }));
    }

    const combinedScore = Math.max(heuristic.score, mlRes?.score ?? 0);
    const isBot = combinedScore >= 0.5;

    // Simple rate limiting heuristic
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const key = `${ip}|${req.headers['user-agent'] || ''}`;
    const hits = rateHit(key);
    if (hits > rate.max) {
      heuristic.reasons.push('rate:too_many_requests');
      heuristic.score = Math.min(1, Math.max(heuristic.score, 0.8));
    }

    // Persist session info
    const session = store.upsert({ id: sid, ip, ua: String(req.headers['user-agent'] || ''), heuristic, ml: mlRes });

    req.botDetection = { isBot, score: Math.max(heuristic.score, mlRes?.score ?? 0), heuristic, ml: mlRes, sessionId: session.id };
    res.locals.bot = req.botDetection;
    next();
  }

  // Minimal router to receive telemetry and expose prediction API
  function router(req: Request, res: Response, next: NextFunction) {
    if (req.method === 'POST' && req.path === telemetryPath) {
      const fp: ClientFingerprint | undefined = (req as any).body;
      if (!fp) return res.status(400).json({ error: 'Missing body' });
      const dummyReq = req as any as Request;
      const heuristic = evaluateHeuristics(dummyReq, fp);
      let mlRes: ReturnType<typeof predict> | undefined;
      if (mlEnabled) mlRes = predict(toFeatures({
        interactions: fp.interactions,
        screen: fp.screen,
        devicePixelRatio: fp.devicePixelRatio,
        timezone: fp.timezone,
        jsEnabled: fp.jsEnabled,
      }));
      const score = Math.max(heuristic.score, mlRes?.score ?? 0);
      return res.json({ score, heuristic, ml: mlRes, isBot: score >= 0.5 });
    }
    return next();
  }

  return { middleware, router, cookieName, headerName: header, telemetryPath };
}
