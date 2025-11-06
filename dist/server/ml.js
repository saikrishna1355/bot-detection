"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultPredict = defaultPredict;
exports.toFeatures = toFeatures;
// Very small logistic regression as a default; weights are heuristic only
const DEFAULT_WEIGHTS = {
    mouseMoves: -0.002,
    keyPresses: -0.01,
    touchEvents: -0.02,
    avgMouseSpeed: 0.0005,
    screenWidth: 0.0001,
    screenHeight: 0.0001,
    devicePixelRatio: 0.05,
    timezonePresent: -0.2,
    jsEnabled: -0.6,
};
const BIAS = 0.2;
const sigmoid = (x) => 1 / (1 + Math.exp(-x));
function defaultPredict(features) {
    let z = BIAS;
    for (const k of Object.keys(DEFAULT_WEIGHTS)) {
        z += (features[k] || 0) * (DEFAULT_WEIGHTS[k] || 0);
    }
    const score = sigmoid(z);
    return { score, label: score > 0.5 ? 'bot' : 'human' };
}
function toFeatures(sample) {
    var _a, _b;
    return {
        mouseMoves: sample.interactions.mouseMoves || 0,
        keyPresses: sample.interactions.keyPresses || 0,
        touchEvents: sample.interactions.touchEvents || 0,
        avgMouseSpeed: sample.interactions.avgMouseSpeed || 0,
        screenWidth: ((_a = sample.screen) === null || _a === void 0 ? void 0 : _a.width) || 0,
        screenHeight: ((_b = sample.screen) === null || _b === void 0 ? void 0 : _b.height) || 0,
        devicePixelRatio: sample.devicePixelRatio || 1,
        timezonePresent: sample.timezone ? 1 : 0,
        jsEnabled: sample.jsEnabled ? 1 : 0,
    };
}
