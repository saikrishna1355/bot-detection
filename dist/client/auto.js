"use strict";
// Minimal, zero-config bot detection that sets a cookie `isbot`
// to 'true' or 'false'. Importing this file runs detection automatically.
Object.defineProperty(exports, "__esModule", { value: true });
exports.initAuto = initAuto;
function getConfig() {
    try {
        return (window.__BOT_DETECTION__ || {});
    }
    catch {
        return {};
    }
}
function setCookie(name, value, days = 7) {
    try {
        const d = new Date();
        d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
        document.cookie = `${name}=${value}; expires=${d.toUTCString()}; path=/; samesite=lax`;
    }
    catch { }
}
function getCookie(name) {
    try {
        const target = `${name}=`;
        const parts = (document.cookie || '').split(';');
        for (const p of parts) {
            const part = p.trim();
            if (part.startsWith(target)) {
                return part.slice(target.length);
            }
        }
    }
    catch { }
    return undefined;
}
function getUA() { try {
    return navigator.userAgent || '';
}
catch {
    return '';
} }
function getWebGLInfo() {
    try {
        const c = document.createElement('canvas');
        const gl = (c.getContext('webgl') || c.getContext('experimental-webgl'));
        if (!gl)
            return undefined;
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        if (!dbg)
            return undefined;
        return {
            vendor: String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)),
            renderer: String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)),
        };
    }
    catch {
        return undefined;
    }
}
function basicHeuristic() {
    var _a, _b, _c, _d, _e, _f;
    const reasons = [];
    let score = 0;
    const ua = getUA();
    if (/HeadlessChrome|PhantomJS|Puppeteer|Playwright|bot|crawler|spider|curl|wget/i.test(ua)) {
        score += 0.7;
        reasons.push('ua');
    }
    if (/Playwright/i.test(ua)) {
        score += 0.5;
        reasons.push('playwright-ua');
    }
    try {
        if (navigator.webdriver) {
            score += 0.6;
            reasons.push('webdriver');
        }
    }
    catch { }
    try {
        const langs = (navigator.languages || []).length;
        if (!langs) {
            score += 0.2;
            reasons.push('nolangs');
        }
    }
    catch { }
    try {
        const plugins = (_b = (_a = navigator.plugins) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
        if (plugins === 0) {
            score += 0.2;
            reasons.push('noplugins');
        }
    }
    catch { }
    // Extra lightweight signals (kept small to avoid false positives)
    try {
        const isMobileUA = /Mobile|Android|iPhone|iPad|iPod/i.test(ua);
        const mtp = (_c = navigator.maxTouchPoints) !== null && _c !== void 0 ? _c : 0;
        if (isMobileUA && mtp === 0) {
            score += 0.15;
            reasons.push('touch-mismatch');
        }
    }
    catch { }
    try {
        const hc = navigator.hardwareConcurrency;
        if (typeof hc === 'number' && hc <= 1) {
            score += 0.1;
            reasons.push('low-cores');
        }
    }
    catch { }
    try {
        // Chrome UA without window.chrome is uncommon in real Chrome
        const looksChrome = /Chrome\//.test(ua) && !/Edg\//.test(ua) && !/OPR\//.test(ua);
        const hasWindowChrome = typeof window.chrome !== 'undefined';
        if (looksChrome && !hasWindowChrome) {
            score += 0.15;
            reasons.push('no-window-chrome');
        }
        const plugins = (_e = (_d = navigator.plugins) === null || _d === void 0 ? void 0 : _d.length) !== null && _e !== void 0 ? _e : 0;
        if (looksChrome && plugins === 0) {
            score += 0.15;
            reasons.push('chrome-noplugins');
        }
        const langs = (navigator.languages || []).length || 0;
        if (looksChrome && langs === 0) {
            score += 0.1;
            reasons.push('chrome-nolangs');
        }
    }
    catch { }
    try {
        const dpr = window.devicePixelRatio || 1;
        const sw = ((_f = window.screen) === null || _f === void 0 ? void 0 : _f.width) || 0;
        // Very large width with DPR=1 is sometimes headless; keep impact tiny
        if (dpr === 1 && sw >= 1920) {
            score += 0.05;
            reasons.push('dpr1-large-screen');
        }
    }
    catch { }
    try {
        const info = getWebGLInfo();
        const r = ((info === null || info === void 0 ? void 0 : info.renderer) || '').toLowerCase();
        if (r.includes('swiftshader')) {
            score += 0.25;
            reasons.push('webgl-swiftshader');
        }
    }
    catch { }
    return { score: Math.min(1, score), reasons };
}
function detectAutomationArtifacts() {
    const reasons = [];
    try {
        const w = window;
        const suspectKeys = [
            '__webdriver_evaluate', '__driver_evaluate', '__selenium_evaluate',
            '__webdriver_script_function', '__webdriver_script_fn', '__fxdriver_unwrapped',
            '__lastWatirAlert', '__lastWatirConfirm', '__lastWatirPrompt'
        ];
        for (const k of suspectKeys) {
            if (k in w) {
                reasons.push(`artifact:${k}`);
            }
        }
        // Common Selenium/Chromedriver key prefix
        for (const k in w) {
            if (/^\$cdc_/.test(k)) {
                reasons.push('artifact:$cdc');
                break;
            }
            if (/^\$chromeAsyncScriptInfo/.test(k)) {
                reasons.push('artifact:$chromeAsync');
                break;
            }
        }
    }
    catch { }
    return { hit: reasons.length > 0, reasons };
}
async function asyncTightenIfNeeded(initialScore) {
    try {
        const perms = navigator.permissions;
        if (!perms || typeof perms.query !== 'function')
            return;
        const results = [];
        try {
            const r = await perms.query({ name: 'notifications' });
            results.push(r.state);
        }
        catch { }
        try {
            const r = await perms.query({ name: 'clipboard-read' });
            results.push(r.state);
        }
        catch { }
        const deniedCount = results.filter(s => s === 'denied').length;
        if (deniedCount >= 2 && initialScore >= 0.5) {
            // If multiple permissions are hard-denied very early and we already had moderate suspicion, mark as bot
            setCookie('isbot', 'true');
        }
    }
    catch { }
}
function initAuto() {
    if (typeof window === 'undefined' || typeof document === 'undefined')
        return { stop() { } };
    const cfg = getConfig();
    let lastScore = 0;
    const cookieDays = typeof cfg.cookieDays === 'number' ? cfg.cookieDays : undefined;
    const runDetection = () => {
        const h = basicHeuristic();
        const artifacts = detectAutomationArtifacts();
        let score = h.score + (artifacts.hit ? 0.6 : 0);
        if (artifacts.hit) {
            // Cap to 1
            score = Math.min(1, score);
        }
        const threshold = typeof cfg.threshold === 'number' ? cfg.threshold : (cfg.strict ? 0.5 : 0.6);
        const isBot = score >= threshold;
        const value = isBot ? 'true' : 'false';
        setCookie('isbot', value, cookieDays);
        lastScore = score;
        // Async tighten based on early permission denials
        asyncTightenIfNeeded(score);
        if (cfg.debug && typeof console !== 'undefined') {
            try {
                console.debug('[bot-detection] score=', score.toFixed(3), 'threshold=', threshold, 'reasons=', h.reasons.concat(artifacts.reasons || []));
            }
            catch { }
        }
        return value;
    };
    let lastSetValue = runDetection();
    // Light interaction sampling (~2s) to downgrade to human if activity is seen
    let mouseMoves = 0, keyPresses = 0, touchEvents = 0;
    const onMove = () => (mouseMoves++);
    const onKey = () => (keyPresses++);
    const onTouch = () => (touchEvents++);
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('keydown', onKey, { passive: true });
    window.addEventListener('touchstart', onTouch, { passive: true });
    const waitMs = 2200;
    const timer = window.setTimeout(() => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('touchstart', onTouch);
        const interacted = mouseMoves > 0 || keyPresses > 0 || touchEvents > 0;
        const strongSuspect = lastScore >= (cfg.strict ? 0.75 : 0.85);
        // For strong suspicion, require more convincing interaction to flip
        const strongInteraction = mouseMoves >= (cfg.strict ? 10 : 5) || keyPresses >= (cfg.strict ? 3 : 2) || touchEvents >= 1;
        if (interacted && (!strongSuspect || strongInteraction)) {
            // Interaction suggests a human
            setCookie('isbot', 'false', cookieDays);
            lastSetValue = 'false';
        }
    }, document.hidden ? waitMs + 800 : waitMs);
    const refreshMsRaw = typeof cfg.refreshMs === 'number' ? cfg.refreshMs : 30000;
    const refreshMs = refreshMsRaw > 0 ? refreshMsRaw : 0;
    const refreshTimer = refreshMs ? window.setInterval(() => {
        try {
            const current = getCookie('isbot');
            if (current !== lastSetValue) {
                lastSetValue = runDetection();
            }
            else {
                // Refresh the expiry so manual deletions or stale cookies get corrected quickly
                setCookie('isbot', lastSetValue, cookieDays);
            }
        }
        catch { }
    }, refreshMs) : undefined;
    return { stop() { try {
            clearTimeout(timer);
        }
        catch { } try {
            if (refreshTimer)
                clearInterval(refreshTimer);
        }
        catch { } } };
}
// Auto-run
try {
    initAuto();
}
catch { }
