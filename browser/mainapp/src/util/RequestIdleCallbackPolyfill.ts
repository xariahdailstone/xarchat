import { enterDelayingBlock } from "./DelayCodeUtils";

let cbx: number | null = null;

type RegisteredIdleCallback = { number: number, callback: () => any };
const registeredIdleCallbacks: RegisteredIdleCallback[] = [];
const regCallbacksByNumber: Map<number, RegisteredIdleCallback> = new Map();

function invokeIdleCallbacks() {
    enterDelayingBlock(() => {
        while (registeredIdleCallbacks.length > 0) {
            const ic = registeredIdleCallbacks.shift()!;
            try {
                if (regCallbacksByNumber.has(ic.number)) {
                    regCallbacksByNumber.delete(ic.number);
                        ic.callback();
                }
            }
            catch { }
        }
    });
}

let nextNum: number = 1;
let polyfilled = false;
export function polyfillRequestIdleCallback() {
    if (!polyfilled) {
        polyfilled = true;

        let requestFunc: (callback: () => any) => number;
        if (typeof window.requestIdleCallback == "function") {
            const origRIC = window.requestIdleCallback;
            requestFunc = h => {
                const res = origRIC(h);
                window.requestAnimationFrame(h);
                return res;
            };
        }
        else {
            requestFunc = h => {
                return window.requestAnimationFrame(h);
            };
        }

        (window as any).requestIdleCallback = (cb: () => any) => {
            const myNum = nextNum++;
            const rc = { callback: cb, number: myNum };
            registeredIdleCallbacks.push(rc);
            regCallbacksByNumber.set(myNum, rc);
            if (cbx == null) {
                cbx = requestFunc(() => {
                    cbx = null;
                    invokeIdleCallbacks();
                });
            }
            return myNum;
        };
        (window as any).cancelIdleCallback = (handle: number) => {
            regCallbacksByNumber.delete(handle);
        };
    }
}