type AutoOptions = {
    telemetryUrl?: string;
    sampleMs?: number;
    attachFetch?: boolean;
    attachXHR?: boolean;
    headerName?: string;
};
export declare function initAuto(options?: AutoOptions): {
    stop(): void;
};
export {};
