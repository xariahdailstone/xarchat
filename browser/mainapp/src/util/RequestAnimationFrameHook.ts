
let isHooked = false;
let currentlyInAnimationFrame = false;

export function hookRequestAnimationFrame() {
    if (isHooked) { return; }

    isHooked = true;
    const originalRAF = (window as any).requestAnimationFrame;
    (window as any).requestAnimationFrame = function (callback: FrameRequestCallback) {
        const wrappedCallback = function (timestamp: DOMHighResTimeStamp) {
            //console.log("entering animation frame callback");
            currentlyInAnimationFrame = true;
            try {
                callback.call(window, timestamp);
            }
            finally {
                //console.log("leaving animation frame callback");
                currentlyInAnimationFrame = false;
            }
        };
        const result = originalRAF.call(window, wrappedCallback);
        return result;
    };
}

export function isInAnimationFrame(): boolean {
    if (!isHooked) { hookRequestAnimationFrame(); return false; }
    return currentlyInAnimationFrame;
}

export function runInAnimationFrame(callback: FrameRequestCallback): (number | null) {
    if (isInAnimationFrame()) {
        //console.log("running now, already in animation frame");
        callback(window.performance.now());
        return null;
    }
    else {
        //console.log("enqueuing to run in animation frame");
        const result = window.requestAnimationFrame(callback);
        return result;
    }
}