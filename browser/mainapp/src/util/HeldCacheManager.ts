import { asDisposable, IDisposable } from "./Disposable";

export interface HeldCacheManager {
    addReleasableItem(
        releaseFunc: () => any,
        releaseAfterMs: number
    ): IDisposable;

    releaseAll(): void;
}

class HeldCacheManagerImpl implements HeldCacheManager {
    private readonly _releasableItems: Map<object, () => any> = new Map();

    addReleasableItem(releaseFunc: () => any, releaseAfterMs: number): IDisposable {
        const myKey = {};
        let myTimeoutHandle: number | null = null;
        const wrappedReleaseFunc = () => {
            this._releasableItems.delete(myKey);
            if (myTimeoutHandle) {
                window.clearTimeout(myTimeoutHandle);
                myTimeoutHandle = null;
            }
            try {
                releaseFunc();
            }
            catch { }
        };

        this._releasableItems.set(myKey, wrappedReleaseFunc);
        myTimeoutHandle = window.setTimeout(() => {
            myTimeoutHandle = null;
            wrappedReleaseFunc();
        }, releaseAfterMs);

        return asDisposable(() => {
            this._releasableItems.delete(myKey);
            if (myTimeoutHandle) {
                window.clearTimeout(myTimeoutHandle);
                myTimeoutHandle = null;
            }
        });
    }

    releaseAll(): void {
        for (let k of [...this._releasableItems.values()]) {
            k();
        }
    }
}

export const HeldCacheManager = new HeldCacheManagerImpl();
(window as any)["__heldcachemanager"] = HeldCacheManager;