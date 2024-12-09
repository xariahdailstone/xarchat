
export class Logging {
    public static createLogger(source: string): Logger {
        return new ConsoleLogger(source);
    }
}

export interface Logger {
    enterScope(name: string): void;
    leaveScope(): void;

    logDebug(...args: any[]): void;
    logInfo(...args: any[]): void;
    logWarn(...args: any[]): void;
    logError(...args: any[]): void;
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