import { CallbackSet } from "./CallbackSet";
import { asDisposable, IDisposable } from "./Disposable";
import { Scheduler } from "./Scheduler";

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
        let myTimeoutHandle: IDisposable | null = null;
        const wrappedReleaseFunc = () => {
            this._releasableItems.delete(myKey);
            if (myTimeoutHandle) {
                const mth = myTimeoutHandle;
                myTimeoutHandle = null;
                Scheduler.scheduleNamedCallback("HeldCacheManagerImpl.addReleasableItem", ["idle", 250], () => {
                    mth.dispose();
                })
            }
            try {
                releaseFunc();
            }
            catch { }
        };

        this._releasableItems.set(myKey, wrappedReleaseFunc);
        myTimeoutHandle = Scheduler.scheduleNamedCallback("HeldCacheManager.myTimeoutHandle", releaseAfterMs, () => {
            if (myTimeoutHandle != null) {
                myTimeoutHandle = null;
                wrappedReleaseFunc();
            }
        });

        return asDisposable(() => {
            this._releasableItems.delete(myKey);
            if (myTimeoutHandle) {
                const mth = myTimeoutHandle;
                myTimeoutHandle = null;
                Scheduler.scheduleNamedCallback("HeldCacheManagerImpl.addReleasableItem.ret", ["idle", 250], () => {
                    mth.dispose();
                });
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