import { CancellationToken } from "./CancellationTokenSource";
import { IDisposable } from "./Disposable";
import { testEquality } from "./Equality";
import { Observable, PropertyChangeEvent, PropertyChangeEventListener } from "./Observable";
import { ObservableBase } from "./ObservableBase";
import { PromiseSource } from "./PromiseSource";

export class AwaitableObservableExpression<T> implements IDisposable, Disposable {
    constructor(expression: () => T) {

        this._obsExpr = new ObservableExpression(expression,
            (value) => { this.valueChanged(value); },
            (error) => { });
    }

    private readonly _obsExpr: ObservableExpression<T>;
    private readonly _valueQueue: (T | undefined)[] = [];
    private _currentPCS: PromiseSource<T | undefined>[] = [];
    private _disposed = false;

    dispose() {
        if (!this._disposed) {
            this._disposed = true;
            this._obsExpr.dispose();
            this._valueQueue.splice(0, this._valueQueue.length);
            for (let pcs of this._currentPCS) {
                pcs.tryReject(new Error("disposed"));
            }
            this._currentPCS = [];
        }
    }

    [Symbol.dispose]() {
        this.dispose();
    }

    get isDisposed() { return this._disposed; }

    private valueChanged(newValue: T | undefined) {
        if (this._disposed) return;

        while (this._currentPCS.length > 0) {
            const pcs = this._currentPCS.shift();
            if (pcs?.tryResolve(newValue)) {
                return;
            }
        }
        this._valueQueue.push(newValue);
    }

    async waitForChange(cancellationToken: CancellationToken): Promise<T | undefined> {
        if (this._disposed) {
            throw new Error("disposed");
        }

        if (this._valueQueue.length > 0) {
            const v = this._valueQueue.shift();
            return v;
        }

        const pcs = new PromiseSource<T | undefined>();
        this._currentPCS.push(pcs);

        using _ = cancellationToken.register(() => {
            pcs.trySetCancelled(cancellationToken);
            this._currentPCS = this._currentPCS.filter(x => x !== pcs)
        });

        const result = await pcs.promise;
        return result;
    }
}

export class ObservableExpression<T> implements IDisposable {
    static NO_VALUE = undefined;

    constructor(
        private readonly expression: () => T,
        private readonly onValueChanged: (value: T | undefined) => (null | void | IDisposable),
        private readonly onErrorChanged?: (err: any | undefined) => (null | void | IDisposable)) {

        //console.log("new oexpr", this.expression);
        this.reevaluate();
    }

    dispose() {
        //console.log("disposing oexpr", this.expression);
        this._disposed = true;
        this.setValueAndError(ObservableExpression.NO_VALUE, ObservableExpression.NO_VALUE);
        this.cleanupDependencyListeners();
    }

    [Symbol.dispose]() { this.dispose(); }

    get isDisposed() { return this._disposed; }

    private _disposed = false;
    private _previousValue: (T | undefined) = ObservableExpression.NO_VALUE;
    private _previousError: (any | undefined) = ObservableExpression.NO_VALUE;

    get hasValue() { return this._previousError != ObservableExpression.NO_VALUE; }
    get value(): (T | undefined) {
        return this._previousValue;
    }
    get hasError() { return this._previousError != ObservableExpression.NO_VALUE; }
    get error(): (any | undefined) {
        return this._previousError;
    }

    private setValueAndError(value: (T | undefined), error: (any | undefined)) {
        if (!testEquality(value, this._previousValue)) {
            this._previousValue = value;
            this._previousError = undefined;
            Observable.enterObservableFireStack(() => {
                try { this.onValueChanged(value as T); }
                catch { }
            });
        }
        if (!testEquality(error, this._previousError)) {
            this._previousValue = undefined;
            this._previousError = error;
            Observable.enterObservableFireStack(() => {
                if (this.onErrorChanged) {
                    try { this.onErrorChanged(error as any); }
                    catch { }
                }
            });
        }
    }

    private reevaluate() {
        if (this._disposed) return;
        //console.log("reevaluating expr", this.expression);

        this.cleanupDependencyListeners();

        let hasPendingResult = false;
        let pendingResult: (T | undefined) = undefined;
        let pendingError: (any | undefined) = undefined;

        {
            using rmDisposable = Observable.addReadMonitor((vm, propName, propValue) => {
                //console.log("addReadMonitor", vm, propName, propValue);
                this.addDependencyListener(vm, propName);
            });

            try {
                pendingResult = this.expression();
                hasPendingResult = true;
                //console.log("oexpr result", pendingResult);
            }
            catch (e) {
                //console.log("oexpr err", e);
                pendingError = e;
                hasPendingResult = false;
            }
        }

        this.setValueAndError(pendingResult, pendingError);
    }

    private _dependencyListeners: DependencyListenerInfo[] = [];

    private addDependencyListener(vm: any, propName: string) {
        if (vm && typeof vm.addEventListener == "function") {
            try {
                const newListener = vm.addEventListener("propertychange", (e: PropertyChangeEvent) => {
                    if (!e || !e.propertyName || e.propertyName == propName) {
                        this.reevaluate();
                    }
                });
                this._dependencyListeners.push({ viewModel: vm, propertyName: propName, listener: newListener });
                //console.log("expr depends on", propName, vm);
            }
            catch { }
        }
    }

    private cleanupDependencyListeners() {
        for (let x of this._dependencyListeners.values()) {
            x.listener.dispose();
        }
        this._dependencyListeners = [];
    }
}

interface DependencyListenerInfo {
    viewModel: any;
    propertyName: string;
    listener: IDisposable;
}