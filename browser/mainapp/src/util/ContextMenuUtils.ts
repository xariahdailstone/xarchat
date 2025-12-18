
export interface ContextMenuItem {
    title: string;
    onSelect: (() => void) | null;
}

export class ContextMenuUtils {
    static _items: ContextMenuItem[] = [];
    static _defaultPrevented: boolean = false;

    static clear() {
        this._items = [];
        this._defaultPrevented = false;
    }

    static preventDefault(ev: MouseEvent) {
        ev.preventDefault();
        this._defaultPrevented = true;
        console.log("context menu prevented");
    }

    static get defaultPrevented() { return this._defaultPrevented; }

    static add(item: ContextMenuItem) {
        this._items.push(item);
    }

    static addSeparator() {
        this.add({ title: "-", onSelect: null });
    }

    static get items() {
        return this._items;
    }

    static addDefaultContextMenuItems(ev: MouseEvent) {
        if (ev.target instanceof HTMLImageElement) {
            this.add({ title: "Save Image As...", onSelect: () => {} });
            this.add({ title: "Copy Image", onSelect: () => {} });
            this.add({ title: "Copy Image Link", onSelect: () => {} });
        }
    }
}