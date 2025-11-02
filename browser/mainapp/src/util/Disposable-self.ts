import { tryDispose } from "./Disposable";

const SYM_UNDERLYINGOBJ = Symbol("disposeOnFinalize.underlyingObject");
const SYM_IDENTITYOBJ = Symbol("disposeOnFinalize.identityObject");

const selfDisposeFR = new FinalizationRegistry<any>(obj => {
    //console.log("####### performing self-dispose", obj);
     tryDispose(obj);
});

export function withDisposeOnFinalize<T extends object>(obj: T): T {
    if ((obj as any)[SYM_UNDERLYINGOBJ]) {
        return obj;
    }

    let identityObj: (object | null) = {};

    const result = new Proxy(obj, {
        get: (target, p, receiver) => {
            identityObj;
            const result = (target as any)[p];
            return result;
        },
        set: (target, p, newValue, receiver) => {
            identityObj;
            (target as any)[p] = newValue;
            return true;
        }
    });
    selfDisposeFR.register(identityObj, obj);
    return result;
}