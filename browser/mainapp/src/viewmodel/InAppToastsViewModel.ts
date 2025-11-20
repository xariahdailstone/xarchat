import { BBCodeParseResult, ChatBBCodeParser } from "../util/bbcode/BBCode";
import { ReadOnlyStdObservableCollection, StdObservableCollectionChangeType } from "../util/collections/ReadOnlyStdObservableCollection";
import { TimeSpanUtils } from "../util/DateTimeUtils";
import { DateUtils } from "../util/DateUtils";
import { asDisposable, EmptyDisposable, IDisposable } from "../util/Disposable";
import { ObjectUniqueId } from "../util/ObjectUniqueId";
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

    private readonly _toasts = new Collection<ToastInfo>();
    get toasts(): ReadOnlyStdObservableCollection<ToastInfo> { return this._toasts; }

    addNewToast(info: ToastInfo): IDisposable {

        if (info.uniqueKey) {
            const uniqueConflictBehavior = info.uniqueConflictBehavior ?? ToastConflictBehavior.DropThis;

            let existingToast: ToastInfo | null = null;
            for (let xt of this._toasts.iterateValues()) {
                if (xt.uniqueKey == info.uniqueKey) {
                    existingToast = xt;
                    break;
                }
            }

            if (existingToast) {
                let allowThrough: boolean;
                switch (uniqueConflictBehavior) {
                    case ToastConflictBehavior.DropThis:
                        allowThrough = false;
                        return EmptyDisposable;
                    case ToastConflictBehavior.DropExisting:
                        this.removeToast(existingToast, ToastCloseReason.BumpedByNewToast);
                        allowThrough = true;
                        break;
                    case ToastConflictBehavior.Debounce:
                        if (this.seenDebounceRecently(info.uniqueKey)) {
                            allowThrough = false;
                        }
                        else {
                            allowThrough = true;
                        }
                        break;
                }
                if (!allowThrough) {
                    if (info.onClose) {
                        info.onClose(ToastCloseReason.BumpedByExistingToast, this);
                    }
                    return EmptyDisposable;
                }
            }
            else if (uniqueConflictBehavior == ToastConflictBehavior.Debounce) {
                this.seenDebounceRecently(info.uniqueKey);
            }
        }

        const pinfo: InternalToastInfo = info;
        pinfo.descriptionBBCode = ChatBBCodeParser.parse(pinfo.description, {
            appViewModel: this.appViewModel,
            addUrlDomains: false,
            eiconsUniqueLoadTag: "" + ObjectUniqueId.get(pinfo),
            parseAsStatus: true,
            imagePreviewPopups: false,
            syncGifs: true
        });

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

    private readonly _recentDebounces: Map<string, IDisposable> = new Map();
    private seenDebounceRecently(uniqueKey: string): boolean {
        let result: boolean;
        const existingDisposable = this._recentDebounces.get(uniqueKey);
        if (existingDisposable) { 
            this.logger.logInfo("debounce check hasexisting", this._recentDebounces.size, uniqueKey);
            result = true;
            existingDisposable.dispose();
            this._recentDebounces.delete(uniqueKey);
        }
        else {
            this.logger.logInfo("debounce check clear", this._recentDebounces.size, uniqueKey);
            result = false;
        }
        this._recentDebounces.set(uniqueKey, 
            Scheduler.scheduleCallback(2000, () => this._recentDebounces.delete(uniqueKey)));
        return result;
    }

    removeToast(info: ToastInfo, reason?: ToastCloseReason | any) {
        if (this._toasts.contains(info)) {
            const pinfo: InternalToastInfo = info;
            if (pinfo.descriptionBBCode) {
                pinfo.descriptionBBCode.dispose();
                delete pinfo.descriptionBBCode;
            }

            this._toasts.remove(info);
            this.clearToastExpiration(info);
            this.fireToastCloseEvent(info, reason ?? ToastCloseReason.RemoveToastCalled);
        }
    }

    private fireToastCloseEvent(info: ToastInfo, reason: ToastCloseReason | any) {
        if (info.onClose) {
            info.onClose(reason, this);
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
    AddToastDisposed,
    BumpedByNewToast,
    BumpedByExistingToast,
}

export interface ToastInfo {
    uniqueKey?: string;
    uniqueConflictBehavior?: ToastConflictBehavior;
    priority: number;
    cssClasses?: string[];
    backgroundColor?: string;
    color?: string;
    canClose?: boolean;
    title?: string;
    description: string;
    expiresAt?: Date;
    buttons?: ToastButtonInfo[];
    onClick?: (info: ToastInfo, vm: InAppToastsViewModel) => void;
    onClose?: (reason: ToastCloseReason | any, vm: InAppToastsViewModel) => void;
}
export interface ToastButtonInfo {
    title: string;
    onClick: (info: ToastInfo, vm: InAppToastsViewModel) => void;
}

export enum ToastConflictBehavior {
    DropThis = "dropthis",
    DropExisting = "dropexisting",
    Debounce = "debounce"
}

export interface InternalToastInfo extends ToastInfo {
    descriptionBBCode?: BBCodeParseResult;
}