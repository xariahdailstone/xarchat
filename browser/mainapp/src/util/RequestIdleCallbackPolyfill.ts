

export function polyfillRequestIdleCallback() {
    if (typeof window.requestIdleCallback == "function") {
    }
    else {
        (window as any).requestIdleCallback = (cb: () => any) => {
            window.requestAnimationFrame(() => {
                cb();
            });
        };
    }
}