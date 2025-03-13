import { ConstructorOf } from "../components/dialogs/DialogFrame";

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

class NamedDisposable implements IDisposable {
    constructor(...funcs: ConvertibleToDisposable[]) {
        // const cfuncs: ConvertibleToDisposable[] = [];
        // const addDisposable = (f: ConvertibleToDisposable) => {
        //     if (f instanceof NamedDisposable) {
        //         for (let sf of f._funcs) {
        //             addDisposable(sf);
        //         }
        //     }
        //     else {
        //         cfuncs.push(f);
        //     }
        // };
        // for (let f of funcs) {
        //     addDisposable(f);
        // }
        // this._funcs = cfuncs;
        this._funcs = funcs;
    }

    private readonly _funcs: ConvertibleToDisposable[];
    private _disposed = false;

    get isDisposed() { return this._disposed; }

    dispose() {
        if (!this._disposed) {
            this._disposed = true;
            for (var f of this._funcs) {
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

    [Symbol.dispose]() {
        this.dispose();
    }
}

type DisposableRef<T extends IDisposable> = { disposable: T | null };
const disposableOwnerFieldCleanup = new FinalizationRegistry<DisposableRef<any>>(hv => {
    if (hv.disposable) {
        try { hv.disposable.dispose(); }
        catch { }
    }
});
export class DisposableOwnerField<T extends IDisposable = IDisposable> implements IDisposable {
    constructor() {
        disposableOwnerFieldCleanup.register(this, this._disposableRef, this._disposableRef);
    }

    private readonly _disposableRef: DisposableRef<T> = { disposable: null };
    private _isDisposed = false;

    get isDisposed() { return this._isDisposed; }
    dispose() {
        if (!this._isDisposed) {
            this._isDisposed = true;
            disposableOwnerFieldCleanup.unregister(this._disposableRef);
            this.value = null;
        }
    }
    [Symbol.dispose]() {
        this.dispose();
    }

    get value(): T | null { return this._disposableRef.disposable; }
    set value(v: T | null) {
        if (v !== this._disposableRef.disposable) {
            if (this._disposableRef.disposable) {
                const d = this._disposableRef.disposable;
                this._disposableRef.disposable = null;
                try { d.dispose(); }
                catch { }
            }
            if (this._isDisposed && v) {
                if (v) {
                    try { v.dispose(); }
                    catch { }
                }
            }
            else {
                this._disposableRef.disposable = v;
            }
        }
    }
}

const namedDisposableClasses: Map<string, ConstructorOf<NamedDisposable>> = new Map();
function getNamedDisposableClass(name: string): ConstructorOf<NamedDisposable> {
    let c = namedDisposableClasses.get(name);
    if (!c) {
        c = ({[name] : class extends NamedDisposable {}})[name];
        //c = eval(`(function() { class ${name} extends NamedDisposable {}; return ${name}; })()`) as ConstructorOf<NamedDisposable>;
        namedDisposableClasses.set(name, c);
    }
    return c;
}
export function asNamedDisposable(name: string, ...funcs: ConvertibleToDisposable[]): (IDisposable & Disposable) {
    const c = getNamedDisposableClass(name);
    return new c(...funcs);
}
(window as any)["__asNamedDisposable"] = asNamedDisposable;

export function asDisposable(...funcs: ConvertibleToDisposable[]): (IDisposable & Disposable) {
    funcs = funcs.filter(f => f != EmptyDisposable);
    if (funcs.length == 0) { return EmptyDisposable; }
    return new NamedDisposable(...funcs);
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