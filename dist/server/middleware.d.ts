type Request = {
    headers: Record<string, any>;
    method: string;
    path: string;
    cookies?: Record<string, string>;
    socket: {
        remoteAddress?: string | null;
    };
    [key: string]: any;
};
type Response = {
    cookie?: (...args: any[]) => any;
    locals: any;
    [key: string]: any;
};
type NextFunction = () => void;
import type { BotDetectionResult, MiddlewareOptions } from '../types';
export declare function createBotDetector(options?: MiddlewareOptions): {
    middleware: (req: Request & {
        botDetection?: BotDetectionResult;
    }, res: Response, next: NextFunction) => void;
    router: (req: Request, res: Response, next: NextFunction) => any;
    cookieName: string;
    headerName: string;
    telemetryPath: string;
};
export {};
