
export interface IDisposable {
    dispose(): void;
    [Symbol.dispose](): void;
    readonly isDisposed: boolean;
}

export const EmptyDisposable: (IDisposable & Disposable) = { 
    [Symbol.dispose]() {},
    dispose() {},
    isDisposed: true
};

function isIDisposable(obj: any) {
    return (
        obj != null 
        && typeof obj == "object"
        && typeof obj.dispose == "function");
}

export function isDisposable(obj: any) {
    return (
        obj != null
        && typeof obj == "object"
        && typeof obj[Symbol.dispose] == "function");
}

export function maybeDispose(obj: any) {
    if (isDisposable(obj)) {
        (obj as Disposable)[Symbol.dispose]();
    }
    else if (isIDisposable(obj)) {
        (obj as IDisposable).dispose();
    }
}
export type ConvertibleToDisposable = ((() => void) | IDisposable | Disposable | null | undefined);

export function asDisposable(...funcs: ConvertibleToDisposable[]): (IDisposable & Disposable) {
    let disposed = false;
    return {
        [Symbol.dispose]() {
            this.dispose();
        },
        get isDisposed() {
            return disposed;
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

export function tryDispose(obj: any) {
    if (isIDisposable(obj)) {
        (obj as IDisposable).dispose();
    }
    else if (isDisposable(obj)) {
        (obj as Disposable)[Symbol.dispose]();
    }
}

const SYM_ONDISPOSESET = Symbol("onDisposeSet");
const SYM_ISDISPOSED = Symbol("isDisposed");
export function addOnDispose(obj: IDisposable, callback: () => any): IDisposable {
    if (obj.isDisposed) {
        try { callback(); }
        catch { }
        return EmptyDisposable;
    }
    let dset = (obj as any)[SYM_ONDISPOSESET] as ((Set<() => any>) | undefined);
    if (dset == null) {
        dset = new Set<() => any>();
        (obj as any)[SYM_ONDISPOSESET] = dset;

        const executeDSet = () => {
            const toExecute = [...dset!.values()];
            dset!.clear();
            for (let cb of toExecute) {
                try { cb(); }
                catch { }
            }
        };

        const origSymDispose = obj[Symbol.dispose];
        const origDispose = obj.dispose;

        (obj as any)[Symbol.dispose] = (...args: any[]) => {
            const shouldExecute = !obj.isDisposed;
            const result = origSymDispose.call(obj, ...args);
            if (shouldExecute) { executeDSet(); }
            return result;
        };
        (obj as any)["dispose"] = (...args: any[]) => {
            const shouldExecute = !obj.isDisposed;
            const result = origDispose.call(obj, ...args);
            if (shouldExecute) { executeDSet(); }
            return result;
        };
    }
    dset.add(callback);

    return asDisposable(() => {
        dset.delete(callback);
    });
}

export function disposeWithParent(parent: IDisposable, self: IDisposable) {
    addOnDispose(parent, () => { self.dispose(); });
}

const SYM_DISPOSEWITHTHISSET = Symbol("disposeWithThis set");
export function disposeWithThis(target: any, propertyKey: string, descriptor?: PropertyDescriptor) {
    if (!target[SYM_DISPOSEWITHTHISSET]) {
        const propSet = new Set<string>();
        target[SYM_DISPOSEWITHTHISSET] = propSet;

        const origDispose = target.dispose as Function;
        target.dispose = function (...args: any[]) {
            if (!this.isDisposed) {
                for (let prop of propSet.values()) {
                    const v = this[prop];
                    tryDispose(v);
                }
            }
            origDispose.call(this, ...args);
        };
    }

    (target[SYM_DISPOSEWITHTHISSET] as Set<string>).add(propertyKey);
}