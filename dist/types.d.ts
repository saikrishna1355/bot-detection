export type ClientFingerprint = {
    userAgent: string;
    languages: string[];
    timezone?: string;
    screen?: {
        width: number;
        height: number;
        colorDepth?: number;
    };
    devicePixelRatio?: number;
    webgl?: {
        vendor?: string;
        renderer?: string;
    };
    canvasHash?: string;
    jsEnabled: boolean;
    interactions: {
        mouseMoves: number;
        keyPresses: number;
        touchEvents: number;
        avgMouseSpeed?: number;
        timeOnPageMs?: number;
    };
    timestamps?: {
        start: number;
        now: number;
    };
};
export type HeuristicResult = {
    score: number;
    reasons: string[];
};
export type MLScore = {
    score: number;
    label: 'bot' | 'human';
};
export type FeatureVector = {
    mouseMoves: number;
    keyPresses: number;
    touchEvents: number;
    avgMouseSpeed: number;
    screenWidth: number;
    screenHeight: number;
    devicePixelRatio: number;
    timezonePresent: number;
    jsEnabled: number;
};
export type SessionInfo = {
    id: string;
    ip: string;
    ua: string;
    createdAt: number;
    lastSeen: number;
    requestCount: number;
    heuristic?: HeuristicResult;
    ml?: MLScore;
};
export type BotDetectionResult = {
    isBot: boolean;
    score: number;
    heuristic: HeuristicResult;
    ml?: MLScore;
    sessionId?: string;
};
export type MiddlewareOptions = {
    headerName?: string;
    sessionCookieName?: string;
    sessionTtlMs?: number;
    rateLimit?: {
        windowMs: number;
        max: number;
    };
    ml?: {
        enabled: boolean;
        predict?: (features: FeatureVector) => MLScore;
    };
    telemetryPath?: string;
};
