import { BBCodeParseOptions, BBCodeParser, BBCodeParseResult, ChatBBCodeParser, SystemMessageBBCodeParser } from "../../util/bbcode/BBCode";
import { CancellationToken, CancellationTokenSource } from "../../util/CancellationTokenSource";
import { IDisposable } from "../../util/Disposable";
import { HostInterop } from "../../util/hostinterop/HostInterop";
import { KeyCodes } from "../../util/KeyCodes";
import { Observable, ObservableValue } from "../../util/Observable";
import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { XarChatUtils } from "../../util/XarChatUtils";
import { AppViewModel } from "../AppViewModel";
import { DialogButtonStyle, DialogButtonViewModel, DialogViewModel } from "./DialogViewModel";

export class AboutViewModel extends DialogViewModel<boolean> implements IDisposable {
    constructor(parent: AppViewModel) {
        super(parent);

        this.title = "About XarChat";

        this.buttons.add(new DialogButtonViewModel({
            title: "OK",
            shortcutKeyCode: KeyCodes.RETURN,
            onClick: () => { this.close(false); },
            style: DialogButtonStyle.DEFAULT
        }));
        
        this.closeBoxResult = false;
        this._setAcknowledgementsText("Loading acknowledgements...");

        this._loadAcknowledgementsAsync(this._disposeCTS.token);

        this._loadSupportInfoAsync(this._disposeCTS.token);
    }

    private readonly _disposeCTS: CancellationTokenSource = new CancellationTokenSource();

    private _disposed = false;
    get isDisposed() { return this._disposed; }

    dispose(): void {
        if (!this._disposed) {
            this._disposed = true;
            this._disposeCTS.cancel();
            this.acknowledgements?.dispose();
            this.acknowledgements = null;
            this.supportInfo?.dispose();
            this.supportInfo = null;
        }
    }
    [Symbol.dispose](): void {
        this.dispose();
    }

    readonly productName = "XarChat";

    get clientVersion() { return XarChatUtils.clientVersion; }
    get clientPlatform() { return XarChatUtils.clientPlatform; }
    get clientBranch() { return XarChatUtils.clientBranch; }

    get fullClientVersion() { return XarChatUtils.getFullClientVersionString(); }

    private readonly _supportInfo: ObservableValue<BBCodeParseResult | null> = new ObservableValue(null);

    get supportInfo() { return this._supportInfo.value; }
    set supportInfo(value: BBCodeParseResult | null) {
        if (value != this._supportInfo.value) {
            const currentValue = this._supportInfo.value;

            if (this._disposed) {
                value?.dispose();
                value = null;
            }

            this._supportInfo.value = value;
            if (currentValue) {
                currentValue.dispose();
            }
        }
    }

    private readonly _acknowledgements: ObservableValue<BBCodeParseResult | null> = new ObservableValue<BBCodeParseResult | null>(null);

    get acknowledgements(): BBCodeParseResult | null { return this._acknowledgements.value; }
    set acknowledgements(value: BBCodeParseResult | null) {
        if (value != this._acknowledgements.value) {
            const currentValue = this._acknowledgements.value;

            if (this._disposed) {
                value?.dispose();
                value = null;
            }

            this._acknowledgements.value = value;
            if (currentValue) {
                currentValue.dispose();
            }
        }
    }

    _setAcknowledgementsText(text: string) {
        if (!this._disposed) {
            const pres = SystemMessageBBCodeParser.parse(text, this.bbcodeParseOptions);
            this.acknowledgements = pres;
        }
        else {
            this.acknowledgements = null;
        }
    }

    private get bbcodeParseOptions(): BBCodeParseOptions {
        return {
            sink: this.parent.bbcodeParseSink,
            addUrlDomains: false, 
            appViewModel: this.parent, 
            activeLoginViewModel: undefined,
            channelViewModel: undefined,
            imagePreviewPopups: false,
            syncGifs: false
        };
    }

    private async _loadAcknowledgementsAsync(cancellationToken: CancellationToken) {
        try {
            this.logger.logInfo("Starting credits load...");
            const resp = await fetch("/app/credits.bbcode", {
                signal: cancellationToken.signal
            });
            if (cancellationToken.isCancellationRequested) return;

            let rtext = await resp.text();
            if (cancellationToken.isCancellationRequested) return;

            rtext = rtext.replace(/\r/g, "");
            rtext = rtext.replace(/\n\n?/g, (s) => {
                if (s == "\n\n") { return "\n\n"; }
                return " ";
            });

            this.logger.logInfo("Completing credits load...");
            this._setAcknowledgementsText(rtext);

            this.logger.logInfo("Completed credits load.");
        }
        catch (e) {
            this.logger.logError("Credits load failed.", e);
            this._setAcknowledgementsText("Unable to load acknowledgements.");
        }
    }

    private async _loadSupportInfoAsync(cancellationToken: CancellationToken) {
        try {
            const fresp = await HostInterop.noCorsFetch({ url: "https://xariah.net/xarchat/supportinfo", method: "get" }, cancellationToken);
            if (cancellationToken.isCancellationRequested) return;
            const fhtml = await fresp.text();
            if (cancellationToken.isCancellationRequested) return;
            const template = document.createElement("template");
            template.innerHTML = fhtml;
            const tnode = template.content.cloneNode(true) as Element;
            const contentEl = tnode.querySelector("#elContent");
            if (contentEl) {
                let rtext =  (contentEl as HTMLElement).innerHTML
                rtext = rtext.replace(/\r/g, "");
                rtext = rtext.replace(/\n\n?/g, (s) => {
                    if (s == "\n\n") { return "\n\n"; }
                    return " ";
                });
                this._setSupportInfoText(rtext);
            }
        }
        catch (e) {
        }
    }

    _setSupportInfoText(text: string) {
        if (!this._disposed) {
            const pres = SystemMessageBBCodeParser.parse(text, this.bbcodeParseOptions);
            this.supportInfo = pres;
        }
        else {
            this.supportInfo = null;
        }
    }
}