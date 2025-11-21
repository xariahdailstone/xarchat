import { AnchorElementScrollTo } from "../components/ChannelStream";
import { BBCodeParseResult, ChatBBCodeParser } from "../util/bbcode/BBCode";
import { asDisposable, ConvertibleToDisposable, EmptyDisposable, IDisposable } from "../util/Disposable";
import { ObjectUniqueId } from "../util/ObjectUniqueId";
import { ObservableBase, observableProperty } from "../util/ObservableBase";
import { Collection, ReadOnlyObservableCollection } from "../util/ObservableCollection";
import { ActiveLoginViewModel } from "./ActiveLoginViewModel";
import { ToastConflictBehavior } from "./InAppToastsViewModel";

export class NotificationManagerViewModel extends ObservableBase implements IDisposable {
    constructor(public readonly session: ActiveLoginViewModel) {
        super();

        // for (let i = 0; i < 5; i++) {
        //     this._persistentSetState.collection.add(new NotificationViewModel(session, {
        //         isPersistent: true,
        //         message: `[user]Xariah Dailstone[/user] has invited you to join [session]Test persistent message #${i}[/session].`,
        //         buttons: [
        //             { title: "Join", onClick: (args) => {} },
        //             { title: "Ignore", onClick: (args) => {} },
        //         ]
        //     }));
        // }
        // for (let i = 0; i < 80; i++) {
        //     this._transientSetState.collection.add(new NotificationViewModel(session, {
        //         isPersistent: false,
        //         message: `Test transient message #${i}`
        //     }));
        // }
    }

    private _isDisposed: boolean = false;
    get isDisposed() { return this._isDisposed; }
    dispose() { 
        if (!this._isDisposed) {
            this._isDisposed = true;
            for (let ss of [ this._persistentSetState, this._transientSetState ]) {
                for (let n of [...ss.collection.iterateValues()]) {
                    this.removeNotification(n);
                }
            }
        }
    }
    [Symbol.dispose]() { this.dispose(); }

    private readonly _persistentSetState = new NotificationSetState();
    private readonly _transientSetState = new NotificationSetState();

    get persistentSetState(): INotificationSetState { return this._persistentSetState; }
    get transientSetState(): INotificationSetState { return this._transientSetState; }

    private onNotificationInfoRemoved(notificationInfo: NotificationViewModel) {
        notificationInfo.dispose();
    }

    private trimNotifications() {
        for (let xx of [ this._transientSetState, this._persistentSetState ]) {
            while (xx.collection.length > xx.maximumSize) {
                const toRemove = xx.collection.shift();
                if (toRemove) {
                    this.onNotificationInfoRemoved(toRemove);
                }
            }    
        }
    }

    addNotification(notification: NotificationViewModel): IDisposable {
        const ss = (notification.isPersistent) ? this._persistentSetState : this._transientSetState;
        if (this.canAddNotification(notification)) {
            ss.collection.add(notification);
            this.trimNotifications();
        }
        else {
            notification.dispose();
            return EmptyDisposable;
        }

        return asDisposable(() => this.removeNotification(notification));
    }

    private canAddNotification(notification: NotificationViewModel) {
        if (notification.uniqueKey != null) {
            for (let coll of [this._persistentSetState.collection, this._transientSetState.collection]) {
                for (let n of coll.iterateValues()) {
                    if (n.uniqueKey == notification.uniqueKey) {

                        switch (notification.uniqueConflictBehavior) {
                            case ToastConflictBehavior.DropThis:
                                return false;
                            case ToastConflictBehavior.DropExisting:
                                this.removeNotification(n);
                                return true;
                            case ToastConflictBehavior.Debounce:
                                // TODO: maybe need?
                                return true;
                        }
                        
                    }
                }
            }
        }
        return true;
    }

    removeNotification(notificationInfo: NotificationViewModel): boolean {
        for (let ss of [ this._persistentSetState, this._transientSetState ]) {
            const idx = ss.collection.indexOf(notificationInfo);
            if (idx != -1) {
                ss.collection.remove(notificationInfo);
                this.onNotificationInfoRemoved(notificationInfo);
                return true;
            }
        }
        return false;
    }
}

export interface INotificationSetState {
    readonly collection: ReadOnlyObservableCollection<NotificationViewModel>;
    scrolledTo: AnchorElementScrollTo | null;
    readonly maximumSize: number;
}

export class NotificationSetState extends ObservableBase implements INotificationSetState {
    @observableProperty
    readonly collection: Collection<NotificationViewModel> = new Collection<NotificationViewModel>();

    @observableProperty
    scrolledTo: AnchorElementScrollTo | null = null;

    @observableProperty
    maximumSize: number = 200;
}

export class NotificationViewModel extends ObservableBase implements IDisposable {
    constructor(
        private readonly session: ActiveLoginViewModel,
        private readonly createArgs: CreateNotificationViewModelArgs) {

        super();
        this.uniqueId = `notif-${ObjectUniqueId.get(this)}`;

        this._buttons = (this.createArgs.buttons ?? []).map(binfo => new NotificationButtonViewModel(session.recentNotifications, this, binfo));
    }

    private _isDisposed: boolean = false;
    get isDisposed() { return this._isDisposed; }
    dispose() {
        if (!this._isDisposed) {
            this._isDisposed = true;

            if (this.createArgs.onClose) {
                this.createArgs.onClose();
            }

            asDisposable(...this._ownedDisposables).dispose();
            this._ownedDisposables = [];
        }
    }
    [Symbol.dispose]() { this.dispose(); }

    private _ownedDisposables: ConvertibleToDisposable[] = [];

    readonly uniqueId: string;

    get uniqueKey(): string | undefined { return this.createArgs.uniqueKey; }
    get uniqueConflictBehavior(): ToastConflictBehavior { return this.createArgs.uniqueConflictBehavior ?? ToastConflictBehavior.DropThis; }

    get isPersistent(): boolean { return this.createArgs.isPersistent; }

    get message(): string { return this.createArgs.message; }

    private _messageBBCode: BBCodeParseResult | null = null;
    get messageBBCode(): BBCodeParseResult {
        if (!this._messageBBCode) {
            this._messageBBCode = ChatBBCodeParser.parse(this.createArgs.message, {
                activeLoginViewModel: this.session,
                appViewModel: this.session.appViewModel,
                addUrlDomains: true,
                eiconsUniqueLoadTag: this.uniqueId,
                imagePreviewPopups: true,
                parseAsStatus: false,
                syncGifs: true,
                sink: this.session.bbcodeSink
            });
            this._ownedDisposables.push(() => {
                this._messageBBCode?.dispose();
                this._messageBBCode = null;
            });
        }
        return this._messageBBCode!;
    }

    private _buttons: NotificationButtonViewModel[];

    get buttons(): NotificationButtonViewModel[] { return this._buttons; }
}
export class NotificationButtonViewModel {
    constructor(
        private readonly notifManager: NotificationManagerViewModel,
        private readonly notif: NotificationViewModel,
        private readonly info: NotificationButtonInfo) {

    }

    get title() { return this.info.title; }

    click() {
        if (this.info.onClick) {
            this.info.onClick({ notification: this.notif, notificationManager: this.notifManager });
        }
    }
}

export interface CreateNotificationViewModelArgs {
    uniqueKey?: string;
    uniqueConflictBehavior?: ToastConflictBehavior;
    
    isPersistent: boolean;

    message: string;

    buttons?: NotificationButtonInfo[];

    onClose?: () => any;
}
export interface NotificationButtonInfo {
    title: string;
    onClick: (args: NotificationButtonClickArgs) => any;
}
export interface NotificationButtonClickArgs {
    readonly notification: NotificationViewModel;
    readonly notificationManager: NotificationManagerViewModel;
}