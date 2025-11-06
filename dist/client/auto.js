"use strict";
// Minimal, zero-config bot detection that sets a cookie `isbot`
// to 'true' or 'false'. Importing this file runs detection automatically.
Object.defineProperty(exports, "__esModule", { value: true });
exports.initAuto = initAuto;
function setCookie(name, value, days = 7) {
    try {
        const d = new Date();
        d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
        document.cookie = `${name}=${value}; expires=${d.toUTCString()}; path=/; samesite=lax`;
    }
    catch { }
}
function getUA() { try {
    return navigator.userAgent || '';
}
catch {
    return '';
} }
function basicHeuristic() {
    var _a, _b;
    const reasons = [];
    let score = 0;
    const ua = getUA();
    if (/HeadlessChrome|PhantomJS|Puppeteer|Playwright|bot|crawler|spider|curl|wget/i.test(ua)) {
        score += 0.7;
        reasons.push('ua');
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
    return { score: Math.min(1, score), reasons };
}
function initAuto() {
    if (typeof window === 'undefined' || typeof document === 'undefined')
        return { stop() { } };
    // Immediate heuristic
    const h = basicHeuristic();
    let isBot = h.score >= 0.6;
    setCookie('isbot', isBot ? 'true' : 'false');
    // Light interaction sampling for 2s to downgrade bots to human if activity is seen
    let mouseMoves = 0, keyPresses = 0, touchEvents = 0;
    const onMove = () => (mouseMoves++);
    const onKey = () => (keyPresses++);
    const onTouch = () => (touchEvents++);
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('keydown', onKey, { passive: true });
    window.addEventListener('touchstart', onTouch, { passive: true });
    const timer = window.setTimeout(() => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('touchstart', onTouch);
        if (mouseMoves > 0 || keyPresses > 0 || touchEvents > 0) {
            // Interaction suggests a human
            setCookie('isbot', 'false');
        }
    }, 2000);
    return { stop() { try {
            clearTimeout(timer);
        }
        catch { } } };
}
// Auto-run
try {
    initAuto();
}
catch { }
