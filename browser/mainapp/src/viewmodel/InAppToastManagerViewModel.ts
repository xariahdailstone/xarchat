import { CancellationToken, CancellationTokenSource } from "../util/CancellationTokenSource";
import { IDisposable } from "../util/Disposable";
import { ObservableBase, observableProperty } from "../util/ObservableBase";
import { Collection } from "../util/ObservableCollection";
import { PromiseSource } from "../util/PromiseSource";
import { TaskUtils } from "../util/TaskUtils";
import { ActiveLoginViewModel } from "./ActiveLoginViewModel";
import { InAppToastViewModel } from "./InAppToastViewModel";

export class InAppToastManagerViewModel extends ObservableBase implements IDisposable {
    constructor(
        public readonly session: ActiveLoginViewModel) {

        super();
    }

    private _disposeCTS: CancellationTokenSource = new CancellationTokenSource();

    private _disposed: boolean = false;
    dispose(): void {
        if (!this._disposed) {
            this._disposed = true;
            this._disposeCTS.cancel();
        }
    }

    [Symbol.dispose](): void {
        this.dispose();
    }

    get isDisposed() { return this._disposed; }

    private maximumShowingToasts: number = 3;

    @observableProperty
    viewEventsSink: ViewEventsSink | null = null;

    private getViewEventsSink(): ViewEventsSink {
        return this.viewEventsSink ?? {
            prepareToShow(vm) { },
            prepareToRemove(vm) { },
            async executeRemoveAnimationAsync(vm) { },
            async executeShowAnimationAsync(vm) { }
        };
    }

    @observableProperty
    readonly showingToasts: Collection<InAppToastViewModel> = new Collection();

    private _pendingToasts: Collection<PromiseSource<void>> = new Collection();

    async showAsync(vm: InAppToastViewModel, cancellationToken: CancellationToken): Promise<void> {
        if (this.showingToasts.length >= this.maximumShowingToasts)
        {
            const ps = new PromiseSource<void>();

            using creg = cancellationToken.register(() => {
                this._pendingToasts.remove(ps);
                ps.trySetCancelled(cancellationToken);
            });

            this._pendingToasts.add(ps);
            await ps.promise;
        }

        try {
            this.showingToasts.push(vm);
            this.getViewEventsSink().prepareToShow(vm);
            await this.getViewEventsSink().executeShowAnimationAsync(vm);

            try {
                await TaskUtils.delay(vm.showForMs, cancellationToken);
            }
            finally {
                await this.getViewEventsSink().executeRemoveAnimationAsync(vm);
                this.getViewEventsSink().prepareToRemove(vm);
                this.showingToasts.remove(vm);
            }
        }
        finally {
            while (this._pendingToasts.length > 0) {
                const npt = this._pendingToasts.shift()!;
                if (npt.tryResolve()) {
                    break;
                }
            }
        }
    }
}

export interface ViewEventsSink {
    prepareToShow(vm: InAppToastViewModel): void;
    executeShowAnimationAsync(vm: InAppToastViewModel): Promise<void>;
    prepareToRemove(vm: InAppToastViewModel): void;
    executeRemoveAnimationAsync(vm: InAppToastViewModel): Promise<void>;
}