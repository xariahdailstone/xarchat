import { jsx, Fragment, VNode } from "../../snabbdom/index";
import { asDisposable, IDisposable, isDisposable, maybeDispose } from "../../util/Disposable";
import { HTMLUtils } from "../../util/HTMLUtils";
import { observableProperty } from "../../util/ObservableBase";
import { LogSearch2ViewModel, VirtualScrollViewModel, VirtualScrollBarViewModel, CurrentDisplayItems } from "../../viewmodel/newlogsearch/LogSearch2ViewModel";
import { componentArea, ComponentBase, componentElement } from "../ComponentBase";
import { RenderingComponentBase } from "../RenderingComponentBase";
import { stageViewFor } from "../Stage";

@stageViewFor(LogSearch2ViewModel)
@componentArea("newlogsearch")
@componentElement("x-logsearch2")
export class LogSearch2 extends RenderingComponentBase<LogSearch2ViewModel> {
    constructor() {
        super();
    }

    override render(): (VNode | [VNode, IDisposable]) {
        if (this.viewModel) {
            const vm = this.viewModel;

            return <x-vscrollarea classList={[ "result-view" ]} props={{ viewModel: vm.resultView }}></x-vscrollarea>;
        }
        else {
            return <></>;
        }
    }
}

@componentArea("newlogsearch")
@componentElement("x-vscrollarea")
export class VirtualScrollArea<TItem> extends ComponentBase<VirtualScrollViewModel<TItem>> {
    constructor() {
        super();
        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <div class="clientarea" id="elClientArea"></div>
            <x-virtualscrollbar id="elVScroll" class="vscroll"></x-virtualscrollbar>
            <div id="elDebugAnchorLine" class="debuganchorline"></div>
        `);

        const elVScroll = this.$("elVScroll") as VirtualScrollBar;

        this.whenConnected(() => {
            this._resizeObserver = new ResizeObserver(() => {
                this.relayoutItems();
            });
            this._resizeObserver.observe(this);
            for (let i of this._currentlyAddedItems.values()) {
                this._resizeObserver!.observe(i);
            }
            return asDisposable(() => {
                this._resizeObserver!.disconnect();
                this._resizeObserver = null;
            })
        });

        this.watchExpr(vm => vm.scrollBarInfo, sbi => {
            elVScroll.viewModel = sbi ?? null;
            if (sbi) {
                sbi.onPageUp = () => { this.scrollActualPixels(0 - (this.elMain.offsetHeight * 0.8)); };
                sbi.onPageDown = () => { this.scrollActualPixels((this.elMain.offsetHeight * 0.8)); };
                sbi.onThumbDrag = (v) => {
                    if (this.viewModel) {
                        this.viewModel.anchorPoint = { elementIdx: Math.floor(v), clientYPct: v - Math.floor(v) };
                    }
                };
            }
        });
        this.watchExpr(vm => vm.currentDisplayItems, vm => {
            this.refreshDisplayItems(vm ?? { items: [], startIdx: 0 });
        });
        this.watchExpr(vm => vm.anchorPoint, vm => {
            this.relayoutItems();
        });

        this.elMain.addEventListener("wheel", (e) => {
            this.scrollActualPixels(e.deltaY);
            e.preventDefault();
        });
    }

    private _resizeObserver: ResizeObserver | null = null;

    private readonly _currentlyAddedItems: Map<TItem, HTMLElement> = new Map();
    private refreshDisplayItems(items: CurrentDisplayItems<TItem>) {
        console.log("refreshDisplayItems", items);
        const itemsToAddSet = new Set<TItem>();
        for (let x of items.items) {
            itemsToAddSet.add(x);
        }

        let modifiedAny = false;
        for (let k of this._currentlyAddedItems) {
            const vm = k[0];
            const el = k[1];
            if (itemsToAddSet.has(vm)) {
                itemsToAddSet.delete(vm);
            }
            else {
                this.disposeElementForViewModel(el);
                modifiedAny = true;
            }
        }
        
        for (let vm of itemsToAddSet) {
            const el = this.createElementForViewModel(vm);
            modifiedAny = true;
        }

        if (modifiedAny) {
            this.relayoutItems();
        }
    }

    private createElementForViewModel(vm: TItem) {
        const c = LogSearch2ItemViews.getComponentFor(vm);
        if (c) {
            (this.$("elClientArea") as HTMLDivElement).appendChild(c);
            if (this._resizeObserver) {
                this._resizeObserver.observe(c);
            }
            this._currentlyAddedItems.set(vm, c);
        }
    }

    private disposeElementForViewModel(el: HTMLElement) {
        el.remove();
        maybeDispose(el);
        if (this._resizeObserver) {
            this._resizeObserver.unobserve(el);
        }
    }

    private _debugRelayout = false;
    private _lastOriginY: number = 0;
    private relayoutItems() {
        if (this.viewModel) {
            //if (this._debugRelayout) { debugger; }

            const vm = this.viewModel;
            const cdi = vm.currentDisplayItems;
            //const sbi = vm.scrollBarInfo;
            const ap = vm.anchorPoint;

            let curY = 0;

            //if (ap.elementIdx == 0) { debugger; }
            const pctScrolledDown = ((ap.elementIdx + ap.clientYPct) / vm.itemCount);
            const originY = this.$("elClientArea")!.clientHeight * pctScrolledDown;

            const elDebugAnchorLine = this.$("elDebugAnchorLine") as HTMLDivElement;
            elDebugAnchorLine.style.top = `${originY}px`;
            vm.scrollBarInfo.pageHeight = 1;
            vm.scrollBarInfo.currentValue = ap.elementIdx + (ap.clientYPct);
            vm.scrollBarInfo.scrollHeight = vm.itemCount;
            this._lastOriginY = originY;

            if (ap.elementIdx > cdi.startIdx + cdi.items.length + 30) {
                for (let el of this._currentlyAddedItems.values()) {
                    el.style.top = `-10000px`;
                }
                return;
            }
            else if (ap.elementIdx < cdi.startIdx - 30) {
                for (let el of this._currentlyAddedItems.values()) {
                    el.style.top = `10000px`;
                }
                return;
            }

            // Layout from anchored and below
            const anchorVM = cdi.items[ap.elementIdx - cdi.startIdx] ?? null;
            const anchorEl = anchorVM ? this._currentlyAddedItems.get(anchorVM) : null;
            const anchorY = anchorEl ? (originY - (anchorEl.offsetHeight * ap.clientYPct)) : originY;
            if (anchorY != null)
            {
                curY = anchorY;
                for (let i = ap.elementIdx - cdi.startIdx; i < cdi.items.length; i++) {
                    const vm = cdi.items[i];
                    const el = this._currentlyAddedItems.get(vm);
                    if (el) {
                        el.style.top = `${curY}px`;
                        curY += el.offsetHeight;    
                    }
                }

                // Layout above anchored
                curY = anchorY;
                for (let i = ap.elementIdx - cdi.startIdx - 1; i >= 0; i--) {
                    const vm = cdi.items[i];
                    const el = this._currentlyAddedItems.get(vm);
                    if (el) {
                        el.style.top = `${curY - el.offsetHeight}px`;
                        curY -= el.offsetHeight;
                    }
                }
            }
        }
    }

    scrollActualPixels(pxCount: number) {
        if (this.viewModel) {
            const vm = this.viewModel;
            const targetLine = this._lastOriginY + pxCount;

            let minTop: number | null = null;
            let vmMinTop: TItem | null = null;
            let maxBot: number | null = null;
            let vmMaxBot: TItem | null = null;
            for (let kvp of this._currentlyAddedItems) {
                const ivm = kvp[0];
                const el = kvp[1];
                const elIdx = vm.currentDisplayItems.items.indexOf(ivm) + vm.currentDisplayItems.startIdx;

                const elTop = el.offsetTop;
                const elHeight = el.offsetHeight;
                const elBottom = elTop + elHeight;
                if (minTop == null || elTop < minTop) {
                    minTop = elTop;
                    vmMinTop = ivm;
                }
                if (maxBot == null || elBottom > maxBot) {
                    maxBot = elBottom;
                    vmMaxBot = ivm;
                }

                if (elTop <= targetLine && elBottom > targetLine) {
                    const pctInto = (targetLine - elTop) / elHeight;
                    console.log("orig anchorPoint", vm.anchorPoint.elementIdx, vm.anchorPoint.clientYPct);
                    console.log("new anchorPoint", elIdx, pctInto);
                    vm.anchorPoint = { elementIdx: elIdx, clientYPct: pctInto };
                    return;
                }
            }
            if (minTop != null && targetLine < minTop && vmMinTop) {
                const elIdx = vm.currentDisplayItems.items.indexOf(vmMinTop) + vm.currentDisplayItems.startIdx;
                console.log("#new anchorPoint", elIdx, 0);
                vm.anchorPoint = { elementIdx: elIdx, clientYPct: 0 };
                return;
            }
            else if (maxBot != null && targetLine >= maxBot && vmMaxBot) {
                const elIdx = vm.currentDisplayItems.items.indexOf(vmMaxBot) + vm.currentDisplayItems.startIdx;
                console.log("#new anchorPoint", elIdx + 1, 0);
                this._debugRelayout = true;
                vm.anchorPoint = { elementIdx: elIdx + 1, clientYPct: 0 };
                return;
            }
        }
    }
}

@componentArea("newlogsearch")
@componentElement("x-virtualscrollbar")
export class VirtualScrollBar extends ComponentBase<VirtualScrollBarViewModel> {
    constructor() {
        super();
        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <div id="elScrollUpRegion" class="scroll-region scroll-region-up"></div>
            <div id="elScrollThumb" class="scroll-thumb"></div>
            <div id="elScrollDownRegion" class="scroll-region scroll-region-down"></div>
        `);

        const elScrollUpRegion = this.$("elScrollUpRegion") as HTMLDivElement;
        const elScrollThumb = this.$("elScrollThumb") as HTMLDivElement;
        const elScrollDownRegion = this.$("elScrollDownRegion") as HTMLDivElement;

        let lastKnownHeight = 10;
        let lastKnownAvailHeight = 10;
        const recalculateSizes = () => {
            if (this.viewModel) {
                const currentValue = this.viewModel.currentValue;
                const pageHeight = this.viewModel.pageHeight;
                const scrollHeight = this.viewModel.scrollHeight;

                const thumbSizePct = Math.max(0.05, pageHeight / scrollHeight);
                const thumbSizePx = thumbSizePct * lastKnownHeight;

                const totalAvailHeight = lastKnownHeight - (thumbSizePct * lastKnownHeight);
                lastKnownAvailHeight = totalAvailHeight;
                const topHeightPct = (currentValue / scrollHeight);
                const topHeightPx = topHeightPct * totalAvailHeight;
                
                this.elMain.style.gridTemplateRows = `${topHeightPx}px ${thumbSizePx}px 1fr`;
            }
        };

        this.whenConnected(() => {
            const ro = new ResizeObserver((entries) => {
                for (let entry of entries) {
                    lastKnownHeight = entry.contentBoxSize[0].blockSize;
                }
                recalculateSizes();
            });
            ro.observe(this);
            return asDisposable(() => ro.disconnect());
        })

        this.watchExpr(vm => [vm.currentValue, vm.pageHeight, vm.scrollHeight], vals => {
            if (vals) {
                recalculateSizes();
            }
        });

        let scrollRepeatTimerHandle: number | null = null;
        const stopScrollRepeat = () => {
            if (scrollRepeatTimerHandle != null) {
                window.clearTimeout(scrollRepeatTimerHandle);
            }
        }
        const setScrollRepeat = (callback: () => void, msInitial: number, msRepeat: number) => {
            stopScrollRepeat();
            scrollRepeatTimerHandle = window.setTimeout(() => {
                callback();
                setScrollRepeat(callback, msRepeat, msRepeat);
            }, msInitial);
        }

        elScrollUpRegion.addEventListener("pointerdown", (e: PointerEvent) => {
            if (this.viewModel) {
                elScrollUpRegion.setPointerCapture(e.pointerId);
                this.viewModel.onPageUp();
                setScrollRepeat(() => this.viewModel?.onPageUp(), 300, 75);
            }
        });
        elScrollUpRegion.addEventListener("pointerup", (e: PointerEvent) => {
            elScrollUpRegion.releasePointerCapture(e.pointerId);
            stopScrollRepeat();
        });
        elScrollDownRegion.addEventListener("pointerdown", (e: PointerEvent) => {
            if (this.viewModel) {
                elScrollDownRegion.setPointerCapture(e.pointerId);
                this.viewModel.onPageDown();
                setScrollRepeat(() => this.viewModel?.onPageDown(), 300, 75);
            }
        });
        elScrollDownRegion.addEventListener("pointerup", (e: PointerEvent) => {
            elScrollDownRegion.releasePointerCapture(e.pointerId);
            stopScrollRepeat();
        });

        let isDragging = false;
        let initialClientY = 0;
        elScrollThumb.addEventListener("pointerdown", (e: PointerEvent) => {
            elScrollThumb.setPointerCapture(e.pointerId);
            isDragging = true;
            initialClientY = e.clientY;
        });
        elScrollThumb.addEventListener("pointerup", (e: PointerEvent) => {
            elScrollThumb.releasePointerCapture(e.pointerId);
            isDragging = false;
        });
        elScrollThumb.addEventListener("pointermove", (e: PointerEvent) => {
            if (this.viewModel && isDragging) {
                const vm = this.viewModel;

                const deltaY = e.clientY - initialClientY;
                console.log("deltaY", deltaY);
                const deltaYVal = (deltaY / lastKnownAvailHeight) * vm.scrollHeight;
                console.log("deltaYVal", deltaYVal);
                let newVal = vm.currentValue + deltaYVal;
                if (newVal < 0) {
                    newVal = 0;
                }
                if (newVal > vm.scrollHeight) {
                    newVal = vm.scrollHeight;
                }
                console.log("newVal", newVal);
                vm.currentValue = newVal;
                vm.onThumbDrag(newVal);
                initialClientY = e.clientY;
            }
        });
    }
}






class LogSearch2ItemViews {
    private static _registeredItemViewTypes: Map<ConstructorOf<any>, ConstructorOf<ComponentBase<any>>> = new Map();

    static registerItemComponentType<TAbstractViewModel, TViewModel extends TAbstractViewModel>(
        viewModelType: ConstructorOf<TViewModel>, elementClass: ConstructorOf<ComponentBase<TAbstractViewModel>>) {

        this._registeredItemViewTypes.set(viewModelType, elementClass);
    }

    static getComponentFor(vm: any): (ComponentBase<any> | null) {
        for (let k of this._registeredItemViewTypes.keys()) {
            if (vm instanceof k) {
                const viewEl = new (this._registeredItemViewTypes.get(k)!)();
                viewEl.viewModel = vm;
                return viewEl;
            }
        }
        return null;
    }
}

interface ConstructorOf<T> {
    new (...params: any[]): T;
}

export function logSearch2ItemViewFor<TAbstractViewModel, TViewModel extends TAbstractViewModel>(vm: ConstructorOf<TViewModel>) {
    return function(target: ConstructorOf<ComponentBase<TAbstractViewModel>>) {
        LogSearch2ItemViews.registerItemComponentType(vm, target);
    }
}




