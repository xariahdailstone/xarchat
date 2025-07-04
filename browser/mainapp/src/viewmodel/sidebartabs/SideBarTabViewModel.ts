import { IDisposable } from "../../util/Disposable";
import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { ActiveLoginViewModel } from "../ActiveLoginViewModel";

export abstract class SideBarTabViewModel extends ObservableBase implements IDisposable {
    constructor(
        public readonly session: ActiveLoginViewModel,
        options: SideBarTabViewModelOptions) {

        super();
        this.tabCode = options.tabCode;
        this.tooltipTitle = options.tooltipTitle;
        this.iconUrl = options.iconUrl;
        this.iconText = options.iconText ?? "";
    }

    private _disposed: boolean = false;
    get isDisposed(): boolean { return this._disposed; }

    dispose(): void {
        if (!this._disposed) {
            this._disposed = true;
            try { this.onDisposed(); }
            catch { }
        }
    }
    [Symbol.dispose](): void { this.dispose(); }

    protected onDisposed() { }

    @observableProperty
    readonly tabCode: string;

    @observableProperty
    readonly tooltipTitle: string;

    @observableProperty
    readonly iconUrl: string;

    @observableProperty
    iconText: string;

    @observableProperty
    hasPing: boolean = false;

    @observableProperty
    hasUnseen: boolean = false;
}

interface SideBarTabViewModelOptions {
    tabCode: string;
    tooltipTitle: string;
    iconUrl: string;
    iconText?: string;
}

