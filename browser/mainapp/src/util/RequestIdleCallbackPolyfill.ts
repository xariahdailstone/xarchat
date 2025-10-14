import { h } from "../snabbdom/h";
import { enterDelayingBlock } from "./DelayCodeUtils";
import { IDisposable } from "./Disposable";
import { Scheduler } from "./Scheduler";

let polyfilled = false;
let nextIdleCallbackNumber: number = 1;
const idleCallbacksByNumber: Map<number, IDisposable> = new Map();

export function polyfillRequestIdleCallback() {
    polyfilled = true;
    if (typeof window.requestIdleCallback == "function") {

    }
    else {
        (window as any)["requestIdleCallback"] = function requestIdleCallback(callback: () => void) {
            const myHandle = nextIdleCallbackNumber++;

            const wcallback = () => {
                idleCallbacksByNumber.delete(myHandle);
                callback();
            };

            const disposable = Scheduler.scheduleCallback(0, wcallback);

            idleCallbacksByNumber.set(myHandle, disposable);
            return myHandle;
        };
        (window as any)["cancelIdleCallback"] = function cancelIdleCallback(handle: number) {
            const d = idleCallbacksByNumber.get(handle);
            if (d) {
                idleCallbacksByNumber.delete(handle);
                try { d.dispose(); }
                catch { }
            }
        };
    }
}

// let cbx: number | null = null;

// type RegisteredIdleCallback = { number: number, callback: () => any };
// const registeredIdleCallbacks: RegisteredIdleCallback[] = [];
// const regCallbacksByNumber: Map<number, RegisteredIdleCallback> = new Map();

// function invokeIdleCallbacks() {
//     enterDelayingBlock(() => {
//         while (registeredIdleCallbacks.length > 0) {
//             const ic = registeredIdleCallbacks.shift()!;
//             try {
//                 if (regCallbacksByNumber.has(ic.number)) {
//                     regCallbacksByNumber.delete(ic.number);
//                         ic.callback();
//                 }
//             }
//             catch { }
//         }
//     });
// }

// let nextNum: number = 1;
// let polyfilled = false;
// export function polyfillRequestIdleCallback() {
//     if (!polyfilled) {
//         polyfilled = true;

//         let requestFunc: (callback: () => any) => number;
//         if (typeof window.requestIdleCallback == "function") {
//             const origRIC = window.requestIdleCallback;
//             requestFunc = h => {
//                 const res = origRIC(h);
//                 window.requestAnimationFrame(h);
//                 return res;
//             };
//         }
//         else {
//             requestFunc = h => {
//                 return window.requestAnimationFrame(h);
//             };
//         }

//         (window as any).requestIdleCallback = (cb: () => any) => {
//             const myNum = nextNum++;
//             const rc = { callback: cb, number: myNum };
//             registeredIdleCallbacks.push(rc);
//             regCallbacksByNumber.set(myNum, rc);
//             if (cbx == null) {
//                 cbx = requestFunc(() => {
//                     cbx = null;
//                     invokeIdleCallbacks();
//                 });
//             }
//             return myNum;
//         };
//         (window as any).cancelIdleCallback = (handle: number) => {
//             regCallbacksByNumber.delete(handle);
//         };
//     }
// }