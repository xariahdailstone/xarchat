import { CallbackSet } from "../../util/CallbackSet";
import { SnapshottableSet } from "../../util/collections/SnapshottableSet";
import { StdObservableSortedView } from "../../util/collections/StdObservableSortedView";
import { StdObservableFilteredView, StdObservableSortedList } from "../../util/collections/StdObservableView";
import { asDisposable, IDisposable } from "../../util/Disposable";
import { KeyCodes } from "../../util/KeyCodes";
import { ObservableValue } from "../../util/Observable";
import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { Collection } from "../../util/ObservableCollection";
import { AppViewModel } from "../AppViewModel";

export abstract class DialogViewModel<TResult> extends ObservableBase {
    constructor(parent: AppViewModel) {
        super();
        this.parent = parent;
    }

    readonly parent: AppViewModel;

    @observableProperty
    title: string = "Untitled";

    private readonly _closeBoxResultObs: ObservableValue<TResult | undefined> = new ObservableValue(undefined);

    get closeBoxResult(): (TResult | undefined) { return this._closeBoxResultObs.value; }
    set closeBoxResult(value: (TResult | undefined)) { this._closeBoxResultObs.value = value; }

    @observableProperty
    buttons: Collection<DialogButtonViewModel> = new Collection();

    autoSortButtonsOnShow: boolean = true;

    @observableProperty
    captionButtons: Collection<DialogCaptionButtonViewModel> = new Collection();

    dialogResult!: TResult;

    private _closed: boolean = false;
    @observableProperty
    get closed() { return this._closed; }
    private set closed(value: boolean) { this._closed = value;}

    private getButtonSortOrder(btn: DialogButtonViewModel) { 
        let baseValue: number;
        switch (btn.style) {
            case DialogButtonStyle.CANCEL:
                baseValue = 0;
                break;
            case DialogButtonStyle.BACKOFF:
                baseValue = 1000;
                break;
            case DialogButtonStyle.NORMAL:
                baseValue = 2000;
                break;
            case DialogButtonStyle.DEFAULT:
                baseValue = 3000;
                break;
        }
        return baseValue + this.buttons.indexOf(btn);
    }

    onShowing() {
        if (this.autoSortButtonsOnShow) {
            this.buttons.sortBy((a, b) => {
                return this.getButtonSortOrder(a) - this.getButtonSortOrder(b);
            });
        }
    }

    get isClosed(): boolean { return this._closed; }

    close(result: TResult) {
        this.dialogResult = result;
        this.closed = true;

        this._closeHandlers2.invoke(result);
        this.onClosed();
    }

    onClosed() { }

    private readonly _closeHandlers2: CallbackSet<CloseHandler<TResult>> = new CallbackSet("DialogViewModel-closeHandlers");
    addCloseListener(callback: CloseHandler<TResult>): IDisposable {
        return this._closeHandlers2.add(callback);
    }
}

export type CloseHandler<TResult> = (result: TResult) => void;
export type ButtonClickHandler = () => void;

export class DialogCaptionButtonViewModel extends ObservableBase {
    constructor(imageUrl: string, onClick: ButtonClickHandler) {
        super();
        this.imageUrl = imageUrl;
        this.onClick = onClick;
    }

    @observableProperty
    imageUrl: string;

    onClick: ButtonClickHandler;
}

export class DialogButtonViewModel extends ObservableBase {
    constructor(options: DialogButtonViewModelOptions);
    constructor(title: string, onClick: ButtonClickHandler);
    constructor(titleOrOptions: string | DialogButtonViewModelOptions, onClick?: ButtonClickHandler) {
        super();
        if (typeof titleOrOptions == "object") {
            this.title = titleOrOptions.title;
            this.onClick = titleOrOptions.onClick;
            this.style = titleOrOptions.style ?? DialogButtonStyle.NORMAL;
            this.shortcutKeyCode = titleOrOptions.shortcutKeyCode ?? null;
        }
        else {
            this.title = titleOrOptions;
            this.onClick = onClick!;
            this.style = DialogButtonStyle.NORMAL;
            this.shortcutKeyCode = null;
        }
    }

    @observableProperty
    title: string;

    onClick: ButtonClickHandler;

    @observableProperty
    style: DialogButtonStyle;

    @observableProperty
    enabled: boolean = true;

    private _shortcutKeyCode: number | null = null;
    @observableProperty
    get shortcutKeyCode(): number | null { 
        if (this._shortcutKeyCode == null) {
            if (this.style == DialogButtonStyle.DEFAULT) {
                return KeyCodes.RETURN;
            }
            else if (this.style == DialogButtonStyle.CANCEL) {
                return KeyCodes.ESCAPE;
            }
            else {
                return null;
            }
        }
        else {
            return this._shortcutKeyCode; 
        }
    }
    set shortcutKeyCode(value: number | null) {
        this._shortcutKeyCode = value;
    }
}

export interface DialogButtonViewModelOptions {
    title: string;
    onClick: ButtonClickHandler;
    style?: DialogButtonStyle;
    shortcutKeyCode?: number;
}

export enum DialogButtonStyle {
    NORMAL = "normal",
    DEFAULT = "default",
    BACKOFF = "backoff",
    CANCEL = "cancel"
}