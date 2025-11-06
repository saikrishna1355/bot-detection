import type { FeatureVector, MLScore } from '../types';

// Very small logistic regression as a default; weights are heuristic only
const DEFAULT_WEIGHTS: Record<keyof FeatureVector, number> = {
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

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export function defaultPredict(features: FeatureVector): MLScore {
  let z = BIAS;
  for (const k of Object.keys(DEFAULT_WEIGHTS) as (keyof FeatureVector)[]) {
    z += (features[k] || 0) * (DEFAULT_WEIGHTS[k] || 0);
  }
  const score = sigmoid(z);
  return { score, label: score > 0.5 ? 'bot' : 'human' };
}

export function toFeatures(sample: {
  interactions: { mouseMoves: number; keyPresses: number; touchEvents: number; avgMouseSpeed?: number };
  screen?: { width: number; height: number };
  devicePixelRatio?: number;
  timezone?: string;
  jsEnabled: boolean;
}): FeatureVector {
  return {
    mouseMoves: sample.interactions.mouseMoves || 0,
    keyPresses: sample.interactions.keyPresses || 0,
    touchEvents: sample.interactions.touchEvents || 0,
    avgMouseSpeed: sample.interactions.avgMouseSpeed || 0,
    screenWidth: sample.screen?.width || 0,
    screenHeight: sample.screen?.height || 0,
    devicePixelRatio: sample.devicePixelRatio || 1,
    timezonePresent: sample.timezone ? 1 : 0,
    jsEnabled: sample.jsEnabled ? 1 : 0,
  };
}

