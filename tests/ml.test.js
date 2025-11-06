// Node built-in test runner; no external deps
const test = require('node:test');
const assert = require('node:assert/strict');

const { server } = require('../dist');

test('toFeatures produces expected defaults', () => {
  const fv = server.toFeatures({
    interactions: { mouseMoves: 0, keyPresses: 0, touchEvents: 0 },
    jsEnabled: true,
  });
  assert.equal(typeof fv.mouseMoves, 'number');
  assert.equal(fv.screenWidth, 0);
  assert.equal(fv.timezonePresent, 0);
  assert.equal(fv.jsEnabled, 1);
});

test('defaultPredict returns score and label', () => {
  const fv = server.toFeatures({
    interactions: { mouseMoves: 10, keyPresses: 5, touchEvents: 0, avgMouseSpeed: 2 },
    screen: { width: 1920, height: 1080 },
    devicePixelRatio: 2,
    timezone: 'UTC',
    jsEnabled: true,
  });
  const res = server.defaultPredict(fv);
  assert.ok(res.score >= 0 && res.score <= 1);
  assert.ok(res.label === 'bot' || res.label === 'human');
});

