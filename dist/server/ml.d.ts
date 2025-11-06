import type { FeatureVector, MLScore } from '../types';
export declare function defaultPredict(features: FeatureVector): MLScore;
export declare function toFeatures(sample: {
    interactions: {
        mouseMoves: number;
        keyPresses: number;
        touchEvents: number;
        avgMouseSpeed?: number;
    };
    screen?: {
        width: number;
        height: number;
    };
    devicePixelRatio?: number;
    timezone?: string;
    jsEnabled: boolean;
}): FeatureVector;
