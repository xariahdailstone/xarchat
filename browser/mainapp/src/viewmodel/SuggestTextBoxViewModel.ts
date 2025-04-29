import { CancellationToken, CancellationTokenSource } from "../util/CancellationTokenSource";
import { ObservableValue } from "../util/Observable";
import { ObservableBase } from "../util/ObservableBase";
import { AppViewModel } from "./AppViewModel";

export type SuggestionItem = string | SuggestionHeader | SuggestionSeparator;
export type PopulateSuggestionsFunc = (value: string, cancellationToken: CancellationToken) => Promise<SuggestionItem[]>;

export class SuggestionHeader {
    constructor(public readonly title: string) { }
}

export class SuggestionSeparator {
    static instance: SuggestionSeparator = new SuggestionSeparator();

    constructor() { }
}

export class SuggestTextBoxViewModel extends ObservableBase {
    constructor(
        public readonly appViewModel: AppViewModel,
        public readonly populateSuggestionsFunc: PopulateSuggestionsFunc) {
        super();
    }

    private _value: ObservableValue<string> = new ObservableValue("");

    get value() { return this._value.value; }
    set value(v) {
        if (v != this._value.value) {
            this._value.value = v;
            this.onValueChanged(v, false);
        }
    }

    onValueChangedFunc: ((v: string) => void) | null = null;

    suggestionsEnabled: boolean = false;

    assignValueNoSuggest(v: string) {
        if (v != this._value.value) {
            this._value.value = v;
            this.onValueChanged(v, true);
        }
    }

    private _currentSuggestions: ObservableValue<SuggestionItem[] | null> = new ObservableValue(null);

    get currentSuggestions() { return this._currentSuggestions.value; }

    private _currentPopulateRunCancellationTokenSource: CancellationTokenSource | null = null;

    private stopCurrentPopulation() {
        if (this._currentPopulateRunCancellationTokenSource) {
            this._currentPopulateRunCancellationTokenSource.cancel();
            this._currentPopulateRunCancellationTokenSource = null;
        }
    }

    private _lastValue: string = "";
    private async onValueChanged(v: string, noSuggest: boolean): Promise<void> {
        this.stopCurrentPopulation();

        if (v != this._lastValue && !noSuggest && this.suggestionsEnabled) {
            this._lastValue = v;
            const myCancellationTokenSource = new CancellationTokenSource();
            this._currentPopulateRunCancellationTokenSource = myCancellationTokenSource;
            this._currentSuggestions.value = null;
            try {
                const r = await this.populateSuggestionsFunc(v, myCancellationTokenSource.token);
                if (this._currentPopulateRunCancellationTokenSource == myCancellationTokenSource) {
                    this._currentSuggestions.value = r;
                }
            }
            catch (e) {
                if (this._currentPopulateRunCancellationTokenSource == myCancellationTokenSource) {
                    this._currentSuggestions.value = null;
                }
                this.logger.logError("Failed to populate suggestions", e);
            }
            finally {
                if (this._currentPopulateRunCancellationTokenSource == myCancellationTokenSource) {
                    this._currentPopulateRunCancellationTokenSource = null;
                }
                myCancellationTokenSource.cancel();
            }
        }
        else {
            this._currentSuggestions.value = null;
        }

        if (this.onValueChangedFunc) {
            this.onValueChangedFunc(v);
        }
    }
}