import { IDisposable } from "../../util/Disposable";
import { ObservableBase } from "../../util/ObservableBase";
import { TransientChannelStreamViewModel } from "../ChannelViewModel";
import { LogSearchResultsMessageGroupSetViewModel } from "./LogSearchResultsMessageGroupSetViewModel";


export class LogSearchResultsMessageGroupViewModel extends ObservableBase implements IDisposable {
    constructor(
        public readonly timeRangeString: string,
        public readonly groupSet: LogSearchResultsMessageGroupSetViewModel,
        public readonly channel: TransientChannelStreamViewModel) {

        super();
    }

    private _isDisposed: boolean = false;
    get isDisposed() { return this._isDisposed; }
    dispose() {
        this.channel.dispose();
    }
    [Symbol.dispose]() { this.dispose(); }
}
