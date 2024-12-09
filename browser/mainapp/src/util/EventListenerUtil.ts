import { asDisposable, IDisposable } from "./Disposable";

interface EventListenable<TEvent, TCallback> {
    addEventListener(name: TEvent, callback: TCallback, isCapture?: boolean): void;
    removeEventListener(name: TEvent, callback: TCallback, isCapture?: boolean): void;
}

export class EventListenerUtil {
    static addDisposableEventListener<TEvent extends string, TCallback extends Function>(
        target: EventListenable<TEvent, TCallback>, name: TEvent, handler: TCallback, isCapture?: boolean): IDisposable {

        target.addEventListener(name, handler, isCapture);

        return asDisposable(() => {
            target.removeEventListener(name, handler, isCapture);
        });
    }
}

export enum MouseButton {
    LEFT = 0,
    WHEEL = 1,
    RIGHT = 2,
    BACK = 3,
    FORWARD = 4
}