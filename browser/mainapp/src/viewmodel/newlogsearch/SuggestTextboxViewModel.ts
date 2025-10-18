import { CancellationToken, CancellationTokenSource } from "../../util/CancellationTokenSource";
import { ObservableValue } from "../../util/Observable";
import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { Collection } from "../../util/ObservableCollection";
import { AppViewModel } from "../AppViewModel";

export class SuggestTextboxViewModel extends ObservableBase {
    constructor(
        public readonly appViewModel: AppViewModel,
        private readonly onPopulateDropdown: (txt: string, cancellationToken: CancellationToken) => Promise<SuggestTextboxItemViewModel[]>,
        private readonly onValidate: (txt: string, cancellationToken: CancellationToken) => Promise<boolean>
    ) {
        super();
    }

    private readonly _value: ObservableValue<string> = new ObservableValue("");
    private _valueValidateCTS: CancellationTokenSource | null = null;

    get value(): string { return this._value.value; }
    set value(v: string) {
        if (v !== this._value.value) {
            this._value.value = v;
            this.isValid = null;
            if (this._valueValidateCTS) {
                this._valueValidateCTS.cancel();
            }

            const cts = new CancellationTokenSource();
            this._valueValidateCTS = cts;
            (async () => { 
                const validateResult = await this.validateAsync(v, cts.token);
                if (!cts.isCancellationRequested) {
                    this.isValid = validateResult;
                }
            })();
        }
    }

    private async validateAsync(value: string, cancellationToken: CancellationToken): Promise<boolean> {
        const res = await this.onValidate(value, cancellationToken);
        return res;
    }

    @observableProperty
    isValid: boolean | null = null;

    @observableProperty
    suggestionsState: SuggestTextboxDropdownState = SuggestTextboxDropdownState.IDLE;

    @observableProperty
    suggestions: Collection<SuggestTextboxItemViewModel> = new Collection();

    private _suggestionPopulateInfo: { value: string, cts: CancellationTokenSource } | null = null;

    openDropdown() {
        const v = this._value.value;
        let spi = this._suggestionPopulateInfo;
        if (spi) {
            if (spi.value != v) {
                spi.cts.cancel();
            }
            else {
                return;
            }
        }

        const cts = new CancellationTokenSource();
        spi = { value: v, cts: cts };
        this._suggestionPopulateInfo = spi;
        (async () => {
            const res = await this.onPopulateDropdown(v, cts.token);
            if (this._suggestionPopulateInfo == spi) {
                const newSuggestions = new Collection<SuggestTextboxItemViewModel>();
                for (let i of res) {
                    newSuggestions.add(i);
                }
                this.suggestions = newSuggestions;
            }
        })();
    }

    cancelDropdown() {
        const spi = this._suggestionPopulateInfo;
        if (spi) {
            this._suggestionPopulateInfo = null;
            spi.cts.cancel();
        }
    }
}

export enum SuggestTextboxDropdownState {
    IDLE,
    POPULATING,
    FAILED
}

export class SuggestTextboxItemViewModel extends ObservableBase {
    constructor(value: string, displayText?: string, selectable?: boolean) {
        super();
        this.value = value;
        this.displayText = displayText ?? value;
        this.selectable = selectable ?? true;
    }

    readonly value: string;

    readonly displayText: string;

    readonly selectable: boolean;
}