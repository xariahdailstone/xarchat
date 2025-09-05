import { VNode } from "../../snabbdom/index";
import { IDisposable } from "../../util/Disposable";
import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { Collection } from "../../util/ObservableCollection";

export class SidebarTabContainerViewModel extends ObservableBase implements IDisposable {
    constructor() {
        super();
    }

    private _isDisposed = false;
    get isDisposed() { return this._isDisposed; }

    dispose(): void {
        if (!this._isDisposed) {
            this._isDisposed = true;
            for (let tab of this.tabs) {
                tab.dispose();
            }
        }
    }
    [Symbol.dispose](): void {
        this.dispose();
    }

    @observableProperty
    containerClasses: ReadonlyArray<string> = [];

    @observableProperty
    tabs: Collection<SidebarTabViewModel> = new Collection();

    @observableProperty
    selectedTab: SidebarTabViewModel | null = null;
}

export abstract class SidebarTabViewModel extends ObservableBase implements IDisposable {
    private _isDisposed = false;
    get isDisposed() { return this._isDisposed; }

    dispose(): void {
        if (!this._isDisposed) {
            this._isDisposed = false;
        }
    }
    [Symbol.dispose](): void {
        this.dispose();
    }
}