import { CharacterName } from "../../shared/CharacterName";
import { CancellationToken, CancellationTokenSource } from "../../util/CancellationTokenSource";
import { IterableUtils } from "../../util/IterableUtils";
import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { OperationCancelledError } from "../../util/PromiseSource";
import { TaskUtils } from "../../util/TaskUtils";
import { ActiveLoginViewModel } from "../ActiveLoginViewModel";
import { AppViewModel } from "../AppViewModel";
import { LogSearch2ResultItemViewModel } from "./LogSearch2ResultItemViewModel";

export class LogSearch2ViewModel extends ObservableBase {
    constructor(
        public readonly activeLoginViewModel: ActiveLoginViewModel,
        public readonly appViewModel: AppViewModel,
        private readonly defaultCharacterName: CharacterName) {

        super();

        this.assignResultSet(new LogSearch2DynamicResultSet(this, 3000));
    }

    private assignResultSet(rs: LogSearch2DynamicResultSet | null) {
        if (rs) {
            this.currentResultSet = rs;

            const newRV = new VirtualScrollViewModel<LogSearch2ResultItemViewModel>();
            newRV.itemCount = rs.totalCount;
            newRV.getItemsAsync = async (idx, num, cancellationToken) => {
                const r = await rs.getItemsAsync(idx, num, cancellationToken);
                return r;
            };

            this.resultView = newRV;
            newRV.anchorPoint = { elementIdx: 2950, clientYPct: 0 };
        }
        else {
            this.currentResultSet = null;
            this.resultView = null;
        }
    }

    @observableProperty
    resultView: VirtualScrollViewModel<LogSearch2ResultItemViewModel> | null = null;

    @observableProperty
    currentResultSet: LogSearch2DynamicResultSet | null = null;
}

class LogSearch2DynamicResultSet {
    constructor(
        public readonly parent: LogSearch2ViewModel,
        public readonly totalCount: number) {
    }

    private _cachedItems: Map<number, LogSearch2ResultItemViewModel> = new Map();

    async getItemsAsync(index: number, count: number, cancellationToken: CancellationToken): Promise<CurrentDisplayItems<LogSearch2ResultItemViewModel>> {
        const buildingResults = new Map<number, LogSearch2ResultItemViewModel>();

        let actualStartAt = Math.min(this.totalCount - 1, index);
        let actualCount = Math.min(this.totalCount - index, count);

        const alreadyRemovedSet = new Set<number>();

        // Trim items we already have off the front
        for (let i = index; i < index + count; i++) {
            const ci = this._cachedItems.get(i);
            if (ci && !alreadyRemovedSet.has(i)) {
                buildingResults.set(i, ci);
                alreadyRemovedSet.add(i);
                actualStartAt++;
                actualCount--;
            }
            else {
                break;
            }
        }

        // Trim items we already have off the back
        for (let i = index + count - 1; i >= index; i--) {
            const ci = this._cachedItems.get(i);
            if (ci && !alreadyRemovedSet.has(i)) {
                buildingResults.set(i, ci);
                alreadyRemovedSet.add(i);
                actualCount--;
            }
            else {
                break;
            }
        }

        // actual
        // TODO: get from host via interop
        console.log("actual range read", actualStartAt, actualCount);
        for (let i = actualStartAt; i < actualStartAt + actualCount; i++) {
            const text = `this is a test message ${i}`;
            buildingResults.set(i, new LogSearch2ResultItemViewModel(
                this.parent, new Date(), CharacterName.create("System"), 0, text));
        }

        // TODO: for testing
        await TaskUtils.delay(500, cancellationToken);

        this._cachedItems = buildingResults;
        return { items: IterableUtils.asQueryable(buildingResults).orderBy(i => i[0]).select(i => i[1]).toArray(), startIdx: index };
    }
}

export interface AnchorPoint { readonly elementIdx: number, readonly clientYPct: number };
export interface CurrentDisplayItems<TItem> { readonly items: TItem[], readonly startIdx: number };

export class VirtualScrollViewModel<TItem> extends ObservableBase {
    constructor() {
        super();
        this.scrollBarInfo = new VirtualScrollBarViewModel();
        this.scrollBarInfo.currentValue = 100;
        this.scrollBarInfo.pageHeight = 10;
        this.scrollBarInfo.scrollHeight = 300;
        (window as any)["__sbi"] = this.scrollBarInfo;

        this.anchorPoint = { elementIdx: 1200, clientYPct: 0 };
    }

    surroundCount: number = 100;

    private _anchorPoint: AnchorPoint = { elementIdx: 0, clientYPct: 0 };
    @observableProperty
    get anchorPoint(): AnchorPoint { return this._anchorPoint; }
    set anchorPoint(value: AnchorPoint) {
        if (value !== this._anchorPoint) {
            this._anchorPoint = value;
            const needMin = value.elementIdx - this.surroundCount;
            this.startItemLoad(Math.max(0, needMin), this.surroundCount * 2);
        }
    }

    @observableProperty
    itemCount: number = 0;

    private _curItemLoadCTS: CancellationTokenSource | null = null;
    private startItemLoad(index: number, count: number) {
        if (this._curItemLoadCTS) {
            this._curItemLoadCTS.cancel();
        }
        this._curItemLoadCTS = new CancellationTokenSource();
        this.performItemLoadAsync(index, count, this._curItemLoadCTS.token);
    }

    private async performItemLoadAsync(index: number, count: number, cancellationToken: CancellationToken) {
        this.loadingItems = true;
        console.log("performItemLoadAsync", index, count);
        try {
            const resp = await this.getItemsAsync(index, count, cancellationToken);
            if (!cancellationToken.isCancellationRequested) {
                console.log("got currentDisplayItems", resp);
                this.currentDisplayItems = resp;
            }  
        }
        catch (e) {
            if (e instanceof OperationCancelledError) { }
            else { throw e; }
        }
        finally {
            console.log("end performItemLoadAsync", index, count);
            this.loadingItems = false;
        }
    }

    getItemsAsync: ((startIdx: number, count: number, cancellationToken: CancellationToken) => Promise<CurrentDisplayItems<TItem>>) 
        = async (a, b, c) => { return { startIdx: 0, items: [] }; };

    @observableProperty
    loadingItems: boolean = false;

    @observableProperty
    currentDisplayItems: CurrentDisplayItems<TItem> = { items: [], startIdx: 0 };

    @observableProperty
    scrollBarInfo: VirtualScrollBarViewModel;
}

export class VirtualScrollBarViewModel extends ObservableBase {
    @observableProperty
    scrollHeight: number = 100;

    @observableProperty
    pageHeight: number = 10;

    @observableProperty
    currentValue: number = 0;

    onPageUp: (() => void) = () => {};
    onPageDown: (() => void) = () => {};
    onThumbDrag: ((target: number) => void) = (num) => {};
}