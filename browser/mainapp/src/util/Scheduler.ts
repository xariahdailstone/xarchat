import { asDisposable, IDisposable } from "./Disposable";
import { Logger, Logging } from "./Logger";
import { StringUtils } from "./StringUtils";

export type RunWhen = "frame" | "nextframe" | "afterframe" | "afternextframe" | "idle" | number;

interface DoublyLinkedListNode<T> {
    readonly item: T;
    previous: DoublyLinkedListNode<T> | null;
    next: DoublyLinkedListNode<T> | null;
}

class DoublyLinkedList<T> {
    private _head: DoublyLinkedListNode<T> | null = null;
    private _tail: DoublyLinkedListNode<T> | null = null;

    any() { return this._head != null; }

    peek() { return this._head ? this._head.item : null; }
    shift() {
        if (this._head) {
            const item = this._head.item;
            this.remove(this._head);
            return item;
        }
        else {
            return null;
        }
    }

    push(item: T): DoublyLinkedListNode<T> {
        const newNode: DoublyLinkedListNode<T> = { item: item, previous: this._tail, next: null };
        if (this._tail) {
            this._tail.next = newNode;
        }
        this._tail = newNode;
        if (!this._head) {
            this._head = newNode;
        }
        return newNode;
    }

    remove(node: DoublyLinkedListNode<T>) {
        if (node.previous) {
            node.previous.next = node.next;
        }
        if (node.next) {
            node.next.previous = node.previous;
        }
        if (node == this._head) {
            this._head = node.next;
        }
        if (node == this._tail) {
            this._tail = node.previous;
        }
        node.previous = null;
        node.next = null;
    }
}

interface TickQueueItem {
    name: string;
    callback: (ms: number) => void;
}
interface CancellableTickQueueItem extends TickQueueItem {
    cancelled: boolean;
}

class SchedulerImpl {
    constructor() {
        this._afterFrameChannel = new MessageChannel();
        this._afterFrameChannel.port1.onmessage = () => { 
            this._afterAnimationFrameTick();
        };

        this._immediateChannel = new MessageChannel();
        this._immediateChannel.port1.onmessage = ev => {
            this._processImmediateMessage(ev.data);
        };
    }

    private readonly _logger: Logger = Logging.createLogger("SchedulerImpl");

    private readonly _afterFrameChannel: MessageChannel;
    private readonly _immediateChannel: MessageChannel;

    private _thisAnimationTickQueue: DoublyLinkedList<TickQueueItem> | null = null;
    private _thisAfterAnimationTickQueue: DoublyLinkedList<TickQueueItem> | null = null;

    private _nextAnimationTickQueue: DoublyLinkedList<TickQueueItem> = new DoublyLinkedList();
    private _nextAfterAnimationTickQueue: DoublyLinkedList<TickQueueItem> = new DoublyLinkedList();

    private _currentRAFHandle: number | null = null;

    private _animationFrameTick(ms: number) {
        this._currentRAFHandle = null;

        const handledMessageNames = new Map<string, number>();
        try {
            this._thisAnimationTickQueue = this._nextAnimationTickQueue;
            this._nextAnimationTickQueue = new DoublyLinkedList();

            if (this._thisAfterAnimationTickQueue == null || !this._thisAfterAnimationTickQueue.any()) {
                this._thisAfterAnimationTickQueue = this._nextAfterAnimationTickQueue;
                this._nextAfterAnimationTickQueue = new DoublyLinkedList();
            }
            else {
                //console.log("thisafterframe queue not clear!")
            }

            while (this._thisAnimationTickQueue.any()) {
                const item = this._thisAnimationTickQueue.shift();
                if (item) {
                    let curCount = handledMessageNames.get(item.name) ?? 0;
                    handledMessageNames.set(item.name, curCount++);
                    if (curCount > 200) {
                        if (curCount == 200) {
                            this._logger.logError(`Named callback "${item.name}" executed 200 times in the same animation tick; deferring to after frame...`);
                        }
                        this.scheduleNamedCallback(item.name, "afterframe", item.callback);
                        continue;
                    }

                    try { item.callback(ms); }
                    catch { }
                }
            }
            if (this._thisAfterAnimationTickQueue.any()) {
                //console.log("need to do afterframe work");
                this._afterFrameChannel.port2.postMessage("");
            }
            else {
                this._thisAfterAnimationTickQueue = null;
            }
            if (this._nextAnimationTickQueue.any() || this._nextAfterAnimationTickQueue.any()) {
                if (!this._currentRAFHandle) {
                    this._currentRAFHandle = window.requestAnimationFrame((ms) => this._animationFrameTick(ms));
                }
            }
        }
        finally {
            this._thisAnimationTickQueue = null;
        }
    }

    private _afterAnimationFrameTick() {
        try {
            // this._thisAfterAnimationTickQueue = this._nextAfterAnimationTickQueue;
            // this._nextAfterAnimationTickQueue = new DoublyLinkedList();

            //console.log("handling afterframe registrations");

            if (this._thisAfterAnimationTickQueue) {
                const now = performance.now();
                while (this._thisAfterAnimationTickQueue.any()) {
                    const item = this._thisAfterAnimationTickQueue.shift();
                    if (item) {
                        try { item.callback(now); }
                        catch { }
                    }
                }
            }

            if (this._nextAnimationTickQueue.any() || this._nextAfterAnimationTickQueue.any()) {
                if (!this._currentRAFHandle) {
                    this._currentRAFHandle = window.requestAnimationFrame((ms) => this._animationFrameTick(ms));
                }
            }
        }
        finally {
            this._thisAfterAnimationTickQueue = null;
        }
    }

    private _nextImmediateMessageId: number = 1;
    private _immediateMessages: Map<number, CancellableTickQueueItem> = new Map();

    private _postImmediateMessage(data: CancellableTickQueueItem) {
        const myImmediateMessageId = this._nextImmediateMessageId++;
        this._immediateMessages.set(myImmediateMessageId, data);
        this._immediateChannel.port2.postMessage(myImmediateMessageId);
        return () => {
            data.cancelled = true;
            this._immediateMessages.delete(myImmediateMessageId);  
        };
    }
    private _processImmediateMessage(messageId: number) {
        try {
            const msg = this._immediateMessages.get(messageId);
            this._immediateMessages.delete(messageId);
            if (msg && !msg.cancelled) {
                msg.cancelled = true;
                msg.callback(performance.now());
            }
        }
        catch { }
    }

    debugNamedCallbacks = false;

    scheduleNamedCallback(name: string, when: (RunWhen | RunWhen[]), callback: (ms: number) => void): IDisposable  {
        return this.multiScheduleCallbackInternal(name, when, callback);
    }

    scheduleCallback(when: (RunWhen | RunWhen[]), callback: (ms: number) => void): IDisposable {
        return this.scheduleNamedCallback("(unnamed callback)", when, callback);
    }

    multiScheduleCallbackInternal(name: string, when: (RunWhen | RunWhen[]), callback: (ms: number) => void): IDisposable {
       let isCancelled = false;

        let cleanup: (() => void);

        const wrappedCallback = (ms: number) => {
            if (!isCancelled) {
                isCancelled = true;
                try {
                    callback(ms);
                }
                catch (e) {
                    // TODO: log the unhandled error
                }
                try { cleanup(); }
                catch { }
            }
        };

        if (Array.isArray(when)) {
            const cancellationActions: (() => void)[] = [];
            for (let twhen of when) {
                const r = this.singleScheduleCallbackInternal(name, twhen, wrappedCallback);
                cancellationActions.push(r);
            }

            cleanup = () => {
                for (let ca of cancellationActions) {
                    try { ca(); }
                    catch { }
                }
            };
        }
        else {
            cleanup = this.singleScheduleCallbackInternal(name, when, wrappedCallback);
        }

        return asDisposable(() => {
            isCancelled = true;
            cleanup();
        });    
    }

    singleScheduleCallbackInternal(name: string, when: RunWhen, callback: (ms: number) => void): () => void {
        switch (when) {
            case "frame":
                {
                    const q = this._thisAnimationTickQueue ?? this._nextAnimationTickQueue;
                    const node = q.push({ name, callback });
                    if (!this._currentRAFHandle && q != this._thisAnimationTickQueue) {
                        this._currentRAFHandle = window.requestAnimationFrame((ms) => this._animationFrameTick(ms));
                    }
                    return () => q.remove(node);
                }
            case "nextframe":
                {
                    const q = this._nextAnimationTickQueue;
                    const node = q.push({ name, callback });
                    if (!this._currentRAFHandle) {
                        this._currentRAFHandle = window.requestAnimationFrame((ms) => this._animationFrameTick(ms));
                    }
                    return () => q.remove(node);
                }
            case "afterframe":
                {
                    const q = this._thisAfterAnimationTickQueue ?? this._nextAfterAnimationTickQueue;
                    const node = q.push({ name, callback });
                    if (!this._currentRAFHandle && q != this._thisAfterAnimationTickQueue) {
                        this._currentRAFHandle = window.requestAnimationFrame((ms) => this._animationFrameTick(ms));
                    }
                    return () => q.remove(node);
                }
            case "afternextframe":
                {
                    const q = this._nextAfterAnimationTickQueue;
                    const node = q.push({ name, callback });
                    if (!this._currentRAFHandle) {
                        this._currentRAFHandle = window.requestAnimationFrame((ms) => this._animationFrameTick(ms));
                    }
                    return () => q.remove(node);
                }
            case "idle":
                {
                    const h = window.requestIdleCallback(() => {
                        const now = performance.now();
                        callback(now);
                    });
                    return () => window.cancelIdleCallback(h);
                }
            default:
                {
                    if (when == 0) {
                        return this._postImmediateMessage({ name, callback, cancelled: false });
                    }
                    else {
                        const h = window.setTimeout(() => {
                            const now = performance.now();
                            callback(now);
                        }, when);
                        return () => window.clearTimeout(h);
                    }
                }
        }
    }
}

export const Scheduler = new SchedulerImpl();
(window as any)["__scheduler"] = Scheduler;