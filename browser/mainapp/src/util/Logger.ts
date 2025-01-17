
export class Logging {
    public static createLogger(source: string): Logger {
        return new ConsoleLogger(source);
    }
}

export interface Logger {
    enterScope(name: string): void;
    leaveScope(): void;

    log(logLevel: LogLevel, message: string, ...args: any[]): void;
    logDebug(message: string, ...args: any[]): void;
    logInfo(message: string, ...args: any[]): void;
    logWarn(message: string, ...args: any[]): void;
    logError(message: string, ...args: any[]): void;
}

class ConsoleLogger implements Logger {
    constructor(
        private readonly source: string) {
    }

    private readonly _scopes: string[] = [];

    enterScope(name: string): void {
        this._scopes.push(`<${name}>`);
    }
    leaveScope(): void {
        this._scopes.pop();
    }

    log(logLevel: LogLevel, message: string, ...args: any[]): void {
        switch (logLevel) {
            case LogLevel.VERBOSE:
            case LogLevel.DEBUG:
                this.logDebug(message, ...args);
                break;
            case LogLevel.INFO:
                this.logInfo(message, ...args);
                break;
            case LogLevel.WARN:
                this.logWarn(message, ...args);
                break;
            default:
            case LogLevel.ERROR:
            case LogLevel.CATASTROPHIC:
                this.logError(message, ...args);
                break;
        }
    }
    logDebug(...args: any[]): void {
        console.debug(`[${this.source}]`, ...this._scopes, ...args);
    }
    logInfo(...args: any[]): void {
        console.info(`[${this.source}]`, ...this._scopes, ...args);
    }
    logWarn(...args: any[]): void {
        console.warn(`[${this.source}]`, ...this._scopes, ...args);
    }
    logError(...args: any[]): void {
        console.error(`[${this.source}]`, ...this._scopes, ...args);
    }
}

export enum LogLevel {
    VERBOSE = 0,
    DEBUG = 1,
    INFO = 2,
    WARN = 3,
    ERROR = 4,
    CATASTROPHIC = 5
}