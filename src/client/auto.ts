// Minimal, zero-config bot detection that sets a cookie `isbot`
// to 'true' or 'false'. Importing this file runs detection automatically.

function setCookie(name: string, value: string, days = 7) {
  try {
    const d = new Date();
    d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${value}; expires=${d.toUTCString()}; path=/; samesite=lax`;
  } catch {}
}

function getUA() { try { return navigator.userAgent || ''; } catch { return ''; } }

function getWebGLInfo(): { vendor?: string; renderer?: string } | undefined {
  try {
    const c = document.createElement('canvas');
    const gl: any = (c.getContext('webgl') || c.getContext('experimental-webgl')) as any;
    if (!gl) return undefined;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (!dbg) return undefined;
    return {
      vendor: String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)),
      renderer: String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)),
    };
  } catch { return undefined; }
}

function basicHeuristic(): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const ua = getUA();
  if (/HeadlessChrome|PhantomJS|Puppeteer|Playwright|bot|crawler|spider|curl|wget/i.test(ua)) { score += 0.7; reasons.push('ua'); }
  if (/Playwright/i.test(ua)) { score += 0.5; reasons.push('playwright-ua'); }
  try { if ((navigator as any).webdriver) { score += 0.6; reasons.push('webdriver'); } } catch {}
  try { const langs = (navigator.languages || []).length; if (!langs) { score += 0.2; reasons.push('nolangs'); } } catch {}
  try { const plugins = (navigator as any).plugins?.length ?? 0; if (plugins === 0) { score += 0.2; reasons.push('noplugins'); } } catch {}

  // Extra lightweight signals (kept small to avoid false positives)
  try {
    const isMobileUA = /Mobile|Android|iPhone|iPad|iPod/i.test(ua);
    const mtp = (navigator as any).maxTouchPoints ?? 0;
    if (isMobileUA && mtp === 0) { score += 0.15; reasons.push('touch-mismatch'); }
  } catch {}
  try {
    const hc = (navigator as any).hardwareConcurrency;
    if (typeof hc === 'number' && hc <= 1) { score += 0.1; reasons.push('low-cores'); }
  } catch {}
  try {
    // Chrome UA without window.chrome is uncommon in real Chrome
    const looksChrome = /Chrome\//.test(ua) && !/Edg\//.test(ua) && !/OPR\//.test(ua);
    const hasWindowChrome = typeof (window as any).chrome !== 'undefined';
    if (looksChrome && !hasWindowChrome) { score += 0.15; reasons.push('no-window-chrome'); }
    const plugins = (navigator as any).plugins?.length ?? 0;
    if (looksChrome && plugins === 0) { score += 0.15; reasons.push('chrome-noplugins'); }
    const langs = (navigator.languages || []).length || 0;
    if (looksChrome && langs === 0) { score += 0.1; reasons.push('chrome-nolangs'); }
  } catch {}
  try {
    const dpr = (window as any).devicePixelRatio || 1;
    const sw = (window as any).screen?.width || 0;
    // Very large width with DPR=1 is sometimes headless; keep impact tiny
    if (dpr === 1 && sw >= 1920) { score += 0.05; reasons.push('dpr1-large-screen'); }
  } catch {}
  try {
    const info = getWebGLInfo();
    const r = (info?.renderer || '').toLowerCase();
    if (r.includes('swiftshader')) { score += 0.25; reasons.push('webgl-swiftshader'); }
  } catch {}
  return { score: Math.min(1, score), reasons };
}

function detectAutomationArtifacts(): { hit: boolean; reasons: string[] } {
  const reasons: string[] = [];
  try {
    const w = window as any;
    const suspectKeys = [
      '__webdriver_evaluate', '__driver_evaluate', '__selenium_evaluate',
      '__webdriver_script_function', '__webdriver_script_fn', '__fxdriver_unwrapped',
      '__lastWatirAlert', '__lastWatirConfirm', '__lastWatirPrompt'
    ];
    for (const k of suspectKeys) {
      if (k in w) { reasons.push(`artifact:${k}`); }
    }
    // Common Selenium/Chromedriver key prefix
    for (const k in w) {
      if (/^\$cdc_/.test(k)) { reasons.push('artifact:$cdc'); break; }
      if (/^\$chromeAsyncScriptInfo/.test(k)) { reasons.push('artifact:$chromeAsync'); break; }
    }
  } catch {}
  return { hit: reasons.length > 0, reasons };
}

async function asyncTightenIfNeeded(initialScore: number) {
  try {
    const perms = (navigator as any).permissions;
    if (!perms || typeof perms.query !== 'function') return;
    const results: string[] = [];
    try { const r = await perms.query({ name: 'notifications' as any }); results.push(r.state); } catch {}
    try { const r = await perms.query({ name: 'clipboard-read' as any }); results.push(r.state); } catch {}
    const deniedCount = results.filter(s => s === 'denied').length;
    if (deniedCount >= 2 && initialScore >= 0.5) {
      // If multiple permissions are hard-denied very early and we already had moderate suspicion, mark as bot
      setCookie('isbot', 'true');
    }
  } catch {}
}

export function initAuto() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return { stop() {} };

  // Immediate heuristic
  const h = basicHeuristic();
  const artifacts = detectAutomationArtifacts();
  let score = h.score + (artifacts.hit ? 0.6 : 0);
  if (artifacts.hit) {
    // Cap to 1
    score = Math.min(1, score);
  }
  let isBot = score >= 0.6;
  setCookie('isbot', isBot ? 'true' : 'false');
  // Async tighten based on early permission denials
  asyncTightenIfNeeded(score);

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
    const strongSuspect = score >= 0.85;
    // For strong suspicion, require more convincing interaction to flip
    const strongInteraction = mouseMoves >= 5 || keyPresses >= 2 || touchEvents >= 1;
    if (interacted && (!strongSuspect || strongInteraction)) {
      // Interaction suggests a human
      setCookie('isbot', 'false');
    }
  }, document.hidden ? waitMs + 800 : waitMs);

  return { stop() { try { clearTimeout(timer); } catch {} } };
}

// Auto-run
try { initAuto(); } catch {}
