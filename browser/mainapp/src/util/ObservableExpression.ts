import { CallbackSet } from "./CallbackSet";
import { CancellationToken } from "./CancellationTokenSource";
import { IDisposable } from "./Disposable";
import { testEquality } from "./Equality";
import { Logging } from "./Logger";
import { Observable, PropertyChangeEvent, PropertyChangeEventListener, ValueSubscription } from "./Observable";
import { ObservableBase, setupValueSubscription } from "./ObservableBase";
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

const logger = Logging.createLogger("ObservableExpression");
const obsExpressionFinalizationRegistry = new FinalizationRegistry<ObservableExpressionInner<any>>(hv => {
    if (!hv.isDisposed) {
        logger.logError("Finalized ObservableExpression wrapper!!!", hv);
        //hv.dispose();
    }
});

class ObservableExpressionNoValueClass {}
export class ObservableExpression<T> implements IDisposable {
    static NO_VALUE = new ObservableExpressionNoValueClass();

    constructor(
        private readonly expression: () => T,
        private readonly onValueChanged: (value: T | undefined) => (null | void | IDisposable),
        private readonly onErrorChanged?: (err: any | undefined) => (null | void | IDisposable)) {

        this._innerOE = new ObservableExpressionInner<T>("unnamed", expression, onValueChanged, onErrorChanged);
        obsExpressionFinalizationRegistry.register(this, this._innerOE);
    }

    private readonly _innerOE: ObservableExpressionInner<T>;

    dispose() {
        if (!this._disposed) {
            this._disposed = true;

            obsExpressionFinalizationRegistry.unregister(this._innerOE);
            this._innerOE.dispose();
        }
    }

    [Symbol.dispose]() { this.dispose(); }

    get isDisposed() { return this._disposed; }

    private _disposed = false;

    get hasValue() { return this._innerOE.hasValue; }
    get value(): (T | undefined) { return this._innerOE.value; }

    get hasError() { return this._innerOE.hasError; }
    get error(): (any | undefined) { return this._innerOE.error; }
}

export class NamedObservableExpression<T> implements IDisposable {
    static NO_VALUE = new ObservableExpressionNoValueClass();

    constructor(
        private readonly name: string,
        private readonly expression: () => T,
        private readonly onValueChanged: (value: T | undefined) => (null | void | IDisposable),
        private readonly onErrorChanged?: (err: any | undefined) => (null | void | IDisposable)) {

        this._innerOE = new ObservableExpressionInner<T>(name, expression, onValueChanged, onErrorChanged);
        obsExpressionFinalizationRegistry.register(this, this._innerOE);
    }

    private readonly _innerOE: ObservableExpressionInner<T>;

    dispose() {
        if (!this._disposed) {
            this._disposed = true;

            obsExpressionFinalizationRegistry.unregister(this._innerOE);
            this._innerOE.dispose();
        }
    }

    [Symbol.dispose]() { this.dispose(); }

    get isDisposed() { return this._disposed; }

    private _disposed = false;

    get hasValue() { return this._innerOE.hasValue; }
    get value(): (T | undefined) { return this._innerOE.value; }

    get hasError() { return this._innerOE.hasError; }
    get error(): (any | undefined) { return this._innerOE.error; }
}

class ObservableExpressionInner<T> implements IDisposable {
    static NO_VALUE = new ObservableExpressionNoValueClass();

    constructor(
        private readonly name: string,
        private readonly expression: () => T,
        private readonly onValueChanged: (value: T | undefined) => (null | void | IDisposable),
        private readonly onErrorChanged?: (err: any | undefined) => (null | void | IDisposable)) {

        //this.logger.logDebug("new oexpr", this.expression);
        this.reevaluate();
    }

    dispose() {
        //this.logger.logDebug("disposing oexpr", this.expression);
        this._disposed = true;
        this.setValueAndError(ObservableExpression.NO_VALUE, ObservableExpression.NO_VALUE);
        this.cleanupDependencyListeners();
    }

    [Symbol.dispose]() { this.dispose(); }

    get isDisposed() { return this._disposed; }

    private _disposed = false;
    private _previousValue: (T | undefined | ObservableExpressionNoValueClass) = ObservableExpression.NO_VALUE;
    private _previousError: (any | undefined | ObservableExpressionNoValueClass) = ObservableExpression.NO_VALUE;

    get hasValue() { return this._previousValue != ObservableExpression.NO_VALUE; }
    get value(): (T | undefined) {
        return this._previousValue instanceof ObservableExpressionNoValueClass ? undefined : this._previousValue;
    }
    get hasError() { return this._previousError != ObservableExpression.NO_VALUE; }
    get error(): (any | undefined) {
        return this._previousError instanceof ObservableExpressionNoValueClass ? undefined : this._previousError;
    }

    private setValueAndError(value: (T | undefined | ObservableExpressionNoValueClass), error: (any | undefined | ObservableExpressionNoValueClass)) {
        if (!testEquality(value, this._previousValue)) {
            this._previousValue = value instanceof ObservableExpressionNoValueClass ? undefined : value;
            this._previousError = undefined;
            Observable.enterObservableFireStack(() => {
                const exposeValue = value instanceof ObservableExpressionNoValueClass ? undefined : value;
                try { this.onValueChanged(exposeValue as T); }
                catch { }
            });
        }
        if (!testEquality(error, this._previousError)) {
            this._previousValue = undefined;
            this._previousError = error instanceof ObservableExpressionNoValueClass ? undefined : error;
            Observable.enterObservableFireStack(() => {
                const exposeError = error instanceof ObservableExpressionNoValueClass ? undefined : error;
                if (this.onErrorChanged) {
                    try { this.onErrorChanged(exposeError as any); }
                    catch { }
                }
            });
        }
    }

    private reevaluate() {
        if (this._disposed) return;
        //this.logger.logDebug("reevaluating expr", this.expression);

        this.cleanupDependencyListeners();

        let hasPendingResult = false;
        let pendingResult: (T | undefined) = undefined;
        let pendingError: (any | undefined) = undefined;

        {
            using rmDisposable = Observable.addReadMonitor((vm, propName, propValue) => {
                //this.logger.logDebug("addReadMonitor", vm, propName, propValue);
                this.addDependencyListener(vm, propName);
            });

            try {
                pendingResult = this.expression();
                hasPendingResult = true;
                //this.logger.logDebug("oexpr result", pendingResult);
            }
            catch (e) {
                //this.logger.logDebug("oexpr err", e);
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
                //this.logger.logDebug("expr depends on", propName, vm);
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

export class WatchedExpression<T> implements Observable, IDisposable {
    constructor(func: () => T) {
        this._currentGetter = () => { throw new Error("Value not available yet") };

        this._oe = new ObservableExpression(func,
            (v) => {
                this._currentGetter = () => v;
                this.raisePropertyChangeEvent("value", v);
            },
            (e) => {
                this._currentGetter = () => { throw e; };
                this.raisePropertyChangeEvent("value", undefined);
            }
        );
    }

    addEventListener(eventName: "propertychange", handler: PropertyChangeEventListener): IDisposable {
        return this._cbSet.add(handler);
    }
    removeEventListener(eventName: "propertychange", handler: PropertyChangeEventListener): void {
        this._cbSet.delete(handler);
    }
    raisePropertyChangeEvent(propertyName: string, propValue: unknown): void {
        this._cbSet.invoke(new PropertyChangeEvent(propertyName, propValue));
    }
    addValueSubscription(propertyPath: string, handler: (value: any) => any): ValueSubscription {
        return setupValueSubscription(this, propertyPath, handler);
    }

    private readonly _oe: ObservableExpression<T>;
    private _currentGetter: () => T | undefined;
    private _cbSet: CallbackSet<PropertyChangeEventListener> = new CallbackSet("WatchedExpression");

    get value(): (T | undefined) { return this._currentGetter(); }

    private _isDisposed = false;
    get isDisposed(): boolean { return this._isDisposed; }

    dispose(): void {
        if (!this._isDisposed) {
            this._isDisposed = true;
            this._oe.dispose();
            this._currentGetter = () => { throw new Error("WatchedExpression disposed") };
            this.raisePropertyChangeEvent("value", undefined);
        }
    }

    [Symbol.dispose](): void { this.dispose(); }
}