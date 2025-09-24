import { Scheduler } from "./Scheduler";

export class ResizeObserverNice extends ResizeObserver {
    constructor(callback: ResizeObserverCallback) {
        super((entries) => {
            Scheduler.scheduleNamedCallback("ResizeObserverNice.callback", ["frame", "idle", 250], () => {
                callback(entries, this);
            });
        });
    }
}