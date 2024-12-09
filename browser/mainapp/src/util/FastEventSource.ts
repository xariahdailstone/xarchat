import { asDisposable } from "./Disposable";

interface RegisteredHandler {
    handler: EventListenerOrEventListenerObject;
    options: any;
}

export class FastEventSource {
    constructor(
        private readonly eventNames: string[],
        private readonly innerElement: HTMLElement) {

        this._origAddEventListener = innerElement.addEventListener;
        this._origRemoveEventListener = innerElement.removeEventListener;
        this._origDispatchEvent = innerElement.dispatchEvent;

        (innerElement as any).addEventListener = (name: string, handler: EventListenerOrEventListenerObject, options: any) => this.addEventListener(name, handler, options);
        (innerElement as any).removeEventListener = (name: string, handler: EventListenerOrEventListenerObject, options: any) => this.removeEventListener(name, handler, options);
        (innerElement as any).dispatchEvent = (event: Event) => this.dispatchEvent(event);
    }

    private _myListeners: Map<string, RegisteredHandler[]> | null = null;

    private readonly _origAddEventListener;
    private readonly _origRemoveEventListener;
    private readonly _origDispatchEvent;

    handlesEvent(name: string) {
        name = name.toLowerCase();
        for (let x of this.eventNames) {
            if (x == name) {
                return true;
            }
        }
        return false;
    }

    addEventListener(name: string, handler: EventListenerOrEventListenerObject, options: any) {
        name = name.toLowerCase();

        if (this.handlesEvent(name)) {
            this._myListeners ??= new Map();
            let handlerSet = this._myListeners.get(name) ?? [];
            handlerSet.push({
                handler: handler,
                options: options
            });
            this._myListeners.set(name, handlerSet);
        }
        else {
            this._origAddEventListener.call(this.innerElement, name, handler, options);
        }

        return asDisposable(() => {
            this.removeEventListener(name, handler, options);
        });
    }

    removeEventListener(name: string, handler: EventListenerOrEventListenerObject, options: any) {
        name = name.toLowerCase();
        if (this.handlesEvent(name)) {
            if (this._myListeners) {
                let handlerSet = this._myListeners.get(name);
                if (handlerSet) {
                    handlerSet = handlerSet.filter(rh => rh.handler != handler);
                    if (handlerSet.length > 0) {
                        this._myListeners.set(name, handlerSet);
                    }
                    else {
                        this._myListeners.delete(name);
                    }
                }
            }
        }
        else {
            this._origRemoveEventListener.call(this.innerElement, name, handler, options);
        }
    }

    dispatchEvent(event: Event) {
        const eventType = event.type.toLowerCase();
        if (this.handlesEvent(eventType)) {
            if (this._myListeners) {
                let handlerSet = this._myListeners.get(eventType);
                if (handlerSet) {
                    for (let hd of handlerSet) {
                        const h = hd.handler;
                        try {
                            if (typeof h == "function") {
                                h(event);
                            }
                            else {
                                h.handleEvent(event);
                            }
                        }
                        catch (e) {
                        }
                    }
                }
            }
        }
        else {
            this._origDispatchEvent.call(this.innerElement, event);
        }
    }
}