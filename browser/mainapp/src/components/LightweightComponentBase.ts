import { IDisposable, EmptyDisposable, asDisposable } from "../util/Disposable.js";
import { Logger, Logging } from "../util/Logger.js";
import { ObjectUniqueId } from "../util/ObjectUniqueId.js";
import { ObservableValue } from "../util/Observable.js";
import { ObservableExpression } from "../util/ObservableExpression.js";
import { Optional } from "../util/Optional.js";

export abstract class LightweightComponentBase<TViewModel> implements IDisposable {
    constructor(
        public readonly element: HTMLElement,
        viewModelFunc?: () => Optional<TViewModel>) {

        this.logger = Logging.createLogger(`${this.constructor.name}#${ObjectUniqueId.get(this)}`);

        this._viewModel = new ObservableValue(null);
        if (viewModelFunc) {
            this._viewModelExpression = new ObservableExpression<Optional<TViewModel>>(viewModelFunc,
                vm => { this.setViewModel(vm); },
                err => { this.setViewModel(null); });
        }
        else {
            this._viewModelExpression = null;
        }
    }

    protected readonly logger: Logger;

    private readonly _viewModelExpression: ObservableExpression<Optional<TViewModel>> | null;
    private _disposed = false;

    dispose() {
        if (!this._disposed) {
            this._disposed = true;

            for (let x of this._watchRegistrations.values()) {
                x.dispose();
            }
            this._watchRegistrations.clear();

            if (this._viewModelExpression) {
                this._viewModelExpression.dispose();
            }

            while (this.element.firstChild) {
                this.element.firstChild.remove();
            }

            for (let d of this._onDispose) {
                d();
            }
        }
    }

    [Symbol.dispose]() { this.dispose(); }

    get isDisposed() { return this._disposed; }

    private readonly _onDispose: (() => any)[] = [];
    addOnDispose(func: () => any) {
        this._onDispose.push(func);
    }

    private _viewModel: ObservableValue<Optional<TViewModel>>;
    get viewModel(): Optional<TViewModel> { return this._viewModel.value; }
    set viewModel(value: Optional<TViewModel>) {
        if (this._viewModelExpression == null) {
            this.setViewModel(value);
        }
        else {
            throw new Error("Cannot override calculated view model");
        }
    }

    private setViewModel(vm: Optional<TViewModel>) {
        if (vm !== this._viewModel) {
            this._viewModel.value = vm;
            this.viewModelChanged();
        }
    }

    protected viewModelChanged() {
    }

    private readonly _watchRegistrations: Set<WatchRegistration<any>> = new Set();

    protected watchExpr<T>(expr: () => T, callback: (item: Optional<T>) => (void | IDisposable)): IDisposable {
        if (this._disposed) { return EmptyDisposable; }

        const wr = new WatchRegistration(expr, callback);
        this._watchRegistrations.add(wr);

        return asDisposable(() => {
            this._watchRegistrations.delete(wr);
            wr.dispose();
        });
    }
}

class WatchRegistration<T> implements IDisposable {
    constructor(
        private readonly expr: () => T,
        private readonly callback: (item: Optional<T>) => (void | IDisposable)) {

        this._oe = new ObservableExpression(expr,
            v => { this.invokeCallback(v); },
            err => { this.invokeCallback(null); });
    }

    private readonly _oe: ObservableExpression<T>;
    private _disposed: boolean = false;
    private _currentCallbackDisposable: IDisposable | null = null;

    dispose() {
        if (!this._disposed) {
            this._disposed = true;

            this._oe.dispose();
            this._currentCallbackDisposable?.dispose();
        }
    }

    [Symbol.dispose]() { this.dispose(); }

    get isDisposed() { return this._disposed; }

    private invokeCallback(v: Optional<T>) {
        if (this._currentCallbackDisposable) {
            this._currentCallbackDisposable.dispose();
        }

        if (!this._disposed) {
            this._currentCallbackDisposable = this.callback(v) ?? null;
        }
    }
}