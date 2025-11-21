# bot-detection

Zero‑config client bot detector. Import it once, and it sets a cookie `isbot` to `true` (bot) or `false` (human). No server, no telemetry, no configuration required.

## Features

- One‑liner: just import and it sets `isbot` cookie
- Heuristics: user agent headless/bot keywords, `navigator.webdriver`, empty languages/plugins
- Light interaction sampling (2s): if the user interacts, cookie flips to `false`

## Install

```
npm install bot-detection
```

## Usage (React, Vite, CRA, Next.js client component)

- Import once in your client entry or root layout:

```ts
import 'bot-detection/auto'; // sets document.cookie isbot=true|false
```

- Read the cookie anywhere:

```ts
function getCookie(name: string) {
  return document.cookie
    .split(';')
    .map(s => s.trim())
    .find(s => s.startsWith(name + '='))?.split('=')[1];
}

const isBot = getCookie('isbot') === 'true';
```

- Optional: stricter detection or debug logging (set before import):

```ts
;(window as any).__BOT_DETECTION__ = {
  // Lower the threshold and raise flip requirements
  strict: true,          // default false
  threshold: 0.5,        // default 0.6 (0..1)
  debug: true,           // logs score and reasons to console
};
import 'bot-detection/auto';
```

### React (CRA/Vite) placement
- CRA: add the import at the top of `src/index.tsx` or `src/index.jsx`.
- Vite: add the import at the top of `src/main.tsx` or `src/main.jsx`.
- It must run in the browser; do not import it in Node/server code.

### Next.js
- App Router (app/): create a tiny client component and include it in `app/layout.tsx`.

```tsx
// app/bot-detect-client.tsx
'use client'
import 'bot-detection/auto'
export default function BotDetectClient(){ return null }
```

```tsx
// app/layout.tsx
import BotDetectClient from './bot-detect-client'
export default function RootLayout({ children }){
  return (
    <html><body>
      <BotDetectClient />
      {children}
    </body></html>
  )
}
```

### Troubleshooting
- Not seeing the `isbot` cookie:
  - Ensure the import runs on the client (open DevTools Console and run `document.cookie`).
  - Disable strict privacy/extensions that block cookies for `localhost`.
  - The cookie is not HttpOnly; check DevTools → Application → Cookies.
  - Wait ~2 seconds after page load; interaction sampling may flip it to `false`.
- Seeing `POST /api/bot/telemetry 404` in your dev server:
  - That means you are using an older version of this package that sent telemetry.
  - Update to the latest version with zero telemetry: `npm i bot-detection@latest`.
  - Also remove any older setup that sets `window.__BOT_DETECTION__` or manually posts to `/api/bot/telemetry`.

## Notes

- Cookie name: `isbot`, value `'true' | 'false'`
- Detection runs immediately; after ~2 seconds, if user interacts (mouse/keys/touch), cookie is forced to `'false'`
- Import only on the client (e.g., within a Next.js client component)

### Limitations (and what we check)
- Heuristics are lightweight and can be bypassed by sophisticated bots.
- Legit environments (privacy modes) can trigger signals; we keep their weights small.
- Signals used:
  - User‑Agent headless/automation keywords
  - `navigator.webdriver`
  - Empty `navigator.languages` / `navigator.plugins`
  - UA mobile vs `maxTouchPoints` mismatch (small weight)
  - `hardwareConcurrency <= 1` (small weight)
  - Chrome UA without `window.chrome` (small weight)
  - `devicePixelRatio === 1` with very large width (tiny weight)
- Treat it as a quick client hint, not a sole security control.

### Why a proxied Chromium (e.g., via Burp) may read as human
- Proxies operate at the network layer; client‑side heuristics only see browser APIs and behavior.
- To treat such traffic as bots client‑side, enable `strict` and lower `threshold`, but expect more false positives.
- For robust proxy detection, add server‑side checks (TLS/JA3, header anomalies, IP reputation) in your app.
