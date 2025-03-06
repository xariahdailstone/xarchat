import { CallbackSet } from "../../util/CallbackSet";
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
    private _dismissalWaiters: CallbackSet<() => void> = new CallbackSet("PopupViewModel-dismissalWaiters");

    dismissed() { 
        if (!this._dismissed) {
            this._dismissed = true;
            this._dismissalWaiters.invoke();
        }
        this.appViewModel.popups.remove(this);
    }

    async waitForDismissalAsync(): Promise<void> {
        const ps = new PromiseSource<void>();
        using dwreg = this._dismissalWaiters.add(() => {
            ps.tryResolve();
        })
        await ps.promise;
    }
}

export abstract class ContextPopupViewModel extends PopupViewModel {
    constructor(
        parent: AppViewModel,
        public readonly contextElement: HTMLElement) {
            
        super(parent);
    }
}