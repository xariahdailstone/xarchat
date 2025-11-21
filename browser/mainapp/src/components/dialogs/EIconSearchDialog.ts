import { EIconResultSet, EIconSearchDialogViewModel, EIconSearchStatus } from "../../viewmodel/dialogs/EIconSearchDialogViewModel";
import { ComponentBase, componentArea, componentElement } from "../ComponentBase";
import { DialogBorderType, DialogComponentBase, dialogViewFor } from "./DialogFrame";
import { ContextPopupBase } from "../popups/ContextPopupBase";
import { URLUtils } from "../../util/URLUtils";
import { KeyCodes } from "../../util/KeyCodes";
import { setupTooltipHandling } from "../../viewmodel/popups/TooltipPopupViewModel";
import { SnapshottableSet } from "../../util/collections/SnapshottableSet";
import { HTMLUtils } from "../../util/HTMLUtils";
import { HostInterop } from "../../util/hostinterop/HostInterop";
import { EIconUtils } from "../../util/EIconUtils";
import { EventListenerUtil } from "../../util/EventListenerUtil";
import { asDisposable, IDisposable } from "../../util/Disposable";
import { Logger } from "../../util/Logger";
import { Scheduler } from "../../util/Scheduler";

type MoveNavResultUpDown = { accepted: false } | { accepted: true, exitedAtColumn?: number };
type MoveNavResultLeftRight = { accepted: false } | { accepted: true, exited: boolean };
type ConfirmSelectionResult = { accepted: false } | { accepted: true, eiconName: string };

interface KeyboardNavParticipant {
    moveNavDown(): MoveNavResultUpDown;
    moveNavUp(): MoveNavResultUpDown;
    moveNavLeft(): MoveNavResultLeftRight;
    moveNavRight(): MoveNavResultLeftRight;

    acceptNavFromAbove(column: number): MoveNavResultUpDown;
    acceptNavFromBelow(column: number): MoveNavResultUpDown;
    acceptNavFromLeft(): MoveNavResultLeftRight;
    acceptNavFromRight(): MoveNavResultLeftRight;

    confirmKeyboardSelection(): ConfirmSelectionResult;
    exit(): void;
}

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
                <div class="resultdisplay-issearching">
                    <div class="resultdisplay-issearching-text">Searching...</div>
                </div>
                <div class="resultdisplay-welcomepage" id="elResultDisplayEmptyResults">
                    <div class="resultdisplay-welcome">
                        Enter your search criteria above, or choose from your favorite, most used, or recently used
                        eicons below.
                    </div>

                    <div class="resultdisplay-sectiontitle">Your Favorite EIcons</div>
                    <div class="resultdisplay-sectioncontents">
                        <div class="resultdisplay-hint" id="elFavoriteSetViewHint">
                            You haven't marked any eicons as favorites.  Right-click an eicon image to favorite/unfavorite it.
                        </div>
                        <x-eiconsetview class="resultdisplay-setview" id="elFavoriteSetView" updatefast="true" maxrows="2"></x-eiconsetview>
                    </div>

                    <div class="resultdisplay-sectiontitle">Your Recently Used EIcons</div>
                    <div class="resultdisplay-sectioncontents">
                        <div class="resultdisplay-hint" id="elRecentlyUsedSetViewHint">
                            No eicons seen yet.  As you use eicons in chat, your most recently used eicons will be displayed here.
                        </div>
                        <x-eiconsetview class="resultdisplay-setview" id="elRecentlyUsedSetView" updatefast="true" maxrows="2"></x-eiconsetview>
                    </div>

                    <div class="resultdisplay-sectiontitle">Your Most Used EIcons</div>
                    <div class="resultdisplay-sectioncontents">
                        <div class="resultdisplay-hint" id="elMostUsedSetViewHint">
                            No eicons seen yet.  As you use eicons in chat, your most used eicons will be displayed here.
                        </div>
                        <x-eiconsetview class="resultdisplay-setview" id="elMostUsedSetView" updatefast="true" maxrows="2"></x-eiconsetview>
                    </div>
                </div>
                <div class="resultdisplay-innercontainer" id="elResultDisplayInnerContainer">
                    <div class="resultdisplay-sectiontitle">Search Results</div>
                    <x-eiconsetview class="resultdisplay-setview" id="elSetView"></x-eiconsetview>
                </div>
                <div class="resultdisplay-noresults" id="elResultDisplayInnerContainer">
                    <div class="resultdisplay-sectiontitle">Search Results</div>
                    <div class="resultdisplay-noresultstext">
                        No results found :(
                    </div>
                </div>
            </div>
        `);

        const elTextbox = this.$("elTextbox") as HTMLInputElement;
        //const elKeyboardNavTextbox = this.$("elKeyboardNavTextbox") as HTMLInputElement;
        const elResultDisplayContainer = this.$("elResultDisplayContainer") as HTMLDivElement;
        const elResultDisplayEmptyResults = this.$("elResultDisplayEmptyResults") as HTMLDivElement;
        const elResultDisplayInnerContainer = this.$("elResultDisplayInnerContainer") as HTMLDivElement;
        const elSetView = this.$("elSetView") as EIconSetView;
        const elFavoriteSetView = this.$("elFavoriteSetView") as EIconSetView;
        const elRecentlyUsedSetView = this.$("elRecentlyUsedSetView") as EIconSetView;
        const elMostUsedSetView = this.$("elMostUsedSetView") as EIconSetView;

        const elFavoriteSetViewHint = this.$("elFavoriteSetViewHint") as HTMLDivElement;
        const elRecentlyUsedSetViewHint = this.$("elRecentlyUsedSetViewHint") as HTMLDivElement;
        const elMostUsedSetViewHint = this.$("elMostUsedSetViewHint") as HTMLDivElement;

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

        this.watchExpr(vm => vm.currentResultSet, crs => {
            elSetView.viewModel = crs ?? null;
        });
        this.watchExpr(vm => vm.favoriteEIcons, fui => {
            elFavoriteSetView.viewModel = fui ?? null;
            elFavoriteSetViewHint.style.display = (((fui ?? null)?.searchResultCount ?? 0) > 0) ? "none" : "block";
        });
        this.watchExpr(vm => vm.recentlyUsedEIcons, rui => {
            elRecentlyUsedSetView.viewModel = rui ?? null;
            elRecentlyUsedSetViewHint.style.display = (((rui ?? null)?.searchResultCount ?? 0) > 0) ? "none" : "block";
        });
        this.watchExpr(vm => vm.mostUsedEIcons, mui => {
            elMostUsedSetView.viewModel = mui ?? null;
            elMostUsedSetViewHint.style.display = (((mui ?? null)?.searchResultCount ?? 0) > 0) ? "none" : "block";
        });

        this.watchExpr(vm => vm.searchState, searchState => {
            const isSearching = searchState == EIconSearchStatus.SEARCHING;
            const isWelcomePage = searchState == EIconSearchStatus.WELCOME_PAGE;
            const isResultDisplay = searchState == EIconSearchStatus.RESULT_DISPLAY;
            const hasResults = (this.viewModel && (this.viewModel.currentResultSet?.searchResultCount ?? 0) > 0) ?? false;

            elResultDisplayContainer.classList.toggle("is-searching", isSearching);
            elResultDisplayContainer.classList.toggle("is-welcome", isWelcomePage);
            elResultDisplayContainer.classList.toggle("is-result-display", isResultDisplay && hasResults);
            elResultDisplayContainer.classList.toggle("has-no-results", isResultDisplay && !hasResults);

            if (isResultDisplay && hasResults) {
                if (knm) {
                    knm.participants = [ elSetView ];
                }
                elResultDisplayInnerContainer.scrollTo(0, 0);
                elSetView.refreshDisplayImmediately();
            }
            else if (isWelcomePage) {
                if (knm) {
                    knm.participants = [ elFavoriteSetView, elRecentlyUsedSetView, elMostUsedSetView ];
                }
                elFavoriteSetView.refreshDisplayImmediately();
                elRecentlyUsedSetView.refreshDisplayImmediately();
                elMostUsedSetView.refreshDisplayImmediately();
            }
            else {
                if (knm) {
                    knm.participants = [ ];
                }
            }
        });

        let knm: KeyboardNavManager | null = null;
        this.whenConnectedWithViewModel(vm => {
            knm = new KeyboardNavManager(() => { 
                    if (!vm.isClosed) {
                        elTextbox.focus();
                    }
                }, 
                () => {
                    if (vm.searchState == EIconSearchStatus.RESULT_DISPLAY) {
                        elResultDisplayInnerContainer.scrollTo({ top: 0, left: 0, behavior: "instant" });
                    }
                    else if (vm.searchState == EIconSearchStatus.WELCOME_PAGE) {
                        elResultDisplayEmptyResults.scrollTo({ top: 0, left: 0, behavior: "instant" });
                    }
                },
                elResultDisplayContainer, vm, this.logger);
            return asDisposable(() => {
                knm?.dispose();
                knm = null;
            });
        });

        elTextbox.addEventListener("keydown", (e) => {
            if (this.viewModel) {
                const isKeyboardNavigable = 
                    this.viewModel.searchState == EIconSearchStatus.RESULT_DISPLAY ||
                    this.viewModel.searchState == EIconSearchStatus.WELCOME_PAGE;

                if (e.keyCode == KeyCodes.RETURN) {
                    this.viewModel.confirmEntry();
                    e.preventDefault();
                    return true;
                }
                else if (e.keyCode == KeyCodes.DOWN_ARROW) {
                    if (isKeyboardNavigable && knm) {
                        knm.enterViaTop();
                    }
                }
                else if (e.keyCode == KeyCodes.UP_ARROW) {
                    if (isKeyboardNavigable && knm) {
                        knm.enterViaBottom();
                    }
                }
            }

            return false;
        });
        // elKeyboardNavTextbox.addEventListener("keydown", (e) => {
        //     let handled = false;
        //     if (this.viewModel) {
        //         if (e.keyCode == KeyCodes.UP_ARROW) {
        //             //this.logger.logDebug("up");
        //             elSetView.moveNavUp();
        //             //elSetView.moveKeyboardSelectionUp();
        //             handled = true;
        //         }
        //         else if (e.keyCode == KeyCodes.LEFT_ARROW) {
        //             //this.logger.logDebug("left");
        //             elSetView.moveNavLeft();
        //             //elSetView.moveKeyboardSelectionLeft();
        //             handled = true;
        //         }
        //         else if (e.keyCode == KeyCodes.RIGHT_ARROW) {
        //             //this.logger.logDebug("right");
        //             elSetView.moveNavRight();
        //             //elSetView.moveKeyboardSelectionRight();
        //             handled = true;
        //         }
        //         else if (e.keyCode == KeyCodes.DOWN_ARROW) {
        //             //this.logger.logDebug("down");
        //             elSetView.moveNavDown();
        //             //elSetView.moveKeyboardSelectionDown();
        //             handled = true;
        //         }
        //         else if (e.keyCode == KeyCodes.RETURN) {
        //             //this.logger.logDebug("return");
        //             elSetView.confirmKeyboardSelection();
        //             handled = true;
        //         }
        //     }
        //     if (e.keyCode == KeyCodes.TAB) {
        //         handled = true;
        //         return false;
        //     }

        //     if (handled) {
        //         e.preventDefault();
        //         return true;
        //     }
        // });
        // elKeyboardNavTextbox.addEventListener("focusout", () => {
        //     elSetView.setKeyboardSelectionTo(null);
        // });
        // elKeyboardNavTextbox.addEventListener("input", (e) => { elKeyboardNavTextbox.value = ""; });
        // elKeyboardNavTextbox.addEventListener("change", (e) => { elKeyboardNavTextbox.value = ""; });

        for (let setView of [elSetView, elFavoriteSetView, elRecentlyUsedSetView, elMostUsedSetView]) {
            if (!setView) { continue; }
            setView.addEventListener("eiconselected", (e) => {
                const eiconName = (e as any).eiconName;
                this.viewModel?.close(eiconName);
            });
        }
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
export class EIconSetView extends ComponentBase<EIconResultSet> implements KeyboardNavParticipant {
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

        this.whenConnectedWithViewModel(vm => {
            this.recalculateDisplay(true);
            return setupTooltipHandling(this._sroot, vm.parent.parent);
        });

        this.elMain.addEventListener("scroll", () => {
            //this.logger.logDebug("ev elMain scroll fired");
            this.recalculateDisplay(false);
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

    private get shouldUpdateFast(): boolean { return this.getAttribute("updatefast") == "true"; }

    private _recalcRequested = false;
    private _delayedRecalcTimer: IDisposable | null = null;
    private recalculateDisplay(immediately: boolean) {
        if (this._delayedRecalcTimer != null) {
            this._delayedRecalcTimer.dispose();
            this._delayedRecalcTimer = null;
        }

        if (immediately) {
            if (!this._recalcRequested) {
                this._recalcRequested = true;
                if (this.shouldUpdateFast) {
                    this._recalcRequested = false;
                    this.recalculateDisplayInner();
                }
                else {
                    Scheduler.scheduleNamedCallback("EIconSetView.recalculateDisplay", ["frame", "idle", 250], () => {
                        this._recalcRequested = false;
                        this.recalculateDisplayInner();
                    });
                }
            }
        }
        else {
            if (this.shouldUpdateFast) {
                this._delayedRecalcTimer = null;
                this.recalculateDisplay(true); 
            }
            else {
                this._delayedRecalcTimer = Scheduler.scheduleNamedCallback("EIconSearchDialog.delayedRecalcTimer", 500, () => { 
                    this._delayedRecalcTimer = null;
                    this.recalculateDisplay(true); 
                });
            }
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
            if (displayMetrics == null) { return; }
            elVisibleIconsContainer.style.height = `${displayMetrics.neededYHeight}px`;

            const vicBoundingRect = elVisibleIconsContainer.getBoundingClientRect();
            //this.logger.logDebug("vicBoundingRect", vicBoundingRect);
            const startAtYPixel = 0 - Math.min(0, vicBoundingRect.top);
            const endAtYPixel = Math.min(vicBoundingRect.bottom, window.innerHeight) - vicBoundingRect.top;

            elBeforeSentinel.style.top = "0px";
            elBeforeSentinel.style.height = `${startAtYPixel - 1}px`;

            const afterSentinelTop = endAtYPixel + 1;
            const afterSentinelHeight = Math.max(0, displayMetrics.neededYHeight - afterSentinelTop);
            elAfterSentinel.style.top = `${afterSentinelTop}px`;
            elAfterSentinel.style.height = `${afterSentinelHeight}px`;

            elTopIndicator.style.top = `${startAtYPixel}px`;
            elBottomIndicator.style.top = `${endAtYPixel - 1 - elBottomIndicator.offsetHeight}px`;

            const rawStartAtRow = Math.floor(startAtYPixel / (EICON_HEIGHT + EICON_GAP));
            const rawEndAtRow = Math.ceil(endAtYPixel / (EICON_HEIGHT + EICON_GAP));

            const actuallyVisibleRowCount = Math.max(1, rawEndAtRow - rawStartAtRow);

            const effectiveStartAtRow = Math.max(0, rawStartAtRow - actuallyVisibleRowCount);
            const effectiveEndAtRow = Math.min(displayMetrics.rowCount, rawEndAtRow + actuallyVisibleRowCount);

            this.logger.logDebug(`eicons visible on rows ${effectiveStartAtRow} to ${effectiveEndAtRow}`);

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
        endAt = Math.min(endAt, displayMetrics.eiconCount);

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

        // if (curKeyboardSelResult.length > 0 && this.viewModel) {
        //     this.viewModel.currentKeyboardSelectedEIcon = curKeyboardSelResult[0].eiconName;
        // }
        // else if (this.viewModel) {
        //     this.viewModel.currentKeyboardSelectedEIcon = null;
        // }

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

    get maxRows(): (number | null) {
        const mrValue = this.getAttribute("maxrows");
        if (mrValue != null) {
            return +mrValue;
        }
        else {
            return null;
        }
    }

    private _keyboardSelectionIndicatorEl: HTMLDivElement | null = null;

    private determineMetrics(elVisibleIconsContainer: HTMLDivElement): CalculatedDisplayMetrics | null {
        if (elVisibleIconsContainer.clientWidth == 0) {
            return null;
        }
        let remainingWidth = elVisibleIconsContainer.clientWidth - 8;
        let rowWidth = 0;

        do {
            remainingWidth -= (EICON_WIDTH + EICON_GAP);
            rowWidth++;
        } while (remainingWidth > EICON_WIDTH);

        const consumedWidth = (rowWidth * EICON_WIDTH) + ((rowWidth - 1) * EICON_GAP);
        const unusedWidth = Math.max(0, elVisibleIconsContainer.clientWidth - consumedWidth);

        const effSearchResultCount = (this.maxRows != null) 
            ? Math.min(this.viewModel?.searchResultCount ?? 0, rowWidth * this.maxRows) 
            : (this.viewModel?.searchResultCount ?? 0);

        const eiconCount = effSearchResultCount;
        const eiconRowCount = Math.ceil(eiconCount / rowWidth);

        const result = {
            iconsPerRow: rowWidth,
            rowStartsAtX: Math.floor(unusedWidth / 2),
            neededYHeight: (eiconRowCount * EICON_HEIGHT) + (Math.max(0, eiconRowCount - 1) * EICON_GAP),
            rowCount: eiconRowCount,

            clientWidth: elVisibleIconsContainer.clientWidth,
            clientHeight: elVisibleIconsContainer.clientHeight,
            eiconCount: effSearchResultCount
        };
        this.logger.logDebug("displayMetrics", result);
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

    private setCurrentKeyboardPos(newPos: { x: number, y: number }): boolean {
        if (this._currentCalculatedDisplayMetrics) {
            const eiconCount = this._currentCalculatedDisplayMetrics.eiconCount;
            const ccd = this._currentCalculatedDisplayMetrics;
            const newIndex = (newPos.y * ccd.iconsPerRow) + newPos.x;
            if (newIndex < eiconCount) {
                this.setKeyboardSelectionTo(newIndex);
                return true;
            }
            else {
                this.setKeyboardSelectionTo(null);
                return false;
            }
        }
        else {
            return false;
        }
    }

    confirmKeyboardSelection(): ConfirmSelectionResult {
        if (this.viewModel) {
            const ksi = this._keyboardSelectionIndex;
            if (ksi != null) {
                const shouldBeEIcon = [...this._currentVisibleIcons.values().filter(cvi => cvi.eiconIndex == ksi)];
                if (shouldBeEIcon.length > 0) {
                    return { accepted: true, eiconName: shouldBeEIcon[0].eiconName };
                }
            }
        }
        
        return { accepted: false };
    }

    // KeyboardNavParticipant
    private getKeyboardNavColumn(): number {
        if (this._currentCalculatedDisplayMetrics && this._keyboardSelectionIndex != null) {
            return this._keyboardSelectionIndex % this._currentCalculatedDisplayMetrics?.iconsPerRow;
        }
        else {
            return 0;
        }
    }
    moveNavDown(): MoveNavResultUpDown {
        if (this._currentCalculatedDisplayMetrics && this._keyboardSelectionIndex != null) {
            const curPos = this.getCurrentKeyboardPos()!;
            curPos.y = curPos.y + 1;
            const col = this.getKeyboardNavColumn();
            if (this.setCurrentKeyboardPos(curPos)) {
                return { accepted: true };
            }
            else {
                return { accepted: true, exitedAtColumn: col };
            }
        }
        else {
            return { accepted: false };
        }
    }
    moveNavUp(): MoveNavResultUpDown {
        if (this._currentCalculatedDisplayMetrics && this._keyboardSelectionIndex != null) {
            const curPos = this.getCurrentKeyboardPos()!;
            if (curPos.y == 0) {
                const col = this.getKeyboardNavColumn();
                this.setKeyboardSelectionTo(null);
                return { accepted: true, exitedAtColumn: col };
            }
            else {
                curPos.y = curPos.y - 1;
                this.setCurrentKeyboardPos(curPos);
                return { accepted: true };
            }
        }
        else {
            return { accepted: false };
        }
    }
    moveNavLeft(): MoveNavResultLeftRight {
        if (this._currentCalculatedDisplayMetrics && this._keyboardSelectionIndex != null) {
            const curPos = this.getCurrentKeyboardPos()!;
            if (curPos.x > 0) {
                curPos.x = curPos.x - 1;
                this.setCurrentKeyboardPos(curPos);
                return { accepted: true, exited: false };
            }
            else if (curPos.y > 0) {
                curPos.y = curPos.y - 1;
                curPos.x = this._currentCalculatedDisplayMetrics.iconsPerRow - 1;
                this.setCurrentKeyboardPos(curPos);
                return { accepted: true, exited: false };
            }
            else {
                return { accepted: true, exited: true };
            }
        }
        else {
            return { accepted: false };
        }
    }
    moveNavRight(): MoveNavResultLeftRight {
        if (this._currentCalculatedDisplayMetrics && this._keyboardSelectionIndex != null) {
            const curPos = this.getCurrentKeyboardPos()!;
            if (curPos.x < curPos.maxX) {
                curPos.x = curPos.x + 1;
                return { accepted: true, exited: !this.setCurrentKeyboardPos(curPos) };
            }
            else {
                curPos.y = curPos.y + 1;
                curPos.x = 0;
                return { accepted: true, exited: !this.setCurrentKeyboardPos(curPos) };
            }
        }
        else {
            return { accepted: false };
        }
    }

    acceptNavFromAbove(column: number): MoveNavResultUpDown {
        if (this._currentCalculatedDisplayMetrics) {
            const curPos = { x: column, y: 0 };
            const canSelect = this.setCurrentKeyboardPos(curPos);
            if (canSelect) {
                return { accepted: true };
            }
            else {
                return { accepted: false };
            }
        }
        else {
            return { accepted: false };
        }
    }

    acceptNavFromBelow(column: number): MoveNavResultUpDown {
        if (this._currentCalculatedDisplayMetrics) {
            const curPos = { x: column, y: this._currentCalculatedDisplayMetrics.rowCount - 1 };
            const canSelect = this.setCurrentKeyboardPos(curPos);
            if (canSelect) {
                return { accepted: true };
            }
            else {
                const curPos2 = { x: column, y: this._currentCalculatedDisplayMetrics.rowCount - 2 };
                const canSelect2 = this.setCurrentKeyboardPos(curPos2);
                if (canSelect2) {
                    return { accepted: true };
                }
                else {
                    return { accepted: false };
                }
            }
        }
        else {
            return { accepted: false };
        }
    }

    acceptNavFromLeft(): MoveNavResultLeftRight {
        if (this._currentCalculatedDisplayMetrics) {
            const eiconCount = this._currentCalculatedDisplayMetrics.eiconCount;
            if (eiconCount > 0) {
                this.setKeyboardSelectionTo(0);
                return { accepted: true, exited: false };
            }
            else {
                return { accepted: true, exited: true };
            }
        }
        else {
            return { accepted: false };
        }
    }
    acceptNavFromRight(): MoveNavResultLeftRight {
        if (this._currentCalculatedDisplayMetrics) {
            const eiconCount = this._currentCalculatedDisplayMetrics.eiconCount;
            if (eiconCount > 0) {
                this.setKeyboardSelectionTo(eiconCount - 1);
                return { accepted: true, exited: false };
            }
            else {
                return { accepted: true, exited: true };
            }
        }
        else {
            return { accepted: false };
        }
    }
    exit() {
        this.setKeyboardSelectionTo(null);
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
    eiconCount: number;

    clientHeight: number;
}

class KeyboardNavManager implements IDisposable {
    constructor(
        private readonly focusTopLeftTextboxFunc: () => void,
        private readonly scrollToTopFunc: () => void,
        private readonly myNavTextboxContainer: HTMLElement,
        private readonly viewModel: EIconSearchDialogViewModel,
        private readonly logger: Logger) {

        const myNavTextbox = document.createElement("input");
        myNavTextbox.type = "text";
        myNavTextbox.classList.add("keyboardnavtextbox");
        myNavTextboxContainer.appendChild(myNavTextbox);
        this.myNavTextbox = myNavTextbox;

        EventListenerUtil.addDisposableEventListener(myNavTextbox, "input", (e: Event) => {
            myNavTextbox.value = "";
        });
        EventListenerUtil.addDisposableEventListener(myNavTextbox, "change", (e: Event) => {
            myNavTextbox.value = "";
        });
        EventListenerUtil.addDisposableEventListener(myNavTextbox, "blur", (e: Event) => {
            if (this._currentParticipantIndex != null) {
                this.participants[this._currentParticipantIndex].exit();
            }
            this.setCurrentParticipantIndex(null);
        });
        EventListenerUtil.addDisposableEventListener(myNavTextbox, "focusout", (e: Event) => {
            if (this._currentParticipantIndex != null) {
                this.participants[this._currentParticipantIndex].exit();
            }
            this.setCurrentParticipantIndex(null);
        });
        EventListenerUtil.addDisposableEventListener(myNavTextbox, "keydown", (e: KeyboardEvent) => {
            let handled = false;

            let curParticipant = this.currentParticipant;
            if (curParticipant) {
                if (e.keyCode == KeyCodes.UP_ARROW) {
                    const cpRes = curParticipant.moveNavUp();
                    if (cpRes.accepted) {
                        if (cpRes.exitedAtColumn != null) {
                            const eac = cpRes.exitedAtColumn!;
                            let targetIndex = this._currentParticipantIndex! - 1;
                            let gotIt = false;
                            while (targetIndex >= 0) {
                                const testP = this.participants[targetIndex];
                                const testPRes = testP.acceptNavFromBelow(eac);
                                if (testPRes.accepted && testPRes.exitedAtColumn == null) {
                                    this.setCurrentParticipantIndex(targetIndex);
                                    gotIt = true;
                                    break;
                                }
                                targetIndex--;
                            }
                            if (!gotIt) {
                                this.scrollToTopFunc();
                                this.setCurrentParticipantIndex(null);
                            }
                        }
                    }
                }
                else if (e.keyCode == KeyCodes.DOWN_ARROW) {
                    const cpRes = curParticipant.moveNavDown();
                    if (cpRes.accepted) {
                        if (cpRes.exitedAtColumn != null) {
                            const eac = cpRes.exitedAtColumn!;
                            let targetIndex = this._currentParticipantIndex! + 1;
                            let gotIt = false;
                            while (targetIndex < this.participants.length) {
                                const testP = this.participants[targetIndex];
                                const testPRes = testP.acceptNavFromAbove(eac);
                                if (testPRes.accepted && testPRes.exitedAtColumn == null) {
                                    this.setCurrentParticipantIndex(targetIndex);
                                    gotIt = true;
                                    break;
                                }
                                targetIndex++;
                            }
                            if (!gotIt) {
                                this.setCurrentParticipantIndex(null);
                            }
                        }
                    }
                }                
                else if (e.keyCode == KeyCodes.LEFT_ARROW) {
                    const cpRes = curParticipant.moveNavLeft();
                    if (cpRes.accepted) {
                        if (cpRes.exited) {
                            let targetIndex = this._currentParticipantIndex! - 1;
                            let gotIt = false;
                            while (targetIndex >= 0) {
                                const testP = this.participants[targetIndex];
                                const testPRes = testP.acceptNavFromRight();
                                if (testPRes.accepted && !testPRes.exited) {
                                    this.setCurrentParticipantIndex(targetIndex);
                                    gotIt = true;
                                    break;
                                }
                                targetIndex--;
                            }
                            if (!gotIt) {
                                this.setCurrentParticipantIndex(null);
                            }
                        }
                    }
                }
                else if (e.keyCode == KeyCodes.RIGHT_ARROW) {
                    const cpRes = curParticipant.moveNavRight();
                    if (cpRes.accepted) {
                        if (cpRes.exited) {
                            let targetIndex = this._currentParticipantIndex! + 1;
                            let gotIt = false;
                            while (targetIndex < this.participants.length) {
                                const testP = this.participants[targetIndex];
                                const testPRes = testP.acceptNavFromLeft();
                                if (testPRes.accepted && !testPRes.exited) {
                                    this.setCurrentParticipantIndex(targetIndex);
                                    gotIt = true;
                                    break;
                                }
                                targetIndex++;
                            }
                            if (!gotIt) {
                                this.setCurrentParticipantIndex(null);
                            }
                        }
                    }
                }
                else if (e.keyCode == KeyCodes.RETURN) {
                    //this.logger.logDebug("return");
                    const cksResult = curParticipant.confirmKeyboardSelection();
                    if (cksResult.accepted) {
                        this.viewModel.returnResult(cksResult.eiconName);
                    }
                    handled = true;
                }
            }
            if (e.keyCode == KeyCodes.TAB) {
                handled = true;
                return false;
            }

            if (handled) {
                e.preventDefault();
                return true;
            }
        });
    }

    private _isDisposed: boolean = false;
    get isDisposed() { return this._isDisposed; }

    dispose(): void {
        if (!this._isDisposed) {
            this._isDisposed = true;
            if (this.currentParticipant) {
                this.currentParticipant.exit();
            }
            this.myNavTextbox.remove();
        }
    }
    [Symbol.dispose](): void {
        this.dispose();
    }

    private readonly myNavTextbox: HTMLInputElement;

    participants: KeyboardNavParticipant[] = [];
    private _currentParticipantIndex: number | null = null;
    private setCurrentParticipantIndex(value: number | null, setFocusOnNull: boolean = true) {
        if (value !== this._currentParticipantIndex) {
            if (this._currentParticipantIndex != null) {
                this.participants[this._currentParticipantIndex].exit();
            }
            this._currentParticipantIndex = value;
            if (value == null) {
                if (setFocusOnNull) {
                    this.logger.logDebug("FOCUSING TOP TEXTBOX");
                    this.focusTopLeftTextboxFunc();
                }
                this.myNavTextbox.disabled = true;
            }
        }
    }
    private get currentParticipant() { 
        if (this._currentParticipantIndex != null) {
            return this.participants[this._currentParticipantIndex];
        }
        else {
            return null;
        }
    }

    exit() {
        this.setCurrentParticipantIndex(null, false);
    }

    enterViaTop() {
        for (let i = 0; i < this.participants.length; i++) {
            const p = this.participants[i];
            const anres: MoveNavResultLeftRight  = p.acceptNavFromLeft();
            if (anres.accepted) {
                if (!anres.exited) {
                    this.setCurrentParticipantIndex(i);
                    this.myNavTextbox.disabled = false;
                    this.myNavTextbox.focus();
                    return;
                }
            }
        }
    }
    enterViaBottom() {
        for (let i = this.participants.length - 1; i >= 0; i--) {
            const p = this.participants[i];
            const anres: MoveNavResultLeftRight  = p.acceptNavFromRight();
            if (anres.accepted) {
                if (!anres.exited) {
                    this.setCurrentParticipantIndex(i);
                    this.myNavTextbox.disabled = false;
                    this.myNavTextbox.focus();
                    return;
                }
            }
        }
    }
}