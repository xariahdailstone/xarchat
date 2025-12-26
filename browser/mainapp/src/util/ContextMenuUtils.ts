import { ActiveLoginViewModel } from "../viewmodel/ActiveLoginViewModel";
import { AppViewModel } from "../viewmodel/AppViewModel";
import { ContextMenuPopupItemViewModel, ContextMenuPopupViewModel } from "../viewmodel/popups/ContextMenuPopupViewModel";
import { HostInterop } from "./hostinterop/HostInterop";

export interface ContextMenuItem {
    readonly priority: ContextMenuItemPriority;
    readonly title: string;
    enabled: boolean;
    onSelect: (() => void) | null;
}

export enum ContextMenuItemPriority {
    COPY_LINK = 201,

    SPELLING_SUGGESTIONS = 501,

    UNDO = 901,

    CUT = 1001,
    COPY = 1002,
    COPY_AS_BBCODE = 1003,
    COPY_AS_PLAINTEXT = 1004,
    PASTE = 1005,
    SELECT_ALL = 1006,

    SAVE_IMAGE_AS = 2001,
    COPY_IMAGE = 2002,
    COPY_IMAGE_LINK = 2003,
    COPY_EICON_BBCODE = 2004,

    FAVORITE_THIS_EICON = 4001,
    UNFAVORITE_THIS_EICON = 4002,
    BLOCK_THIS_EICON = 4003,
    UNBLOCK_THIS_EICON = 4004,

    OPEN_DEVTOOLS = 5001,
    RELOAD_INTERFACE = 5002,
}

export class ContextMenuItemBuilder {
    static createCopyLink(linkUrl: string): ContextMenuItem {
        return { priority: ContextMenuItemPriority.COPY_LINK, title: "Copy Link", enabled: true, onSelect: () => {
            navigator.clipboard.writeText(linkUrl);
        }};
    }

    static createSpellingSuggestions(forWord: string): ContextMenuItem {
        return { priority: ContextMenuItemPriority.SPELLING_SUGGESTIONS, title: forWord, enabled: true, onSelect: () => {}};
    }

    static createUndo(onAction: () => void): ContextMenuItem {
        return { priority: ContextMenuItemPriority.UNDO, title: "Undo", enabled: true, onSelect: onAction };
    }

    static createCut(onAction?: () => void): ContextMenuItem {
        return { priority: ContextMenuItemPriority.CUT, title: "Cut", enabled: true, onSelect: onAction ?? (() => { document.execCommand("cut"); }) };
    }

    static createCopy(onAction?: () => void): ContextMenuItem {
        return { priority: ContextMenuItemPriority.COPY, title: "Copy", enabled: true, onSelect: onAction ?? (() => { document.execCommand("copy"); }) };
    }

    static createPaste(onAction?: () => void): ContextMenuItem {
        return { priority: ContextMenuItemPriority.PASTE, title: "Paste", enabled: true, onSelect: onAction ?? (() => { document.execCommand("paste"); }) };
    }

    static createSelectAll(onAction: () => void): ContextMenuItem {
        return { priority: ContextMenuItemPriority.SELECT_ALL, title: "Select All", enabled: true, onSelect: onAction };
    }

    static createSaveImageAs(img: HTMLImageElement): ContextMenuItem {
        return { priority: ContextMenuItemPriority.SAVE_IMAGE_AS, title: "Save Image As...", enabled: true, onSelect: () => { /* TODO */ } };
    }

    static createCopyImage(img: HTMLImageElement): ContextMenuItem {
        return { priority: ContextMenuItemPriority.COPY_IMAGE, title: "Copy Image", enabled: true, onSelect: () => { /* TODO */ } };
    }

    static createCopyImageLink(img: HTMLImageElement): ContextMenuItem {
        return { priority: ContextMenuItemPriority.COPY_IMAGE_LINK, title: "Copy Image Link", enabled: true, 
            onSelect: () => { 
                /* TODO */
            } 
        };
    }

    static createCopyEIconBBCode(eiconName: string): ContextMenuItem {
        return { priority: ContextMenuItemPriority.COPY_IMAGE_LINK, title: "Copy EIcon BBCode", enabled: true,
            onSelect: () => { 
                navigator.clipboard.writeText(`[eicon]${eiconName}[/eicon]`);
            } 
        };
    }

    static createFavoriteThisEIcon(session: ActiveLoginViewModel, eiconName: string): ContextMenuItem {
        return { priority: ContextMenuItemPriority.FAVORITE_THIS_EICON, title: "Favorite this EIcon", enabled: true,
            onSelect: () => { 
                /* TODO */
            } 
        };
    }

    static createBlockThisEIcon(session: ActiveLoginViewModel, eiconName: string): ContextMenuItem {
        return { priority: ContextMenuItemPriority.BLOCK_THIS_EICON, title: "Block this EIcon", enabled: true,
            onSelect: () => { 
                /* TODO */
            } 
        };
    }

    static createOpenDevtools(): ContextMenuItem {
        return { priority: ContextMenuItemPriority.OPEN_DEVTOOLS, title: "Open Dev Tools", enabled: true,
            onSelect: () => { 
                HostInterop.showDevTools();
            } 
        };
    }

    static createReloadInterface(): ContextMenuItem {
        return { priority: ContextMenuItemPriority.OPEN_DEVTOOLS, title: "Reload Interface", enabled: true,
            onSelect: () => { 
                window.location.reload();
            } 
        };
    }
}

export class ContextMenuUtils {
    private static _items: ContextMenuItem[] = [];
    private static _defaultPrevented: boolean = false;

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
        return item;
    }

    static removeByPriority(priority: ContextMenuItemPriority) {
        this._items = this._items.filter(i => i.priority != priority);
    }

    static get hasMenuItems() {
        return this._items.length > 0;
    }

    static addShadowRootHandler(root: ShadowRoot) {
        root.addEventListener("contextmenu", (e: PointerEvent) => {
            const target = e.target;
            if (target instanceof HTMLImageElement) {
                ContextMenuUtils.add(ContextMenuItemBuilder.createSaveImageAs(target));
                ContextMenuUtils.add(ContextMenuItemBuilder.createCopyImage(target));
                ContextMenuUtils.add(ContextMenuItemBuilder.createCopyImageLink(target));
            }
            else if (target instanceof HTMLAnchorElement && target.href) {
                ContextMenuUtils.add(ContextMenuItemBuilder.createCopyLink(target.href));
            }
            else if ((target instanceof HTMLInputElement && target.type == "text") || (target instanceof HTMLTextAreaElement)) {
                ContextMenuUtils.removeByPriority(ContextMenuItemPriority.COPY);
                // TODO: handle undo
                // TODO: handle spelling corrections
                const canCutCopy = target.selectionStart != target.selectionEnd;
                // TODO: handle canPaste
                const canPaste = true;
                const canSelectAll = target.value != "";
                ContextMenuUtils.add(ContextMenuItemBuilder.createCut()).enabled = canCutCopy;
                ContextMenuUtils.add(ContextMenuItemBuilder.createCopy()).enabled = canCutCopy;
                ContextMenuUtils.add(ContextMenuItemBuilder.createPaste()).enabled = canPaste;
                ContextMenuUtils.add(ContextMenuItemBuilder.createSelectAll(() => { target.select(); })).enabled = canSelectAll;
            }
        }, true);
    }

    static async makePopupViewModelAsync(vm: AppViewModel, x: number, y: number): Promise<ContextMenuPopupViewModel<() => void>> {
        const popupvm = new ContextMenuPopupViewModel<() => void>(vm, new DOMRect(x, y, 1, 1));

        this._items.sort();
        let lastGroup = -1;
        for (let item of this._items) {
            const thisGroup = Math.floor(item.priority / 100);
            if (lastGroup != -1 && thisGroup != lastGroup) {
                const titem = new ContextMenuPopupItemViewModel<() => void>("-", () => { }, false);
                popupvm.items.add(titem);
            }
            lastGroup = thisGroup;

            // TODO: handle spelling suggestions
            const titem = new ContextMenuPopupItemViewModel<() => void>(
                item.title,
                () => {
                    if (item.enabled) {
                        if (item.onSelect) {
                            item.onSelect();
                        }
                    }
                }, 
                item.onSelect != null);
            titem.enabled = item.enabled;
            popupvm.items.add(titem);
        }

        popupvm.onValueSelected = (func) => {
            popupvm.dismissed();
            func();
        }

        return popupvm;
    }
}