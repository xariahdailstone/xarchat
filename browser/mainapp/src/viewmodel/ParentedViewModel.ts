import { addOnDispose, IDisposable, isDisposable } from "../util/Disposable";
import { ObservableBase } from "../util/ObservableBase";

export class ParentedViewModel<TParent> extends ObservableBase implements IDisposable {
    constructor(
        public readonly parent: TParent) {

        super();
        if (isDisposable(parent)) {
            addOnDispose(parent as IDisposable, () => { this.dispose(); })
        }
    }

    private _disposed: boolean = false;

    [Symbol.dispose]() { this.dispose(); }

    dispose() {
        if (!this._disposed) {
            this._disposed = true;
        }
    }

    get isDisposed() { return this._disposed; }
}
