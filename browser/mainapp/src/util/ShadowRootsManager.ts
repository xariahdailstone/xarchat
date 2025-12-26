import { ContextMenuUtils } from "./ContextMenuUtils";
import { asDisposable, IDisposable } from "./Disposable";

export interface ISupportsConnectDisconnectRegistration {
    addConnectDisconnectHandler(callback: () => void): IDisposable;
    removeConnectDisconnectHandler(callback: () => void): void;
}

class ShadowRootsManagerImpl {

    private readonly SYM_TRACKINGKEY = Symbol();
    private readonly _sroots: Map<object, WeakRef<ShadowRoot>> = new Map();

    elementAttachShadow(el: (HTMLElement & ISupportsConnectDisconnectRegistration), options: ShadowRootInit): ShadowRoot {
        const sroot = el.attachShadow(options);

        ContextMenuUtils.addShadowRootHandler(sroot);

        let currentRegisteredHandler: (IDisposable | null) = null;
        el.addConnectDisconnectHandler(() => {
            if (el.isConnected) {
                if (!currentRegisteredHandler) {
                    currentRegisteredHandler = this.addShadowRoot(sroot);
                }
            }
            else {
                if (currentRegisteredHandler) {
                    currentRegisteredHandler.dispose();
                    currentRegisteredHandler = null;
                }
            }
        });

        return sroot;
    }

    addShadowRoot(sroot: ShadowRoot): IDisposable {
        const myKey = {};
        const rootWR = new WeakRef<ShadowRoot>(sroot);
        (sroot as any)[this.SYM_TRACKINGKEY] = myKey;
        
        this._sroots.set(myKey, rootWR);

        return asDisposable(() => {
            this.removeShadowRoot(sroot);
        });
    }

    removeShadowRoot(sroot: ShadowRoot) {
        const tk = (sroot as any)[this.SYM_TRACKINGKEY];
        if (tk) {
            delete (sroot as any)[this.SYM_TRACKINGKEY];
            this._sroots.delete(tk);
        }
    }

    getRegisteredShadowRoots() {
        const result: ShadowRoot[] = [];
        for (let wr of this._sroots.values()) {
            const sroot = wr.deref();
            if (sroot) {
                result.push(sroot);
            }
            else {
                // TODO: log warning
            }
        }
        return result;
    }
}

export const ShadowRootsManager = new ShadowRootsManagerImpl();
(window as any)["__ShadowRootsManager"] = ShadowRootsManager;