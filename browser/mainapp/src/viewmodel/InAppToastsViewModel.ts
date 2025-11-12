import { ReadOnlyStdObservableCollection, StdObservableCollectionChangeType } from "../util/collections/ReadOnlyStdObservableCollection";
import { TimeSpanUtils } from "../util/DateTimeUtils";
import { DateUtils } from "../util/DateUtils";
import { asDisposable, IDisposable } from "../util/Disposable";
import { ObservableBase, observableProperty } from "../util/ObservableBase";
import { Collection } from "../util/ObservableCollection";
import { Scheduler } from "../util/Scheduler";
import { AppViewModel } from "./AppViewModel";

export class InAppToastsViewModel extends ObservableBase {
    constructor(public readonly appViewModel: AppViewModel) {
        super();
        this._toasts.addCollectionObserver(obs => {
            for (let entry of obs.values()) {
                if (entry.changeType == StdObservableCollectionChangeType.ITEM_ADDED) {
                    this.setupToastExpiration(entry.item);
                }
            }
        })
    }

    private readonly SYM_EXPIRATIONHANDLE = Symbol();

    private setupToastExpiration(item: ToastInfo) {
        if (item.expiresAt) {
            const existingHandle = (item as any)[this.SYM_EXPIRATIONHANDLE];
            if (!existingHandle) {
                const expirationHandle = Scheduler.scheduleCallback(item.expiresAt, () => {
                    this.removeToast(item, ToastCloseReason.TimedOut);
                });
                (item as any)[this.SYM_EXPIRATIONHANDLE] = expirationHandle;
            }
        }
    }
    private clearToastExpiration(item: ToastInfo) {
        const existingHandle = (item as any)[this.SYM_EXPIRATIONHANDLE] as (IDisposable | null | undefined);
        if (existingHandle) {
            delete (item as any)[this.SYM_EXPIRATIONHANDLE];
            existingHandle.dispose();
        }
    }

    private _toasts = new Collection<ToastInfo>();
    get toasts(): ReadOnlyStdObservableCollection<ToastInfo> { return this._toasts; }

    addNewToast(info: ToastInfo): IDisposable {
        let added = false;
        for (let i = 0; i < this._toasts.length; i++) {
            const checkAgainst = this._toasts[i]!;
            if (checkAgainst.priority > info.priority) {
                added = true;
                this._toasts.addAt(info, i);
                break;
            }
        }
        if (!added) {
            this._toasts.add(info);
        }

        this.setupToastExpiration(info);

        return asDisposable(() => {
            this.removeToast(info, ToastCloseReason.AddToastDisposed);
        });
    }

    removeToast(info: ToastInfo, reason?: ToastCloseReason | any) {
        if (this._toasts.contains(info)) {
            this._toasts.remove(info);
            this.clearToastExpiration(info);
            this.fireToastCloseEvent(info, reason ?? ToastCloseReason.RemoveToastCalled);
        }
    }

    private fireToastCloseEvent(info: ToastInfo, reason: ToastCloseReason | any) {
        if (info.onClose) {
            info.onClose(reason);
            info.onClose = undefined;
        }
    }

    showTestToast(ti?: Partial<ToastInfo>) {
        ti ??= {};
        this.addNewToast({
            priority: 10,
            backgroundColor: "red",
            color: "white",
            title: "Test Toast",
            description: "You chose to show a test toast message.  This is it.",
            canClose: true,
            buttons: [
                {
                    title: "Okay",
                    onClick: (toastInfo) => {
                        this.logger.logInfo("Test toast closed via OK button");
                        this.removeToast(toastInfo, "ok button clicked");
                    }
                }
            ],
            onClick: (toastInfo) => {
                this.logger.logInfo("Test toast closed via toast click");
                this.removeToast(toastInfo, ToastCloseReason.ToastClicked);
            },
            onClose: (reason) => {
                this.logger.logInfo("Test toast closed", reason);
            },
            ...ti
        });
    }
}

export enum ToastCloseReason {
    CloseButtonClicked,
    ToastClicked,
    RemoveToastCalled,
    TimedOut,
    AddToastDisposed
}

export interface ToastInfo {
    priority: number;
    cssClasses?: string[];
    backgroundColor?: string;
    color?: string;
    canClose?: boolean;
    title: string;
    description: string;
    expiresAt?: Date;
    buttons?: ToastButtonInfo[];
    onClick?: (info: ToastInfo) => void;
    onClose?: (reason: ToastCloseReason | any) => void;
}
export interface ToastButtonInfo {
    title: string;
    onClick: (info: ToastInfo) => void;
}