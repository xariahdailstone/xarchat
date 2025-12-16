import { KeyValuePair } from "../../util/collections/KeyValuePair";
import { IDisposable } from "../../util/Disposable";
import { LogChannelMessage, LogPMConvoMessage } from "../../util/hostinterop/HostInterop";
import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { StringUtils } from "../../util/StringUtils";
import { TransientChannelStreamViewModel, ChannelViewModel } from "../ChannelViewModel";
import { LogSearchResultsMessageGroupViewModel } from "./LogSearchResultsMessageGroupViewModel";
import { LogSearchResultsViewModel } from "./LogSearchResultsViewModel";

const MAX_MESSAGES_PER_SET = 500;

export class LogSearchResultsMessageGroupSetViewModel extends ObservableBase implements IDisposable {
    constructor(
        public readonly results: LogSearchResultsViewModel,
        channelTitle: string,
        messages: (LogChannelMessage[] | LogPMConvoMessage[])) {

        super();

        let curStart = "";
        let curChannel: TransientChannelStreamViewModel = new TransientChannelStreamViewModel(results.session, channelTitle);
        curChannel.lazyLoadImages = true;
        const completeArray = () => {
            const lastMsg = curChannel.messages[curChannel.messages.length - 1]!.value;
            const curEnd = lastMsg.timestamp.getHours().toString() + ":" + StringUtils.leftPad(lastMsg.timestamp.getMinutes().toString(), "0", 2);
            this.groups.push(new LogSearchResultsMessageGroupViewModel(
                `${curStart}-${curEnd}`, this, curChannel));

            curStart = "";
            curChannel = new TransientChannelStreamViewModel(results.logSearch.session, channelTitle);
            curChannel.lazyLoadImages = true;
        };

        for (let msg of messages) {
            if (curChannel.messages.length == 0) {
                curStart = msg.timestamp.getHours().toString() + ":" + StringUtils.leftPad(msg.timestamp.getMinutes().toString(), "0", 2);
            }
            if ((msg as any).myCharacterName) {
                // LogPMConvoMessage
                const lpcm = msg as LogPMConvoMessage;
                const mvm = ChannelViewModel.convertFromLoggedMessage(curChannel, results.session, results.session.appViewModel, lpcm)!;
                curChannel.messages.add(new KeyValuePair(mvm, mvm));
            }
            else {
                // LogChannelMessage
                const lcm = msg as LogChannelMessage;
                const mvm = ChannelViewModel.convertFromLoggedMessage(curChannel, results.session, results.session.appViewModel, lcm)!;
                curChannel.messages.add(new KeyValuePair(mvm, mvm));
            }
            if (curChannel.messages.length >= MAX_MESSAGES_PER_SET) {
                completeArray();
            }
        }
        if (curChannel.messages.length > 0) {
            completeArray();
        }

        this.selectedGroup = this.groups[this.groups.length - 1];
    }

    private _isDisposed: boolean = false;
    get isDisposed() { return this._isDisposed; }
    dispose() {
        for (let g of this.groups) {
            g.dispose();
        }
    }
    [Symbol.dispose]() { this.dispose(); }

    readonly groups: LogSearchResultsMessageGroupViewModel[] = [];

    @observableProperty
    selectedGroup: (LogSearchResultsMessageGroupViewModel | null) = null;

    async navigateToLastAsync() {
        if (this.groups.length == 0) { return; }
        const g = this.groups[this.groups.length - 1];

        this.selectedGroup = g;
    }
}
