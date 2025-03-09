// import { CallbackSet } from "../CallbackSet";
// import { SnapshottableSet } from "../collections/SnapshottableSet";
// import { IDisposable, asDisposable } from "../Disposable";

// export type NewObservableSubscriptionCallback<T> = (value: T) => void;

// export interface NewObservable<T> {
//     readonly value: T;

//     addValueSubscription(callback: (value: T) => void): IDisposable;
//     removeValueSubscription(callback: (value: T) => void): void;
// }

// type NewType<T> = CallbackSet<NewObservableSubscriptionCallback<T>>;

// export class NewObservableImpl<T> {
//     constructor(initialValue: T) {
//         this._value = initialValue;
//     }

//     private _value: T;
//     private _subscribers?: NewType<T>;

//     get value(): T {
//         return this._value;
//     }
//     set value(newValue: T) {
//         if (this._value !== newValue) {
//             const oldValue = this._value;
//             this._value = newValue;
//             this.notifySubscribers(newValue, oldValue);
//         }
//     }

//     private notifySubscribers(newValue: T, oldValue: T) {
//         if (this._subscribers) {
//             this._subscribers.invoke(newValue);
//         }
//     }

//     addValueSubscription(callback: NewObservableSubscriptionCallback<T>): IDisposable {
//         if (!this._subscribers) {
//             this._subscribers = new CallbackSet("NewObservableImpl-subscribers", () => {
//                 if (this._subscribers?.size == 0) {
//                     this._subscribers = undefined;
//                 }
//             });
//         }
//         return this._subscribers.add(callback);
//     }

//     removeValueSubscription(callback: NewObservableSubscriptionCallback<T>): void {
//         if (this._subscribers) {
//             this._subscribers.delete(callback);
//         }
//     }
// }

// class NewObservableAggregate implements NewObservable<void> {
//     constructor(
//         private observables: Iterable<NewObservable<any>>) {
//     }
    
//     get value(): void { return undefined; }

//     private _subcriptions?: CallbackSet<NewObservableSubscriptionCallback<void>> = undefined;
//     private _innerSubs: IDisposable[] = [];

//     private subscribeToInners() {
//         const innerSubs: IDisposable[] = [];
//         for (let inner of this.observables) {
//             const tsub = inner.addValueSubscription(() => {
//                 this.notifySubscribers();
//             });
//             innerSubs.push(tsub);
//         }
//         this._innerSubs = innerSubs;
//     }

//     private unsubscribeFromInners() {
//         const innerSubs = this._innerSubs;
//         this._innerSubs = [];
//         for (let inner of innerSubs) {
//             inner.dispose();
//         }
//     }

//     private notifySubscribers() {
//         if (this._subcriptions) {
//             this._subcriptions.invoke();
//         }
//         else {
//             // should never get here, shouldn't have inner subs when no subscriptions
//         }
//     }

//     addValueSubscription(callback: NewObservableSubscriptionCallback<void>): IDisposable {
//         if (!this._subcriptions) {
//             // TODO: subscribe to inners
//             this._subcriptions = new CallbackSet("NewObservableAggregate", () => {
//                 if (this._subcriptions?.size == 0) {
//                     this._subcriptions = undefined;
//                 }
//             });
//         }
//         return this._subcriptions.add(callback);
//     }

//     removeValueSubscription(callback: NewObservableSubscriptionCallback<void>): void {
//         if (this._subcriptions) {
//             this._subcriptions.delete(callback);
//         }
//     }
// }

// export class NewObservableExpression<T> implements NewObservable<T> {
//     constructor(
//         private readonly expression: () => T) {

//         this._value = this.evaluateExpression();
//     }
    
//     private _value: T;
//     private _aggregateObservable!: NewObservableAggregate;
//     private _aggregateSubscription?: IDisposable;
//     private _subscribers?: CallbackSet<NewObservableSubscriptionCallback<T>>;

//     private evaluateExpression(): T {
//         const observables: Set<NewObservable<any>> = new Set();

//         const exprResult = NewObservableDependencyManager.watchDependencies<T>(obs => {
//             observables.add(obs);
//         }, () => {
//             const result = this.expression();
//             return result;
//         });

//         this.unhookFromAggregate();
//         this._aggregateObservable = new NewObservableAggregate(observables);
//         if (this._subscribers) {
//             this.hookupToAggregate();
//         }

//         return exprResult;
//     }

//     get value(): T { return this._value; }

//     refresh() {
//         this.evaluateExpression();
//     }

//     addValueSubscription(callback: NewObservableSubscriptionCallback<T>): IDisposable {
//         if (!this._subscribers) {
//             this._subscribers = new CallbackSet("NewObservableExpression-subscribers", () => {
//                 if (this._subscribers?.size == 0) {
//                     this._subscribers = undefined;
//                     this.unhookFromAggregate();
//                 }
//             });
//             this.hookupToAggregate();
//         }
//         return this._subscribers.add(callback);
//     }

//     removeValueSubscription(callback: NewObservableSubscriptionCallback<T>): void {
//         if (this._subscribers) {
//             this._subscribers.delete(callback);
//         }
//     }

//     private hookupToAggregate() {
//         this._aggregateSubscription = this._aggregateObservable.addValueSubscription(() => {
//             this.evaluateExpression();
//         });
//     }
    
//     private unhookFromAggregate() {
//         if (this._aggregateSubscription) {
//             this._aggregateSubscription.dispose();
//             this._aggregateSubscription = undefined;
//         }
//     }
// }

// export type DependencyWatcherCallback = (obs: NewObservable<any>) => void;

// export class NewObservableDependencyManager {
//     private static _watchers: CallbackSet<DependencyWatcherCallback> = new CallbackSet("NewObservableDependencyManager-watchers");

//     static reportDependency(obs: NewObservable<any>) {
//         if (this._watchers.size > 0) {
//             this._watchers.invoke(obs);
//         }
//     }

//     static watchDependencies<T>(callback: DependencyWatcherCallback, block: () => T): T {
//         this._watchers.add(callback);
//         try {
//             const result = block();
//             return result;
//         }
//         finally {
//             this._watchers.delete(callback);
//         }
//     }
// }