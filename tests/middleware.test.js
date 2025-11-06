const test = require('node:test');
const assert = require('node:assert/strict');

const { server } = require('../dist');

function makeReqRes({ headers = {}, body = undefined, cookies = {} } = {}) {
  const req = {
    method: 'GET',
    path: '/test',
    headers,
    cookies,
    socket: { remoteAddress: '127.0.0.1' },
  };
  let statusCode = 200;
  const res = {
    status(code) { statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
    cookie() { /* no-op for tests */ },
    locals: {},
    get statusCode() { return statusCode; }
  };
  return { req, res };
}

test('middleware attaches botDetection result', (t, done) => {
  const { middleware } = server.createBotDetector({ ml: { enabled: false } });
  const { req, res } = makeReqRes({
    headers: {
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
      'accept': 'text/html',
      'accept-language': 'en-US,en;q=0.9',
      'sec-ch-ua': '"Chromium";v="118"',
    }
  });
  middleware(req, res, () => {
    assert.ok(req.botDetection);
    assert.equal(typeof req.botDetection.isBot, 'boolean');
    assert.equal(typeof req.botDetection.score, 'number');
    done();
  });
});

test('middleware flags missing headers', (t, done) => {
  const { middleware } = server.createBotDetector({ ml: { enabled: false } });
  const { req, res } = makeReqRes({ headers: { 'user-agent': 'curl/8.0' } });
  middleware(req, res, () => {
    const r = req.botDetection;
    assert.ok(r);
    assert.ok(r.heuristic.reasons.some(x => x.startsWith('missing:')));
    done();
  });
});

