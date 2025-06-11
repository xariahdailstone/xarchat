import { IDisposable } from "./Disposable";
import { Logger, Logging } from "./Logger";
import { ObjectUniqueId } from "./ObjectUniqueId";

export interface AutohideElementsManagerOptions {
    name: string;
    rootEl: HTMLElement;
    includePredicate: (element: HTMLElement) => boolean;
    watchAttributes?: string[] | null,
    intersectionMargin?: string,
    handleActiveSelection?: boolean
}

export class AutohideElementsManager implements IDisposable {
    constructor(
        options: AutohideElementsManagerOptions) {

        const name = this.name = options.name;
        const rootEl = this.rootEl = options.rootEl;
        const includePredicate = this.includePredicate = options.includePredicate;
        const watchAttributes = this.watchAttributes = options.watchAttributes ?? null;
        this.handleActiveSelection = options.handleActiveSelection ?? false;

        this._logger = Logging.createLogger(`AutohideElementsManager#${ObjectUniqueId.get(this)}-${name}`);

        try {
            this._io = new IntersectionObserver(entries => this.processIntersectionChange(entries), {
                root: rootEl,
                rootMargin: options.intersectionMargin ? options.intersectionMargin : "0px 0px 0px 0px"
            });
            this._mo = new MutationObserver(entries => this.processSubtreeChange(entries));
            this._mo.observe(rootEl, { 
                subtree: true,
                childList: true,
                attributes: watchAttributes != null && watchAttributes.length > 0,
                attributeFilter: (watchAttributes?.length ?? 0) > 0 ? (watchAttributes ?? undefined) : undefined
            });

            const initElCount = this.maybeAdd(rootEl);
            this._logger.logInfo(`Initialized with ${initElCount} elements`);
            this.rootEl.setAttribute("data-autohidehost", "true");
        }
        catch (e) {
            this._io = null!;
            this._mo = null!;
            this._logger.logError("Failed to initialize", e);
        }
    }

    private _logger: Logger;

    readonly name: string;
    readonly rootEl: HTMLElement;
    readonly includePredicate: (element: HTMLElement) => boolean;
    readonly watchAttributes?: string[] | null
    readonly handleActiveSelection: boolean;

    private _observedElements: Set<HTMLElement> = new Set();

    private maybeAdd(el: HTMLElement): number {
        let result = 0;
        if (!this._observedElements.has(el) && this.includePredicate(el)) {
            this.addElement(el);
            result++;
        }
        for (var i = 0; i < el.children.length; i++) {
            const n = el.children.item(i);
            if (n instanceof HTMLElement) {
                result += this.maybeAdd(n);
            }
        }
        return result;
    }
    private addElement(el: HTMLElement) {
        this._io.observe(el);
        this._observedElements.add(el);
        el.setAttribute("data-autohiding", "true");
    }

    private removeElement(el: HTMLElement): number {
        let result = 0;
        if (this._observedElements.has(el)) {
            this._io.unobserve(el);
            this._observedElements.delete(el);
            el.removeAttribute("data-autohiding");
            result++;
        }
        for (var i = 0; i < el.children.length; i++) {
            const n = el.children.item(i);
            if (n instanceof HTMLElement) {
                result += this.removeElement(n);
            }
        }
        return result;
    }

    private _io: IntersectionObserver;
    private _mo: MutationObserver;

    private _isDisposed = false;
    get isDisposed(): boolean { return this._isDisposed; }

    dispose(): void {
        if (!this._isDisposed) {
            this._isDisposed = true;

            const el = this.rootEl;

            el.removeAttribute("data-autohidehost");
            const oes = [...this._observedElements.values()];
            oes.forEach(oe => {
                this.removeElement(oe);
            })
            this._logger.logInfo(`Disposed with ${oes.length} elements`);

            this._io.disconnect();
        }
    }

    [Symbol.dispose](): void {
        this.dispose();
    }

    private processSubtreeChange(entries: MutationRecord[]) {
        let addCount = 0;
        let removeCount = 0;
        for (let entry of entries) {
            if (entry.type == "childList") {
                entry.removedNodes.forEach(n => {
                    if (n instanceof HTMLElement) {
                        removeCount += this.removeElement(n);
                    }
                });
                entry.addedNodes.forEach(n => {
                    if (n instanceof HTMLElement) {
                        addCount += this.maybeAdd(n);
                    }
                });
            }
            else if (entry.type == "attributes") {
                if (entry.target instanceof HTMLElement) {
                    const targetEl = entry.target;
                    const isAlreadyObserving = this._observedElements.has(targetEl);
                    const isMatch = this.includePredicate(targetEl);
                    if (isMatch && !isAlreadyObserving) {
                        this.addElement(targetEl);
                    }
                    else if (!isMatch && isAlreadyObserving) {
                        this.removeElement(targetEl);
                    }
                }
            }
        }
        if (addCount > 0) {
            this._logger.logInfo(`Added ${addCount} elements`);
        }
        if (addCount > 0) {
            this._logger.logInfo(`Removed ${removeCount} elements`);
        }
        this._logger.logInfo(`Processed ${entries.length} mutation entries`);
    }

    private processIntersectionChange(entries: IntersectionObserverEntry[]) {
        const winSel = this.handleActiveSelection ? window.getSelection() : null;
        const nodeContainsAnySelection = this.handleActiveSelection 
            ? (n: Node) => {
                if (winSel?.containsNode(n)) { return true; }
                const childNodes = n.childNodes;
                for (let i = 0; i < childNodes.length; i++) {
                    const cn = childNodes.item(i);
                    if (nodeContainsAnySelection(cn)) { return true; }
                }
                return false;
            } 
            : (e: Node) => false;

        for (let entry of entries) {
            const el = entry.target;
            if (el instanceof HTMLElement) {
                el.style.visibility = (entry.isIntersecting || nodeContainsAnySelection(el)) ? "visible" : "hidden";
            }
        }
    }
}