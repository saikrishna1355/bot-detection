"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initAuto = initAuto;
const sensor_1 = require("./sensor");
const index_1 = require("./index");
let stopCollector = null;
let restoreFetch = null;
let restoreXHR = null;
let latest = null;
function base64(str) {
    try {
        return btoa(str);
    }
    catch {
        try {
            const g = globalThis;
            if (g && g.Buffer)
                return g.Buffer.from(str, 'utf8').toString('base64');
        }
        catch { }
        return str;
    }
}
function attachFetchHeader(headerName) {
    if (typeof window === 'undefined' || typeof window.fetch !== 'function')
        return () => { };
    const original = window.fetch.bind(window);
    const isSameOrigin = (url) => {
        try {
            const u = new URL(url, window.location.href);
            return u.origin === window.location.origin;
        }
        catch {
            return true;
        }
    };
    const patchedFetch = (input, init) => {
        try {
            const url = typeof input === 'string' ? input : input.url || String(input);
            if (latest && isSameOrigin(url)) {
                const hdr = base64(JSON.stringify(latest));
                init = init || {};
                const headers = new Headers(init.headers || (typeof input.headers !== 'undefined' ? input.headers : undefined));
                headers.set(headerName, hdr);
                init.headers = headers;
            }
        }
        catch { }
        return original(input, init);
    };
    window.fetch = patchedFetch;
    return () => { window.fetch = original; };
}
function attachXHRHeader(headerName) {
    if (typeof window === 'undefined' || typeof XMLHttpRequest === 'undefined')
        return () => { };
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    let lastHeaders = {};
    XMLHttpRequest.prototype.open = function (...args) {
        // Reset headers per request
        lastHeaders = {};
        return origOpen.apply(this, args);
    };
    XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
        lastHeaders[name.toLowerCase()] = value;
        return XMLHttpRequest.prototype.setRequestHeader.call(this, name, value);
    };
    XMLHttpRequest.prototype.send = function (body) {
        try {
            if (latest) {
                const hdr = base64(JSON.stringify(latest));
                if (typeof this.setRequestHeader === 'function') {
                    this.setRequestHeader(headerName, hdr);
                }
            }
        }
        catch { }
        return origSend.call(this, body);
    };
    return () => {
        XMLHttpRequest.prototype.open = origOpen;
        XMLHttpRequest.prototype.send = origSend;
    };
}
function initAuto(options = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    if (typeof window === 'undefined')
        return { stop() { } };
    const globalCfg = window.__BOT_DETECTION__ || {};
    const cfg = {
        telemetryUrl: (_b = (_a = options.telemetryUrl) !== null && _a !== void 0 ? _a : globalCfg.telemetryUrl) !== null && _b !== void 0 ? _b : '/_bot/telemetry',
        sampleMs: (_d = (_c = options.sampleMs) !== null && _c !== void 0 ? _c : globalCfg.sampleMs) !== null && _d !== void 0 ? _d : 2000,
        attachFetch: (_e = options.attachFetch) !== null && _e !== void 0 ? _e : ((_f = globalCfg.attachFetch) !== null && _f !== void 0 ? _f : true),
        attachXHR: (_g = options.attachXHR) !== null && _g !== void 0 ? _g : ((_h = globalCfg.attachXHR) !== null && _h !== void 0 ? _h : false),
        headerName: (_k = (_j = options.headerName) !== null && _j !== void 0 ? _j : globalCfg.headerName) !== null && _k !== void 0 ? _k : 'x-bot-features',
    };
    // Start collector
    stopCollector === null || stopCollector === void 0 ? void 0 : stopCollector();
    stopCollector = (0, sensor_1.collectFingerprint)({
        intervalMs: cfg.sampleMs,
        onUpdate(fp) {
            latest = fp;
            // send telemetry periodically
            (0, index_1.sendTelemetry)(cfg.telemetryUrl, fp);
        },
    });
    // Attach fetch/XHR headers
    if (cfg.attachFetch)
        restoreFetch = attachFetchHeader(cfg.headerName);
    if (cfg.attachXHR)
        restoreXHR = attachXHRHeader(cfg.headerName);
    return {
        stop() {
            stopCollector === null || stopCollector === void 0 ? void 0 : stopCollector();
            restoreFetch === null || restoreFetch === void 0 ? void 0 : restoreFetch();
            restoreXHR === null || restoreXHR === void 0 ? void 0 : restoreXHR();
            stopCollector = null;
            restoreFetch = null;
            restoreXHR = null;
        }
    };
}
// Auto-run on import for zero-config usage
if (typeof window !== 'undefined') {
    try {
        initAuto();
    }
    catch { }
}
