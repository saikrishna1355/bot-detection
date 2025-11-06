import type { ClientFingerprint } from '../types';

type Options = {
  intervalMs?: number;
  onUpdate?: (fp: ClientFingerprint) => void;
};

export function collectFingerprint(opts: Options = {}) {
  const { intervalMs = 2000, onUpdate } = opts;

  let mouseMoves = 0;
  let keyPresses = 0;
  let touchEvents = 0;
  let totalMouseDistance = 0;
  let lastMouse: { x: number; y: number } | null = null;
  const start = Date.now();

  const onMouseMove = (e: MouseEvent) => {
    mouseMoves++;
    if (lastMouse) {
      const dx = e.clientX - lastMouse.x;
      const dy = e.clientY - lastMouse.y;
      totalMouseDistance += Math.hypot(dx, dy);
    }
    lastMouse = { x: e.clientX, y: e.clientY };
  };
  const onKey = () => (keyPresses++);
  const onTouch = () => (touchEvents++);

  window.addEventListener('mousemove', onMouseMove, { passive: true });
  window.addEventListener('keydown', onKey, { passive: true });
  window.addEventListener('touchstart', onTouch, { passive: true });

  const getUA = () => navigator.userAgent || '';
  const getLangs = () => (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]).filter(Boolean) as string[];
  const getTZ = () => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return undefined; }
  };
  const getScreen = () => ({ width: screen.width, height: screen.height, colorDepth: (screen as any).colorDepth });
  const getDPR = () => (window.devicePixelRatio || 1);

  const getCanvasHash = () => {
    try {
      const c = document.createElement('canvas');
      c.width = 200; c.height = 50;
      const ctx = c.getContext('2d');
      if (!ctx) return undefined;
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(0, 0, 200, 50);
      ctx.fillStyle = '#069';
      ctx.fillText('bot-detect-fp', 2, 2);
      const data = c.toDataURL();
      let hash = 0;
      for (let i = 0; i < data.length; i++) {
        hash = (hash << 5) - hash + data.charCodeAt(i);
        hash |= 0;
      }
      return String(hash >>> 0);
    } catch { return undefined; }
  };

  const getWebGLVendorRenderer = () => {
    try {
      const canvas = document.createElement('canvas');
      const gl: any = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) return undefined;
      const dbgInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (!dbgInfo) return undefined;
      const vendor = gl.getParameter(dbgInfo.UNMASKED_VENDOR_WEBGL);
      const renderer = gl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL);
      return { vendor: String(vendor), renderer: String(renderer) };
    } catch { return undefined; }
  };

  const headlessSignals = /HeadlessChrome|PhantomJS|Puppeteer|Playwright|jsdom|Electron|node\.js/i.test(getUA());
  const jsEnabled = true; // If this code runs, JS is enabled

  const interval = window.setInterval(() => {
    const now = Date.now();
    const elapsed = Math.max(1, now - start);
    const avgMouseSpeed = mouseMoves ? totalMouseDistance / mouseMoves : 0;
    const fp: ClientFingerprint = {
      userAgent: getUA(),
      languages: getLangs(),
      timezone: getTZ(),
      screen: getScreen(),
      devicePixelRatio: getDPR(),
      webgl: getWebGLVendorRenderer(),
      canvasHash: getCanvasHash(),
      jsEnabled,
      interactions: {
        mouseMoves,
        keyPresses,
        touchEvents,
        avgMouseSpeed,
        timeOnPageMs: elapsed,
      },
      timestamps: { start, now },
    };
    // Add heuristic signal: if headless UA found, we can surface via reasons on server; here it's just captured via UA
    onUpdate?.(fp);
  }, intervalMs);

  return function stop() {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('touchstart', onTouch);
    window.clearInterval(interval);
  };
}

