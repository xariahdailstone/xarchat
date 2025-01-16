import { EIconSearchDialogViewModel } from "../../viewmodel/dialogs/EIconSearchDialogViewModel";
import { ComponentBase, componentArea, componentElement } from "../ComponentBase";
import { DialogBorderType, DialogComponentBase, dialogViewFor } from "./DialogFrame";
import { ContextPopupBase } from "../popups/ContextPopupBase";
import { URLUtils } from "../../util/URLUtils";
import { KeyCodes } from "../../util/KeyCodes";
import { setupTooltipHandling } from "../../viewmodel/popups/TooltipPopupViewModel";
import { SnapshottableSet } from "../../util/collections/SnapshottableSet";
import { HTMLUtils } from "../../util/HTMLUtils";
import { HostInterop } from "../../util/HostInterop";
import { EIconUtils } from "../../util/EIconUtils";

@componentArea("dialogs")
@componentElement("x-eiconsearchdialog")
@dialogViewFor(EIconSearchDialogViewModel)
export class EIconSearchDialog extends DialogComponentBase<EIconSearchDialogViewModel> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <div class="searchbar-container">
                <div class="searchbar-label">Search:</div>
                <input class="theme-textbox searchbar-textbox" id="elTextbox" autocomplete="new-password" />
            </div>
            <div class="resultdisplay-container" id="elResultDisplayContainer">
                <input class="keyboardnavtextbox" id="elKeyboardNavTextbox" />
                <div class="resultdisplay-issearching">
                    <div class="resultdisplay-issearching-text">Searching...</div>
                </div>
                <div class="resultdisplay-innercontainer" id="elResultDisplayInnerContainer">
                    <x-eiconsetview class="resultdisplay-setview" id="elSetView"></x-eiconsetview>
                </div>
            </div>
        `);

        const elTextbox = this.$("elTextbox") as HTMLInputElement;
        const elKeyboardNavTextbox = this.$("elKeyboardNavTextbox") as HTMLInputElement;
        const elResultDisplayContainer = this.$("elResultDisplayContainer") as HTMLDivElement;
        const elResultDisplayInnerContainer = this.$("elResultDisplayInnerContainer") as HTMLDivElement;
        const elSetView = this.$("elSetView") as EIconSetView;

        const bindTextToModel = () => {
            const txt = elTextbox.value;
            if (this.viewModel) {
                this.viewModel.searchText = txt;
            }
        };

        elTextbox.addEventListener("change", bindTextToModel);
        elTextbox.addEventListener("input", bindTextToModel);
        this.watchExpr(vm => vm.searchText, searchText => {
            searchText = searchText ?? "";
            if (searchText != elTextbox.value) {
                elTextbox.value = searchText;
            }
        });

        this.watchExpr(vm => vm.isSearching, isSearching => {
            isSearching = isSearching ?? false;
            elResultDisplayContainer.classList.toggle("is-searching", isSearching);
            if (!isSearching) {
                elResultDisplayInnerContainer.scrollTo(0, 0);
                elSetView.refreshDisplayImmediately();
            }
        });

        this.watchExpr(vm => vm.currentKeyboardSelectedEIcon, selEicon => {
            if (selEicon == null) {
                elKeyboardNavTextbox.disabled = true;
                if (this.viewModel && !this.viewModel.closed) {
                    elTextbox.focus();
                }
            }
            else {
                elKeyboardNavTextbox.disabled = false;
                elKeyboardNavTextbox.focus();
            }
        });

        elTextbox.addEventListener("keydown", (e) => {
            if (this.viewModel) {
                if (e.keyCode == KeyCodes.RETURN) {
                    this.viewModel.confirmEntry();
                    e.preventDefault();
                    return true;
                }
                if (e.keyCode == KeyCodes.DOWN_ARROW) {
                    if (!this.viewModel.isSearching) {
                        elSetView.setKeyboardSelectionTo(0);
                    }
                }
            }

            return false;
        });
        elKeyboardNavTextbox.addEventListener("keydown", (e) => {
            if (this.viewModel) {
                if (e.keyCode == KeyCodes.UP_ARROW) {
                    //this.logger.logDebug("up");
                    elSetView.moveKeyboardSelectionUp();
                }
                else if (e.keyCode == KeyCodes.LEFT_ARROW) {
                    //this.logger.logDebug("left");
                    elSetView.moveKeyboardSelectionLeft();
                }
                else if (e.keyCode == KeyCodes.RIGHT_ARROW) {
                    //this.logger.logDebug("right");
                    elSetView.moveKeyboardSelectionRight();
                }
                else if (e.keyCode == KeyCodes.DOWN_ARROW) {
                    //this.logger.logDebug("down");
                    elSetView.moveKeyboardSelectionDown();
                }
                else if (e.keyCode == KeyCodes.RETURN) {
                    //this.logger.logDebug("return");
                    elSetView.confirmKeyboardSelection();
                }
            }
            if (e.keyCode == KeyCodes.TAB) {
                return false;
            }

            e.preventDefault();
            return true;
        });
        elKeyboardNavTextbox.addEventListener("focusout", () => {
            elSetView.setKeyboardSelectionTo(null);
        });

        this.$("elSetView")?.addEventListener("eiconselected", (e) => {
            const eiconName = (e as any).eiconName;
            this.viewModel?.close(eiconName);
        });
    }

    override get dialogBorderType(): DialogBorderType { return DialogBorderType.RIGHTPANE; }

    override onShown(): void {
        //this.logger.logDebug("trying to focus textbox");
        const elTextbox = this.$("elTextbox");
        if (elTextbox) {
            elTextbox.focus();
        }
    }
}


const EICON_WIDTH = 100;
const EICON_HEIGHT = 100;
const EICON_GAP = 6;

@componentArea("dialogs")
@componentElement("x-eiconsetview")
export class EIconSetView extends ComponentBase<EIconSearchDialogViewModel> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <div id="elVisibleIconsContainer">
                <div id="elBeforeSentinel"></div>
                <div id="elAfterSentinel"></div>
            </div>
            <div id="elTopIndicator">top</div>
            <div id="elBottomIndicator">bot</div>
        `);

        this.watchExpr(vm => vm.searchResultCount, iconCount => {
            this.recalculateDisplay(true);
        });

        this.elMain.addEventListener("scroll", () => {
            //this.logger.logDebug("ev elMain scroll fired");
            this.recalculateDisplay(false);
        });

        this.whenConnectedWithViewModel(vm => {
            return setupTooltipHandling(this._sroot, vm.parent);
        });
    }

    private _resizeObserver: ResizeObserver | null = null;
    private _intersectionObserver: IntersectionObserver | null = null;

    protected override connectedToDocument(): void {
        this._resizeObserver = new ResizeObserver(entries => { /* this.logger.logDebug("ev ro fired"); */ this.recalculateDisplay(false); });
        this._resizeObserver.observe(this);

        this._intersectionObserver = new IntersectionObserver(entries => { /* this.logger.logDebug("ev io fired"); */ this.recalculateDisplay(false); }, {
            threshold: [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]
        });
        this._intersectionObserver.observe(this.$("elBeforeSentinel") as HTMLDivElement);
        this._intersectionObserver.observe(this.$("elAfterSentinel") as HTMLDivElement);
    }

    protected override disconnectedFromDocument(): void {
        this._intersectionObserver?.disconnect();
        this._intersectionObserver = null;

        this._resizeObserver?.disconnect();
        this._resizeObserver = null;
    }

    refreshDisplayImmediately() {
        this.recalculateDisplay(true);
    }

    private _recalcRequested = false;
    private _delayedRecalcTimer: number | null = null;
    private recalculateDisplay(immediately: boolean) {
        if (this._delayedRecalcTimer != null) {
            window.clearTimeout(this._delayedRecalcTimer);
            this._delayedRecalcTimer = null;
        }

        if (immediately) {
            if (!this._recalcRequested) {
                this._recalcRequested = true;
                window.requestAnimationFrame(() => {
                    this._recalcRequested = false;
                    this.recalculateDisplayInner();
                });
            }
        }
        else {
            this._delayedRecalcTimer = window.setTimeout(() => { 
                this._delayedRecalcTimer = null;
                this.recalculateDisplay(true); 
            }, 500);
        }
    }

    private _recalculatingDisplay: boolean = false;
    private recalculateDisplayInner() {
        if (this._recalculatingDisplay || !this.connectedToDocument) { return; }
        this._recalculatingDisplay = true;
        try {
            const elBeforeSentinel = this.$("elBeforeSentinel") as HTMLDivElement;
            const elAfterSentinel = this.$("elAfterSentinel") as HTMLDivElement;
            const elVisibleIconsContainer = this.$("elVisibleIconsContainer") as HTMLDivElement;

            const elTopIndicator = this.$("elTopIndicator") as HTMLDivElement;
            const elBottomIndicator = this.$("elBottomIndicator") as HTMLDivElement;

            const displayMetrics = this.determineMetrics(elVisibleIconsContainer);
            this._currentCalculatedDisplayMetrics = displayMetrics;
            elVisibleIconsContainer.style.height = `${displayMetrics.neededYHeight}px`;

            const vicBoundingRect = elVisibleIconsContainer.getBoundingClientRect();
            //this.logger.logDebug("vicBoundingRect", vicBoundingRect);
            const startAtYPixel = 0 - Math.min(0, vicBoundingRect.top);
            const endAtYPixel = Math.min(vicBoundingRect.bottom, window.innerHeight) - vicBoundingRect.top;

            elBeforeSentinel.style.top = "0px";
            elBeforeSentinel.style.height = `${startAtYPixel - 1}px`;
            elAfterSentinel.style.top = `${endAtYPixel + 1}px`;
            elAfterSentinel.style.height = `${displayMetrics.neededYHeight - (endAtYPixel + 1)}px`;

            elTopIndicator.style.top = `${startAtYPixel}px`;
            elBottomIndicator.style.top = `${endAtYPixel - 1 - elBottomIndicator.offsetHeight}px`;

            const rawStartAtRow = Math.floor(startAtYPixel / (EICON_HEIGHT + EICON_GAP));
            const rawEndAtRow = Math.ceil(endAtYPixel / (EICON_HEIGHT + EICON_GAP));

            const actuallyVisibleRowCount = Math.max(1, rawEndAtRow - rawStartAtRow);

            const effectiveStartAtRow = Math.max(0, rawStartAtRow - actuallyVisibleRowCount);
            const effectiveEndAtRow = Math.min(displayMetrics.rowCount, rawEndAtRow + actuallyVisibleRowCount);

            //this.logger.logDebug(`eicons visible on rows ${effectiveStartAtRow} to ${effectiveEndAtRow}`);

            this.setVisibleEIcons(displayMetrics, (effectiveStartAtRow * displayMetrics.iconsPerRow), ((effectiveEndAtRow + 1) * displayMetrics.iconsPerRow));
        }
        finally {
            this._recalculatingDisplay = false;
        }
    }

    private _currentVisibleIcons: SnapshottableSet<CurrentVisibleIconInfo> = new SnapshottableSet();
    private _currentCalculatedDisplayMetrics: CalculatedDisplayMetrics | null = null;

    private _currentSetVisibleKey: object = {};
    private async setVisibleEIcons(displayMetrics: CalculatedDisplayMetrics, startAt: number, endAt: number) {
        const elVisibleIconsContainer = this.$("elVisibleIconsContainer") as HTMLDivElement;

        const myKey = {};
        this._currentSetVisibleKey = myKey;

        const getIconXY = (idx: number) => {
            const onRow = Math.floor(idx / displayMetrics.iconsPerRow);
            const atCol = idx - (onRow * displayMetrics.iconsPerRow);

            return { x: atCol * (EICON_WIDTH + EICON_GAP) + displayMetrics.rowStartsAtX, y: onRow * (EICON_HEIGHT + EICON_GAP) };
        };

        const iconCount = endAt - startAt;
        const results = (await this.viewModel?.getSearchResultsAsync(startAt, iconCount)) ?? [];
        const curKeyboardSelResult = this._keyboardSelectionIndex != null ?
            (await this.viewModel?.getSearchResultsAsync(this._keyboardSelectionIndex, 1)) ?? [] : [];

        if (myKey !== this._currentSetVisibleKey) { return; }

        if (curKeyboardSelResult.length > 0 && this.viewModel) {
            this.viewModel.currentKeyboardSelectedEIcon = curKeyboardSelResult[0].eiconName;
        }
        else if (this.viewModel) {
            this.viewModel.currentKeyboardSelectedEIcon = null;
        }

        const getEIconBySearchIndex = (idx: number) => {
            if (idx >= startAt && idx < endAt) {
                const ridx = idx - startAt;
                if (ridx < results.length) {
                    return results[ridx].eiconName;
                }
                else {
                    return "";
                }
            }
            else if (idx == this._keyboardSelectionIndex) {
                if (curKeyboardSelResult.length > 0) {
                    return curKeyboardSelResult[0].eiconName;
                }
                else {
                    return "";
                }
            }
            else {
                return "";
            }
        }

        const iconsToMake = new Set<number>();
        for (let idx = 0; idx < iconCount; idx++) {
            iconsToMake.add(startAt + idx);
        }
        if (this._keyboardSelectionIndex != null) {
            iconsToMake.add(this._keyboardSelectionIndex!);
        }

        this._currentVisibleIcons.forEachValueSnapshotted(curVisibleIcon => {
            if (curVisibleIcon.eiconIndex < startAt || curVisibleIcon.eiconIndex > endAt) {
                this._currentVisibleIcons.delete(curVisibleIcon);
                curVisibleIcon.eiconElement.remove();
            }
            else {
                const shouldBeEIcon = getEIconBySearchIndex(curVisibleIcon.eiconIndex);
                if (curVisibleIcon.eiconName == shouldBeEIcon) {
                    iconsToMake.delete(curVisibleIcon.eiconIndex);
                    const iconXy = getIconXY(curVisibleIcon.eiconIndex);
                    curVisibleIcon.eiconElement.style.top = `${iconXy.y}px`;
                    curVisibleIcon.eiconElement.style.left = `${iconXy.x}px`;
                }
                else {
                    this._currentVisibleIcons.delete(curVisibleIcon);
                    curVisibleIcon.eiconElement.remove();
                }
            }
        });
        
        for (let idxToMake of iconsToMake.values()) {
            const eiconName = getEIconBySearchIndex(idxToMake);

            let element: HTMLElement;
            if (eiconName != "") {
                element = document.createElement("img");
                element.classList.add("bbcode-eicon-loading");
                element.addEventListener("load", () => {
                    element.classList.remove("bbcode-eicon-loading");
                    EIconUtils.getAndSubmitEIconMetadata(eiconName);
                });
                element.addEventListener("error", () => {
                    element.classList.remove("bbcode-eicon-loading");
                    element.classList.remove("bbcode-eicon-failedtoload");
                });
                (element as HTMLImageElement).src = URLUtils.getEIconUrl(eiconName);
                element.classList.add("eicon");
                element.setAttribute("data-index", idxToMake.toString());
                element.setAttribute("data-tooltip", eiconName);
                element.addEventListener("click", () => {
                    const evt = new Event("eiconselected");
                    (evt as any).eiconName = eiconName;
                    this.dispatchEvent(evt);
                });
            }
            else {
                element = document.createElement("div");
                element.classList.add("eicon-placeholder");
            }

            const iconXy = getIconXY(idxToMake);
            element.style.top = `${iconXy.y}px`;
            element.style.left = `${iconXy.x}px`;
            element.style.width = `${EICON_WIDTH}px`;
            element.style.height = `${EICON_HEIGHT}px`;

            elVisibleIconsContainer.appendChild(element);
            this._currentVisibleIcons.add({
                eiconElement: element,
                eiconName: eiconName,
                eiconIndex: idxToMake
            });
        }

        if (this._keyboardSelectionIndex != null) {
            const xy = getIconXY(this._keyboardSelectionIndex);
            if (!this._keyboardSelectionIndicatorEl) {
                const newEl = document.createElement("div");
                newEl.classList.add("keyboard-selection-indicator");
                elVisibleIconsContainer.appendChild(newEl);
                this._keyboardSelectionIndicatorEl = newEl;
            }
            this._keyboardSelectionIndicatorEl.style.left = (xy.x - 3) + "px";
            this._keyboardSelectionIndicatorEl.style.top = (xy.y - 3) + "px";

            if (this._scrollToKeyboardSelection) {
                this._scrollToKeyboardSelection = false;
                try {
                    (this._keyboardSelectionIndicatorEl as any).scrollIntoViewIfNeeded(false);
                }
                catch { }
            }
        }
        else {
            if (this._keyboardSelectionIndicatorEl) {
                this._keyboardSelectionIndicatorEl.remove();
                this._keyboardSelectionIndicatorEl = null;
            }
        }
    }

    private _keyboardSelectionIndicatorEl: HTMLDivElement | null = null;

    private determineMetrics(elVisibleIconsContainer: HTMLDivElement): CalculatedDisplayMetrics {
        let remainingWidth = elVisibleIconsContainer.clientWidth;
        let rowWidth = 0;

        do {
            remainingWidth -= (EICON_WIDTH + EICON_GAP);
            rowWidth++;
        } while (remainingWidth > EICON_WIDTH);

        const consumedWidth = (rowWidth * EICON_WIDTH) + ((rowWidth - 1) * EICON_GAP);
        const unusedWidth = Math.max(0, elVisibleIconsContainer.clientWidth - consumedWidth);

        const eiconCount = (this.viewModel?.searchResultCount ?? 0);
        const eiconRowCount = Math.ceil(eiconCount / rowWidth);

        const result = {
            iconsPerRow: rowWidth,
            rowStartsAtX: Math.floor(unusedWidth / 2),
            neededYHeight: (eiconRowCount * EICON_HEIGHT) + (Math.max(0, eiconRowCount - 1) * EICON_GAP),
            rowCount: eiconRowCount
        };
        //this.logger.logDebug("displayMetrics", result);
        return result;
    }

    private _keyboardSelectionIndex: number | null = null;
    private _scrollToKeyboardSelection: boolean = false;

    setKeyboardSelectionTo(index: number | null) {
        if (index != this._keyboardSelectionIndex) {
            this._keyboardSelectionIndex = index;
            this._scrollToKeyboardSelection = true;
            //this.logger.logDebug("keyboardSelectionIndex", index);
            this.recalculateDisplay(true);
        }
    }

    private getCurrentKeyboardPos(): ({ x: number, y: number, maxX: number, maxY: number } | null) {
        if (this._currentCalculatedDisplayMetrics && this._keyboardSelectionIndex != null) {
            const ccd = this._currentCalculatedDisplayMetrics;
            const curRow = Math.floor(this._keyboardSelectionIndex / ccd.iconsPerRow);
            const curCol = this._keyboardSelectionIndex - (curRow * ccd.iconsPerRow);
            return { x: curCol, y: curRow, maxX: ccd.iconsPerRow, maxY: ccd.rowCount };
        }
        else {
            return null;
        }
    }

    private setCurrentKeyboardPos(newPos: { x: number, y: number }) {
        if (this._currentCalculatedDisplayMetrics) {
            const eiconCount = (this.viewModel?.searchResultCount ?? 0);
            const ccd = this._currentCalculatedDisplayMetrics;
            const newIndex = (newPos.y * ccd.iconsPerRow) + newPos.x;
            if (newIndex < eiconCount) {
                this.setKeyboardSelectionTo(newIndex);
            }
        }
    }

    moveKeyboardSelectionUp() {
        if (this._currentCalculatedDisplayMetrics && this._keyboardSelectionIndex != null) {
            const curPos = this.getCurrentKeyboardPos()!;
            if (curPos.y == 0) {
                this.setKeyboardSelectionTo(null);
            }
            else {
                curPos.y = curPos.y - 1;
                this.setCurrentKeyboardPos(curPos);
            }
        }
    }

    moveKeyboardSelectionLeft() {
        if (this._currentCalculatedDisplayMetrics && this._keyboardSelectionIndex != null) {
            const curPos = this.getCurrentKeyboardPos()!;
            if (curPos.x > 0) {
                curPos.x = curPos.x - 1;
                this.setCurrentKeyboardPos(curPos);
            }
        }    }

    moveKeyboardSelectionRight() {
        if (this._currentCalculatedDisplayMetrics && this._keyboardSelectionIndex != null) {
            const curPos = this.getCurrentKeyboardPos()!;
            if (curPos.x < curPos.maxX) {
                curPos.x = curPos.x + 1;
                this.setCurrentKeyboardPos(curPos);
            }
        }
    }

    moveKeyboardSelectionDown() {
        if (this._currentCalculatedDisplayMetrics && this._keyboardSelectionIndex != null) {
            const curPos = this.getCurrentKeyboardPos()!;
            if (curPos.y < curPos.maxY) {
                curPos.y = curPos.y + 1;
                this.setCurrentKeyboardPos(curPos);
            }
        }
    }

    confirmKeyboardSelection() {
        if (this.viewModel) {
            this.viewModel.confirmKeyboardEntry();
        }
        // TODO:
    }
}

interface CurrentVisibleIconInfo {
    eiconIndex: number;
    eiconName: string;
    eiconElement: HTMLElement;
}

interface CalculatedDisplayMetrics {
    iconsPerRow: number;
    rowStartsAtX: number;
    neededYHeight: number;
    rowCount: number;
}