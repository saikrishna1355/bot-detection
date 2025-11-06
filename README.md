# bot-detection

Client and server bot detection utilities with Express middleware, simple heuristics, and an optional ML scoring hook.

## Features

- Client: user-agent checks, interaction tracking (mouse/keyboard/touch), JS execution proof, timezone, screen, DPR, WebGL vendor/renderer, Canvas hash.
- Server: Express middleware for heuristic checks (missing headers, headless UA, no interaction), simple rate check, session storage (in-memory), and telemetry endpoint.
- Optional ML: Pluggable prediction (default tiny logistic regression) using features such as mouse speed/counts, screen, DPR, timezone, JS enablement.

## Install

```
npm install bot-detection
```

## Quick Start

- Client (bundled app)

```ts
import { initClient, sendTelemetry } from "bot-detection/client";

const { stop } = initClient({
  sampleMs: 2000,
  onUpdate(fp) {
    // Ship signals to your backend for scoring
    sendTelemetry("/_bot/telemetry", fp);
  },
});
```

- Server (Express)

```ts
import express from "express";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import { server as bot } from "@your-scope/bot-detection";

const app = express();
app.use(cookieParser());
app.use(bodyParser.json());

const { middleware, router } = bot.createBotDetector({
  telemetryPath: "/_bot/telemetry",
  ml: { enabled: true },
});
app.use(middleware);
app.post("/_bot/telemetry", router);
```

## Test environment

- Build and run unit tests (Node built-in runner):

```
npm test
```

- Demo Express app:
  - Build the package: `npm run build`
  - Install demo deps: `cd examples/express-demo && npm install`
  - Run the demo: `node ../express-demo/server.js` (from repo root: `npm run demo`)
  - Open `http://localhost:3000` and interact with the page

## Publishing to npm

1. Set the package name

- Update `name` in `package.json` to your real scope (e.g., `"@acme/bot-detection"`) or unscoped name (e.g., `"bot-detection"`).

2. Build the package

```
npm run build
```

3. Login and publish

```
npm login
# For scoped packages publish publicly
npm publish --access public
# For unscoped packages
# npm publish
```

4. Versioning

- Use `npm version patch|minor|major` to bump versions before publishing.

After publishing, consumers can install and use:

```
npm install @your-scope/bot-detection
```

## React: one‑liner auto install

- Add this import once in your app layout (Vite/CRA/Next client component):

```ts
import 'bot-detection/auto';
```

- Optional: configure before import (telemetry URL, header name, sample rate):

```ts
// e.g., src/bot-detect.ts (import this early, like in your root layout)
;(window as any).__BOT_DETECTION__ = {
  telemetryUrl: '/_bot/telemetry', // your backend endpoint
  sampleMs: 2000,
  attachFetch: true,
  attachXHR: false,
  headerName: 'x-bot-features',
};
import 'bot-detection/auto';
```

- What it does automatically:
  - Starts client fingerprint + interaction tracking.
  - Sends telemetry every `sampleMs` to `telemetryUrl`.
  - Attaches a base64 telemetry header to all same‑origin `fetch` calls (`x-bot-features`).

Notes for Next.js
- App Router: create a small `use client` component added to `app/layout.tsx` and import `'bot-detection/auto'` inside it.
- Pages Router: import `'bot-detection/auto'` in `pages/_app.tsx`.

## Client usage

```ts
import { initClient, sendTelemetry } from "@your-scope/bot-detection/client";

// Start collecting fingerprint + interactions and periodically update
const { stop } = initClient({
  sampleMs: 2000,
  onUpdate(fp) {
    // Optionally send to server endpoint
    sendTelemetry("/_bot/telemetry", fp);
  },
});

// Call stop() to remove listeners
```

If you prefer to control sending, you can call `collectFingerprint` and send data yourself.

## Server usage (Express)

```ts
import express from "express";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import { server as bot } from "@your-scope/bot-detection";

const app = express();
app.use(cookieParser());
app.use(bodyParser.json({ limit: "50kb" }));

const { middleware, router } = bot.createBotDetector({
  telemetryPath: "/_bot/telemetry",
  rateLimit: { windowMs: 60_000, max: 120 },
  ml: { enabled: true },
});

app.use(middleware);
app.post("/_bot/telemetry", router); // or: app.use(router) and ensure body json parser runs before

app.get("/protected", (req, res) => {
  const result = (req as any).botDetection;
  if (result?.isBot) return res.status(403).send("Bots not allowed");
  res.send("Hello human");
});

app.listen(3000);
```

### Sending features via header instead of body

You can also pass client features in a base64-encoded JSON header and the middleware will consume it:

```ts
// client side
import { collectFingerprint } from "@your-scope/bot-detection/client";
const stop = collectFingerprint({
  onUpdate(fp) {
    const hdr = btoa(JSON.stringify(fp));
    fetch("/protected", { headers: { "x-bot-features": hdr } });
  },
});
```

## Heuristics

- Missing headers: `user-agent`, `accept`, `accept-language` increase risk.
- Headless UA keywords trigger higher risk.
- No interaction over time suggests automation.
- Rate limiting: excessive requests per IP/UA within a window increases risk.

## ML hook

You can inject your own model:

```ts
import { server as bot } from "@your-scope/bot-detection";

const { middleware } = bot.createBotDetector({
  ml: {
    enabled: true,
    predict: (features) => {
      // return { score: 0..1, label: 'bot' | 'human' }
      return { score: Math.random(), label: "human" };
    },
  },
});
```

## Types

All relevant types are exported from the package root.

## Notes

- The in-memory session store is suitable for single-instance demos. Use a distributed store for production.
- The default ML is intentionally simple and acts as a placeholder.
- For best results, mount `cookie-parser` and `body-parser` before the middleware/router.
