
export class ResizeObserverNice extends ResizeObserver {
    constructor(callback: ResizeObserverCallback) {
        super((entries) => {
            window.requestAnimationFrame(() => {
                callback(entries, this);
            });
        });
    }
}