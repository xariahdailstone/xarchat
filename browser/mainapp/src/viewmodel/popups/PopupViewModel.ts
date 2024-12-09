import { SnapshottableSet } from "../../util/collections/SnapshottableSet";
import { ObservableBase } from "../../util/ObservableBase";
import { PromiseSource } from "../../util/PromiseSource";
import { AppViewModel } from "../AppViewModel";

export abstract class PopupViewModel extends ObservableBase {
    constructor(public readonly parent: AppViewModel) {
        super();
    }

    get appViewModel() { return this.parent; }

    private _dismissed: boolean = false;
    private _dismissalWaiters: SnapshottableSet<PromiseSource<void>> = new SnapshottableSet();

    dismissed() { 
        this.appViewModel.popups.remove(this);
        if (!this._dismissed) {
            this._dismissed = true;
            this._dismissalWaiters.forEachValueSnapshotted(w => {
                try { w.tryResolve(); }
                catch { }
            });
        }
    }

    waitForDismissalAsync(): Promise<void> {
        const ps = new PromiseSource<void>();
        this._dismissalWaiters.add(ps);
        return ps.promise;
    }
}

export abstract class ContextPopupViewModel extends PopupViewModel {
    constructor(
        parent: AppViewModel,
        public readonly contextElement: HTMLElement) {
            
        super(parent);
    }
}