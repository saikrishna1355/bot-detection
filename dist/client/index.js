"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectFingerprint = void 0;
exports.initClient = initClient;
exports.sendTelemetry = sendTelemetry;
const sensor_1 = require("./sensor");
function initClient(options = {}) {
    const { sampleMs = 2000, onUpdate } = options;
    const start = Date.now();
    const stop = (0, sensor_1.collectFingerprint)({
        intervalMs: sampleMs,
        onUpdate: (fp) => {
            fp.timestamps = { start, now: Date.now() };
            if (onUpdate)
                onUpdate(fp);
        },
    });
    return { stop };
}
async function sendTelemetry(url, data) {
    try {
        const payload = JSON.stringify(data);
        if ('sendBeacon' in navigator) {
            const blob = new Blob([payload], { type: 'application/json' });
            navigator.sendBeacon(url, blob);
            return { ok: true };
        }
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            keepalive: true,
            body: payload,
        });
        return { ok: res.ok };
    }
    catch (e) {
        return { ok: false };
    }
}
var sensor_2 = require("./sensor");
Object.defineProperty(exports, "collectFingerprint", { enumerable: true, get: function () { return sensor_2.collectFingerprint; } });
