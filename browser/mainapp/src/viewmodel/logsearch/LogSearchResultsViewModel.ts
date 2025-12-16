import { CancellationTokenSource } from "../../util/CancellationTokenSource";
import { IDisposable, maybeDispose } from "../../util/Disposable";
import { ExplicitDate } from "../../util/hostinterop/HostInteropLogSearch";
import { ObservableValue } from "../../util/Observable";
import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { ActiveLoginViewModel } from "../ActiveLoginViewModel";
import { LogSearch3ViewModel } from "./LogSearch3ViewModel";
import { LogSearchResultsMessageGroupSetViewModel } from "./LogSearchResultsMessageGroupSetViewModel";
import { MessageLoadFunc } from "./MessageLoadFunc";


export class LogSearchResultsViewModel extends ObservableBase implements IDisposable {
    constructor(
        public readonly logSearch: LogSearch3ViewModel,
        public readonly session: ActiveLoginViewModel,
        public readonly dates: ExplicitDate[],
        private readonly performMessageLoadAsync: MessageLoadFunc) {

        super();

        this.selectedYear = dates[dates.length - 1].y;

        const hasYears: number[] = [];
        let lastSeenYear = 0;
        for (let d of dates) {
            const dFullYear = d.y;
            if (dFullYear != lastSeenYear) {
                lastSeenYear = dFullYear;
                hasYears.push(dFullYear);
            }

            this._hasDates.add(new Date(Date.UTC(d.y, d.m - 1, d.d, 0, 0, 0, 0)).getTime());
        }
        this.hasYears = hasYears;
    }

    private _isDisposed: boolean = false;
    get isDisposed() { return this._isDisposed; }
    dispose() {
        maybeDispose(this.messageSet);
    }
    [Symbol.dispose]() { this.dispose(); }

    @observableProperty
    hasYears: number[];

    @observableProperty
    selectedYear: number;

    @observableProperty
    get canGoNextYear(): boolean { 
        const idx = this.hasYears.indexOf(this.selectedYear);
        return (idx != -1) && (idx != this.hasYears.length - 1);
    }

    @observableProperty
    get canGoPreviousYear(): boolean { 
        const idx = this.hasYears.indexOf(this.selectedYear);
        return (idx > 0);
    }

    goNextYear() {
        const idx = this.hasYears.indexOf(this.selectedYear);
        if ((idx != -1) && (idx != this.hasYears.length - 1)) {
            const newIdx = idx + 1;
            const newYear = this.hasYears[newIdx];
            this.selectedYear = newYear;
        }
    }

    goPreviousYear() {
        const idx = this.hasYears.indexOf(this.selectedYear);
        if (idx > 0) {
            const newIdx = idx - 1;
            const newYear = this.hasYears[newIdx];
            this.selectedYear = newYear;
        }
    }

    private _selectedDate: ObservableValue<(ExplicitDate | null)> = new ObservableValue(null);

    get selectedDate(): (ExplicitDate | null) { return this._selectedDate.value; }
    set selectedDate(value: (ExplicitDate | null)) {
        this.setSelectedDateAsync(value);
    }

    private async setSelectedDateAsync(value: (ExplicitDate | null)) {
        if (value != this._selectedDate.value) {
            this._selectedDate.value = value;
            this.logger.logInfo("selectedDate set", value);
            await this._performMessageLoad(value);
        }        
    }

    @observableProperty
    loadingMessages: number = 0;

    @observableProperty
    messageSet: (LogSearchResultsMessageGroupSetViewModel | null) = null;

    private _hasDates: Set<number> = new Set();

    hasDate(year: number, month: number, day: number): boolean {
        const d = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
        return this._hasDates.has(d.getTime());
    }

    private _performMessageLoadCTS: CancellationTokenSource = new CancellationTokenSource();
    private async _performMessageLoad(d: (ExplicitDate | null)) {
        const myCTS = new CancellationTokenSource();
        this._performMessageLoadCTS.cancel();
        this._performMessageLoadCTS = myCTS;

        this.loadingMessages++;
        maybeDispose(this.messageSet);
        this.messageSet = null;
        try {
            if (d) {
                const res = await this.performMessageLoadAsync(d, myCTS.token);
                const setvm = new LogSearchResultsMessageGroupSetViewModel(this, res.title, res.messages);
                maybeDispose(this.messageSet);
                this.messageSet = setvm;
            }
        }
        finally {
            this.loadingMessages--;
        }
    }

    async navigateToLastAsync() {
        if (this.hasYears.length == 0) { return; }
        const navToYear = this.hasYears[this.hasYears.length - 1];
        this.selectedYear = navToYear;

        let lastDate: (ExplicitDate | null) = null;
        for (let x of this.dates) {
            if (lastDate == null ||
                lastDate.y < x.y ||
                (lastDate.y == x.y && lastDate.m < x.m) ||
                (lastDate.y == x.y && lastDate.m == x.m && lastDate.d < x.d)) {

                lastDate = x;
            }
        }
        if (lastDate == null) { return; }

        await this.setSelectedDateAsync(lastDate);
        if (this.messageSet == null) { return; }

        await this.messageSet.navigateToLastAsync();
    }
}
