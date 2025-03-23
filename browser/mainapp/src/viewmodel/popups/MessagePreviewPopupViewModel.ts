import { BBCodeParseResult, ChatBBCodeParser } from "../../util/bbcode/BBCode";
import { DisposableOwnerField } from "../../util/Disposable";
import { ObservableValue } from "../../util/Observable";
import { observableProperty } from "../../util/ObservableBase";
import { StringUtils } from "../../util/StringUtils";
import { ActiveLoginViewModel } from "../ActiveLoginViewModel";
import { ChannelViewModel } from "../ChannelViewModel";
import { ContextPopupViewModel, PopupViewModel } from "./PopupViewModel";

export class MessagePreviewPopupViewModel extends ContextPopupViewModel {
    constructor(
        private readonly channelViewModel: ChannelViewModel | null,
        private readonly activeLoginViewModel: ActiveLoginViewModel,
        contextElement: HTMLElement) {

        super(activeLoginViewModel.appViewModel, contextElement);
    }

    get appViewModel() { return this.activeLoginViewModel.appViewModel; }

    private readonly _rawText: ObservableValue<string> = new ObservableValue("");
    get rawText(): string { return this._rawText.value; }
    set rawText(value: string) {
        if (value !== this._rawText.value) {
            this._rawText.value = value;

            if (StringUtils.isNullOrWhiteSpace(value)) {
                this._parseResult.value = null;
            }
            else {
                this._parseResult.value = ChatBBCodeParser.parse(value, { 
                    sink: this.activeLoginViewModel.bbcodeSink, 
                    addUrlDomains: true, 
                    appViewModel: this.appViewModel, 
                    activeLoginViewModel: this.activeLoginViewModel,
                    channelViewModel: this.channelViewModel ?? undefined,
                    imagePreviewPopups: true,
                    syncGifs: true
                });
            }
        }
    }

    private readonly _parseResult: DisposableOwnerField<BBCodeParseResult> = new DisposableOwnerField();

    @observableProperty
    get parseResult() { return this._parseResult.value; }

    dismissed(): void {
        this.rawText = "";
        this._parseResult.dispose();
        super.dismissed();
    }
}