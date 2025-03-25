import { AnimationFrameUtils } from "./AnimationFrameUtils";
import { SnapshottableMap } from "./collections/SnapshottableMap";
import { asDisposable, IDisposable } from "./Disposable";
import { EventListenerUtil } from "./EventListenerUtil";

const MOVER_SYM = Symbol("MouseOverUtils.onMouseOver");
const MOVER_EVT_SYM = Symbol("MouseOverUtils.onMouseOverEvt");
const MOVER_MONITOR = Symbol("MouseOverUtils.onMouseOversMonitor");
const MOUT_SYM = Symbol("MouseOverUtils.onMouseOut");
const MOUT_EVT_SYM = Symbol("MouseOverUtils.onMouseOutEvt");

type MouseOverEventHandler = (e: MouseEvent) => void;
type MouseOutEventHandler = () => void;

interface HasMSyms {
    [MOVER_SYM]?: SnapshottableMap<object, MouseOverEventHandler>;
    [MOVER_EVT_SYM]?: IDisposable;
    [MOUT_SYM]?: Map<object, MouseOutEventHandler>;
    [MOUT_EVT_SYM]?: IDisposable;
    [MOVER_MONITOR]?: ActiveMouseOver;
}

export class MouseOverUtils {

    static addMouseOverHandler(el: HTMLElement, callback: MouseOverEventHandler): IDisposable {
        const xel = (el as HTMLElement & HasMSyms);
        if (!xel[MOVER_SYM]) {
            xel[MOVER_SYM] = new SnapshottableMap();
            xel[MOVER_EVT_SYM] = EventListenerUtil.addDisposableEventListener(el, "mouseover", (e: MouseEvent) => {
                this.beginMouseOver(xel, e);
            });
        }
        const evtMap = xel[MOVER_SYM];
        
        const myKey = {};
        evtMap.set(myKey, callback);

        return asDisposable(() => {
            evtMap.delete(myKey);
            if (evtMap.size == 0) {
                delete xel[MOVER_SYM];
                if (xel[MOVER_EVT_SYM]) {
                    xel[MOVER_EVT_SYM].dispose();
                    delete xel[MOVER_EVT_SYM];
                }
            }
        });
    }

    static addMouseOutHandler(el: HTMLElement, callback: MouseOutEventHandler): IDisposable {
        const xel = (el as HTMLElement & HasMSyms);
        if (!xel[MOUT_SYM]) {
            xel[MOUT_SYM] = new SnapshottableMap();
            xel[MOUT_EVT_SYM] = EventListenerUtil.addDisposableEventListener(el, "mouseout", (e: MouseEvent) => {
                this.performMouseOut(xel, e);
            });
        }
        const evtMap = xel[MOUT_SYM];
        
        const myKey = {};
        evtMap.set(myKey, callback);

        return asDisposable(() => {
            evtMap.delete(myKey);
            if (evtMap.size == 0) {
                delete xel[MOUT_SYM];
                if (xel[MOUT_EVT_SYM]) {
                    xel[MOUT_EVT_SYM].dispose();
                    delete xel[MOUT_EVT_SYM];
                }
            }
        });
    }

    private static beginMouseOver(xel: HTMLElement & HasMSyms, e: MouseEvent) {
        if (xel[MOVER_MONITOR]) {
            xel[MOVER_MONITOR].dispose();
            delete xel[MOVER_MONITOR];
        }

        const activeSet = new Set<object>();

        if (xel[MOUT_SYM]) {
            for (let k of xel[MOUT_SYM].keys()) {
                activeSet.add(k);
            }
        }

        if (xel[MOVER_SYM]) {
            xel[MOVER_SYM].forEachValueSnapshotted(handler => {
                try { handler(e); }
                catch { }
            });
        }

        xel[MOVER_MONITOR] = new ActiveMouseOver(xel, activeSet);
    }

    private static performMouseOut(xel: HTMLElement & HasMSyms, e: MouseEvent) {
        if (xel[MOVER_MONITOR]) { 
            xel[MOVER_MONITOR].dispose();
            delete xel[MOVER_MONITOR];
        }
    }
}

class ActiveMouseOver {
    constructor(xel: HTMLElement & HasMSyms, activeKeys: Set<object>) {
        this._xel = xel;
        this._activeKeys = activeKeys;

        this._connectedMonitor = AnimationFrameUtils.createPerFrame(() => {
            if (!xel.isConnected || !xel[MOUT_SYM]) {
                this.dispose();
            }
        });
    }

    private _disposed: boolean = false;
    private _xel: HTMLElement & HasMSyms;
    private _activeKeys: Set<object>;
    private _connectedMonitor: IDisposable;

    dispose() {
        if (this._disposed) { return; }

        this._disposed = true;

        this._connectedMonitor.dispose();

        const xel = this._xel;
        if (xel[MOUT_SYM]) {
            const moutSet = xel[MOUT_SYM];
            const activeKeys = this._activeKeys;

            for (let k of this._activeKeys.values()) {
                const handler = moutSet.get(k);
                if (handler) {
                    try { handler(); }
                    catch { }
                }
            }
        }
    }
}