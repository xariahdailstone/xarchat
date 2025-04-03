import { ReportData } from "../../fchat/api/FListApi";
import { CharacterName } from "../../shared/CharacterName";
import { CancellationToken } from "../../util/CancellationTokenSource";
import { CatchUtils } from "../../util/CatchUtils";
import { ObservableValue } from "../../util/Observable";
import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { StringUtils } from "../../util/StringUtils";
import { XarChatUtils } from "../../util/XarChatUtils";
import { ActiveLoginViewModel } from "../ActiveLoginViewModel";
import { AppViewModel } from "../AppViewModel";
import { ChannelMessageType, ChannelViewModel } from "../ChannelViewModel";
import { ChatChannelViewModel } from "../ChatChannelViewModel";
import { ConsoleChannelViewModel } from "../ConsoleChannelViewModel";
import { PMConvoChannelViewModel } from "../PMConvoChannelViewModel";
import { DialogButtonStyle, DialogButtonViewModel, DialogViewModel } from "./DialogViewModel";

export enum ReportSource {
    PROFILE_POPUP,
    PROFILE_DIALOG,
    CHANNEL_HEADER
}

export class ReportViewModel extends DialogViewModel<boolean> {
    constructor(
        public readonly activeLoginViewModel: ActiveLoginViewModel,
        public readonly reportSource: ReportSource,
        public readonly targetCharacter?: CharacterName,
        public readonly targetChannel?: ChannelViewModel) {

        super(activeLoginViewModel.appViewModel);

        if (this.targetCharacter && this.targetChannel) {
            if (this.targetChannel instanceof ChatChannelViewModel) {
                this.title = `Report Character [${this.targetCharacter.value}] in Channel [${this.targetChannel.title}]`;
            }
            else if (this.targetChannel instanceof PMConvoChannelViewModel) {
                this.title = `Report Character [${this.targetCharacter.value}] in PM Conversation [${this.targetChannel.title}]`;
            }
            else {
                this.title = `Report Character [${this.targetCharacter.value}] in Tab [${this.targetChannel.title}]`;
            }
        }
        else if (this.targetCharacter) {
            this.title = `Report Character [${this.targetCharacter.value}]`;
        }
        else if (this.targetChannel) {
            this.title = `Report Channel [${this.targetChannel.title}]`;
        }
        else {
            this.title = `Report`;
        }

        const btnCancel = this.buttons.add(new DialogButtonViewModel({
            title: "Cancel",
            onClick: async() => {
                this.close(false);
            },
            style: DialogButtonStyle.CANCEL
        }));
        const btnSubmit = this.buttons.add(new DialogButtonViewModel({
            title: "Submit Report",
            onClick: async() => {
                if (this.canSubmit) {
                    if (await this.submitAsync()) {
                        this.close(true);
                    }
                }
                else {
                    await this.activeLoginViewModel.appViewModel.alertAsync(
                        "Please fill out the report completely before submitting.",
                        "Incomplete Report"
                    );
                }
            },
            style: DialogButtonStyle.NORMAL
        }));
        this.closeBoxResult = false;

        this._submitting.addEventListener("propertychange", e => {
            btnCancel.enabled = !this._submitting.value;
            btnSubmit.enabled = !this._submitting.value;
            this.closeBoxResult = !this._submitting.value ? false : undefined;
        });
        this._reportText.addEventListener("propertychange", e => {
            this._canSubmit.value = !StringUtils.isNullOrWhiteSpace(this._reportText.value);
        });
    }

    private readonly _reportText: ObservableValue<string> = new ObservableValue<string>("");

    @observableProperty
    get reportText(): string { return this._reportText.value; }
    set reportText(value) { this._reportText.value = value; }

    private readonly _submitting: ObservableValue<boolean> = new ObservableValue(false);

    @observableProperty
    get submitting(): boolean { return this._submitting.value; }
    set submitting(value) { this._submitting.value = value; }

    private readonly _canSubmit: ObservableValue<boolean> = new ObservableValue(false);

    @observableProperty
    get canSubmit() { return this._canSubmit.value; }

    async submitAsync(): Promise<boolean> {
        let errMsg: string | null;
        try {
            errMsg = await this.submitAsyncInternal();
        }
        catch (e) {
            errMsg = CatchUtils.getMessage(e);
        }
        if (errMsg) {
            await this.parent.alertAsync("The report failed to submit:\r\n\r\n" + errMsg,
                "Report Failed");
            return false;
        }
        else {
            return true;
        }
    }

    async submitAsyncInternal(): Promise<string | null> {
        if (!this.canSubmit) {
            return "The report is not fully filled out.";
        }

        try {
            this.submitting = true;

            let log: string[];
            switch (this.reportSource) {
                case ReportSource.CHANNEL_HEADER:
                case ReportSource.PROFILE_POPUP:
                    log = this.getReportMessages();
                    break;
                case ReportSource.PROFILE_DIALOG:
                    log = [
                        `****** There are no message logs, this report was submitted on the profile of [user]${this.targetCharacter!.value}[/user], not from a chat channel or PM conversation.`,
                    ];
                    break;
            }
            log = [...log, `****** Logs generated by the XarChat chat client, version ${XarChatUtils.clientVersion}.`];

            const tab =
                this.targetChannel instanceof ChatChannelViewModel ? `${this.targetChannel.title} (${this.targetChannel.name.value})`
                : this.targetChannel instanceof PMConvoChannelViewModel ? `Conversation with ${this.targetChannel.character.value}`
                : this.targetChannel instanceof ConsoleChannelViewModel ? "Console"
                : (this.reportSource == ReportSource.PROFILE_DIALOG && this.targetCharacter) ? `Profile for ${this.targetCharacter.value}`
                : "(unknown)";
    
            const text = (this.targetCharacter ? `Reporting user: [user]${this.targetCharacter.value}[/user] | ` : "") + this.reportText;
    
            const rd: ReportData = {
                character: this.activeLoginViewModel.characterName,
                reportText: text,
                log: JSON.stringify(log),
                channel: tab,
                text: true,
                reportUser: this.targetCharacter
            }
    
            const logId = await this.activeLoginViewModel.authenticatedApi.submitReportAsync(rd, CancellationToken.NONE);
            if (logId == null) {
                return "No log_id returned from report-submit.php API";
            }

            await this.activeLoginViewModel.chatConnection.submitReportAsync(logId, text, this.targetChannel?.title ?? "(unknown)");
            return null;
        }
        catch (e) {
            return CatchUtils.getMessage(e);
        }
        finally {
            this.submitting = false;
        }
    }

    private formatTime(date: Date): string {
        const pad = (x: any) => {
            const s = x?.toString() ?? "";
            if (s.length == 1) { return `0${s}`; }
            return s;
        }
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    private getReportMessages(): string[] {
        if (!this.targetChannel) { return []; }

        const results: string[] = [];
        for (let msgp of this.targetChannel.messages.iterateValues()) {
            const msg = msgp.key;

            let text = `[${this.formatTime(msg.timestamp)}] `;
            let skip = false;

            switch (msg.type) {
                case ChannelMessageType.CHAT:
                    text += `${msg.characterStatus.characterName.value}: ${msg.text}`;
                    break;
                case ChannelMessageType.AD:
                    text += `{AD} ${msg.characterStatus.characterName.value}: ${msg.text}`;
                    break;
                case ChannelMessageType.ROLL:
                    text += `{ROLL} ${msg.characterStatus.characterName.value} ${msg.text}`;
                    break;
                case ChannelMessageType.SPIN:
                    text += `{BOTTLE} ${msg.characterStatus.characterName.value} ${msg.text}`;
                    break;
                case ChannelMessageType.SYSTEM:
                case ChannelMessageType.SYSTEM_IMPORTANT:
                    text += `{SYS} ${msg.characterStatus.characterName.value}: ${msg.text}`;
                    break;
                case ChannelMessageType.LOG_NAV_PROMPT:
                case ChannelMessageType.TYPING_STATUS_INDICATOR:
                    skip = true;
                    break;
            }
            if (!skip) {
                results.push(text + "\r\n");
            }
        }

        return results;
    }

}

