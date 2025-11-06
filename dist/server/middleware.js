"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBotDetector = createBotDetector;
const store_1 = require("./store");
const ml_1 = require("./ml");
const DEFAULT_HEADER = 'x-bot-features';
const DEFAULT_COOKIE = 'bd_sid';
function makeId() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function base64DecodeJson(val) {
    try {
        // Use global Buffer if present (Node), else atob (browser)
        const g = globalThis;
        const json = g.Buffer ? g.Buffer.from(val, 'base64').toString('utf8') : (typeof atob === 'function' ? atob(val) : val);
        return JSON.parse(json);
    }
    catch {
        return undefined;
    }
}
function evaluateHeuristics(req, fp) {
    const reasons = [];
    let score = 0; // 0 = likely human, 1 = likely bot
    // Missing common headers
    const requiredHeaders = ['user-agent', 'accept', 'accept-language'];
    for (const h of requiredHeaders) {
        if (!req.headers[h]) {
            reasons.push(`missing:${h}`);
            score += 0.1;
        }
    }
    const ua = String(req.headers['user-agent'] || '');
    if (/HeadlessChrome|PhantomJS|Puppeteer|Playwright|node\.js|curl|wget|bot|spider/i.test(ua)) {
        reasons.push('ua:headless_or_bot_keyword');
        score += 0.4;
    }
    // Suspicious sec-ch-ua patterns
    if (!req.headers['sec-ch-ua']) {
        reasons.push('missing:sec-ch-ua');
        score += 0.05;
    }
    // If client fingerprint present, check interaction plausibility
    if (fp) {
        if (!fp.jsEnabled) {
            reasons.push('js:not_executed');
            score += 0.5;
        }
        const moves = fp.interactions.mouseMoves || 0;
        const keys = fp.interactions.keyPresses || 0;
        const time = fp.interactions.timeOnPageMs || 0;
        if (time > 1500 && moves === 0 && keys === 0) {
            reasons.push('no_interaction');
            score += 0.2;
        }
        if (fp.userAgent && /HeadlessChrome|Puppeteer|Playwright/i.test(fp.userAgent)) {
            reasons.push('fp:headless_ua');
            score += 0.3;
        }
    }
    // Clamp 0..1
    score = Math.max(0, Math.min(1, score));
    return { score, reasons };
}
function createBotDetector(options = {}) {
    var _a, _b, _c;
    const header = (options.headerName || DEFAULT_HEADER).toLowerCase();
    const cookieName = options.sessionCookieName || DEFAULT_COOKIE;
    const telemetryPath = options.telemetryPath || '/_bot/telemetry';
    const rate = options.rateLimit || { windowMs: 60000, max: 120 };
    const mlEnabled = (_b = (_a = options.ml) === null || _a === void 0 ? void 0 : _a.enabled) !== null && _b !== void 0 ? _b : true;
    const predict = ((_c = options.ml) === null || _c === void 0 ? void 0 : _c.predict) || ml_1.defaultPredict;
    const store = new store_1.InMemorySessionStore(options.sessionTtlMs);
    const hitsByKey = new Map();
    function rateHit(key) {
        const now = Date.now();
        const rec = hitsByKey.get(key) || { ts: [] };
        rec.ts.push(now);
        // drop outside window
        while (rec.ts.length && now - rec.ts[0] > rate.windowMs)
            rec.ts.shift();
        hitsByKey.set(key, rec);
        return rec.ts.length;
    }
    function middleware(req, res, next) {
        var _a, _b, _c, _d, _e, _f, _g;
        // Bind or generate session id
        let sid = ((_a = req.cookies) === null || _a === void 0 ? void 0 : _a[cookieName]) || req.headers[cookieName];
        if (!sid)
            sid = makeId();
        // Set cookie if not present
        if (!((_b = req.cookies) === null || _b === void 0 ? void 0 : _b[cookieName])) {
            (_c = res.cookie) === null || _c === void 0 ? void 0 : _c.call(res, cookieName, sid, { httpOnly: false, sameSite: 'Lax', maxAge: options.sessionTtlMs || 30 * 60000 });
        }
        // Parse client fingerprint if provided via header
        let clientFp;
        const hdr = req.headers[header];
        if (typeof hdr === 'string')
            clientFp = base64DecodeJson(hdr);
        const heuristic = evaluateHeuristics(req, clientFp);
        let mlRes;
        if (mlEnabled && clientFp) {
            mlRes = predict((0, ml_1.toFeatures)({
                interactions: clientFp.interactions,
                screen: clientFp.screen,
                devicePixelRatio: clientFp.devicePixelRatio,
                timezone: clientFp.timezone,
                jsEnabled: clientFp.jsEnabled,
            }));
        }
        const combinedScore = Math.max(heuristic.score, (_d = mlRes === null || mlRes === void 0 ? void 0 : mlRes.score) !== null && _d !== void 0 ? _d : 0);
        const isBot = combinedScore >= 0.5;
        // Simple rate limiting heuristic
        const ip = ((_f = (_e = req.headers['x-forwarded-for']) === null || _e === void 0 ? void 0 : _e.split(',')[0]) === null || _f === void 0 ? void 0 : _f.trim()) || req.socket.remoteAddress || 'unknown';
        const key = `${ip}|${req.headers['user-agent'] || ''}`;
        const hits = rateHit(key);
        if (hits > rate.max) {
            heuristic.reasons.push('rate:too_many_requests');
            heuristic.score = Math.min(1, Math.max(heuristic.score, 0.8));
        }
        // Persist session info
        const session = store.upsert({ id: sid, ip, ua: String(req.headers['user-agent'] || ''), heuristic, ml: mlRes });
        req.botDetection = { isBot, score: Math.max(heuristic.score, (_g = mlRes === null || mlRes === void 0 ? void 0 : mlRes.score) !== null && _g !== void 0 ? _g : 0), heuristic, ml: mlRes, sessionId: session.id };
        res.locals.bot = req.botDetection;
        next();
    }
    // Minimal router to receive telemetry and expose prediction API
    function router(req, res, next) {
        var _a;
        if (req.method === 'POST' && req.path === telemetryPath) {
            const fp = req.body;
            if (!fp)
                return res.status(400).json({ error: 'Missing body' });
            const dummyReq = req;
            const heuristic = evaluateHeuristics(dummyReq, fp);
            let mlRes;
            if (mlEnabled)
                mlRes = predict((0, ml_1.toFeatures)({
                    interactions: fp.interactions,
                    screen: fp.screen,
                    devicePixelRatio: fp.devicePixelRatio,
                    timezone: fp.timezone,
                    jsEnabled: fp.jsEnabled,
                }));
            const score = Math.max(heuristic.score, (_a = mlRes === null || mlRes === void 0 ? void 0 : mlRes.score) !== null && _a !== void 0 ? _a : 0);
            return res.json({ score, heuristic, ml: mlRes, isBot: score >= 0.5 });
        }
        return next();
    }
    return { middleware, router, cookieName, headerName: header, telemetryPath };
}
