import { BBCodeParseResult, ChatBBCodeParser } from "../../util/bbcode/BBCode";
import { ChatMessageUtils } from "../../util/ChatMessageUtils";
import { asDisposable } from "../../util/Disposable";
import { ChannelMessageType } from "../../viewmodel/ChannelViewModel";
import { LogSearch2ResultItemViewModel } from "../../viewmodel/newlogsearch/LogSearch2ResultItemViewModel";
import { componentArea, componentElement, ComponentBase } from "../ComponentBase";
import { logSearch2ItemViewFor } from "./LogSearch2";

@logSearch2ItemViewFor(LogSearch2ResultItemViewModel)
@componentArea("newlogsearch")
@componentElement("x-lv2sampleitem")
export class SampleItem extends ComponentBase<LogSearch2ResultItemViewModel> {
    constructor() {
        super();

        // this.watchExpr(vm => vm, vm => {
        //     if (vm) {
        //         //this.elMain.innerHTML = ``;
        //         (this.elMain as any).__vm = vm;
        //     }
        //     else {
        //         this.elMain.innerHTML = "";
        //     }
        // });

        const elTimestamp = this.$("elTimestamp") as HTMLDivElement;
        const elTypeIcon = this.$("elTypeIcon") as HTMLDivElement;
        const elSpeakingCharacter = this.$("elSpeakingCharacter") as HTMLDivElement;
        const elSpeakingSeparator = this.$("elSpeakingSeparator") as HTMLDivElement;
        const elMessageType = this.$("elMessageType") as HTMLDivElement;

        this.whenConnectedWithViewModel(vm => {
            (this.elMain as any).__vm = vm;
            let parseResult: BBCodeParseResult | null = null;
            let refCount: number = 0;
            const rcmResult = ChatMessageUtils.renderChatMessageInto({
                appViewModel: vm.appViewModel,
                activeLoginViewModel: vm.activeLoginViewModel,
                channelViewModel: undefined,
                uniqueMessageId: 0,
                type: vm.messageType as ChannelMessageType,
                text: vm.text,
                timestamp: vm.timestamp,
                characterStatus: vm.activeLoginViewModel.characterSet.getCharacterStatus(vm.speakingCharacter),
                containsPing: false,

                get parsedText(): HTMLElement {
                    if (!parseResult) {
                        parseResult = ChatBBCodeParser.parse(vm.text, {
                            sink: vm.activeLoginViewModel.bbcodeSink
                        });
                    }
                    return parseResult.element;
                },
                incrementParsedTextUsage(): void {
                    refCount++;
                },
                decrementParsedTextUsage(): void { 
                    refCount = Math.max(0, refCount - 1);
                    if (refCount == 0) {
                        parseResult?.dispose();
                        parseResult = null;
                    }
                },
            });
            
            const el = rcmResult[0];
            const resultDisposable = rcmResult[1];
            this.elMain.appendChild(el);
            return asDisposable(() => {
                el.remove();
                resultDisposable.dispose();
                delete (this.elMain as any).__vm;
            })
        });
    }

    protected get myRequiredStylesheets() {
        return [ 
            ...super.myRequiredStylesheets,
            `styles/components/ChannelMessageCollectionView-import.css`
        ];
    }
}
