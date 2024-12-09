
export interface IDisposable {
    dispose(): void;
    [Symbol.dispose](): void;
}

export const EmptyDisposable: (IDisposable & Disposable) = { 
    [Symbol.dispose]() {},
    dispose() {} 
};

function isIDisposable(obj: any) {
    return (typeof obj == "object"
         && typeof obj.dispose == "function");
}

function isDisposable(obj: any) {
    return (typeof obj == "object"
        && typeof obj[Symbol.dispose] == "function");
}

export function asDisposable(...funcs: ((() => void) | IDisposable | Disposable | null | undefined)[]): (IDisposable & Disposable) {
    let disposed = false;
    return {
        [Symbol.dispose]() {
            this.dispose();
        },
        dispose: () => {
            if (!disposed) {
                disposed = true;
                for (let f of funcs) {
                    try {
                        if (f == null) {
                        }
                        if (isIDisposable(f)) {
                            (f as IDisposable).dispose();
                        }
                        else if (isDisposable(f)) {
                            (f as Disposable)[Symbol.dispose]();
                        }
                        else {
                            (f as Function)();
                        }
                    }
                    catch { }
                }
            }
        }
    };
}

export function dispose(obj: any) {
    if (isIDisposable(obj)) {
        (obj as IDisposable).dispose();
    }
    else if (isDisposable(obj)) {
        (obj as Disposable)[Symbol.dispose]();
    }
}