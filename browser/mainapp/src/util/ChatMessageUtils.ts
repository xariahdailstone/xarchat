import { StatusDotLightweight } from "../components/StatusDot";
import { CharacterGenderConvert } from "../shared/CharacterGender";
import { CharacterName } from "../shared/CharacterName";
import { CharacterStatus } from "../shared/CharacterSet";
import { ActiveLoginViewModel } from "../viewmodel/ActiveLoginViewModel";
import { AppViewModel } from "../viewmodel/AppViewModel";
import { ChannelMessageType, ChannelViewModel } from "../viewmodel/ChannelViewModel";
import { CharacterLinkUtils } from "./CharacterLinkUtils";
import { getEffectiveCharacterNameDocFragment } from "./CharacterNameIcons";
import { DateUtils } from "./DateUtils";
import { asDisposable, IDisposable } from "./Disposable";

interface AbstractChatMessage {
    readonly appViewModel: AppViewModel;
    readonly activeLoginViewModel: ActiveLoginViewModel;
    readonly channelViewModel?: ChannelViewModel;

    readonly uniqueMessageId: number;
    readonly type: ChannelMessageType;
    readonly text: string;
    readonly timestamp: Date;
    readonly characterStatus: Omit<CharacterStatus, "equals">;
    readonly containsPing: boolean;

    readonly parsedText: HTMLElement;

    incrementParsedTextUsage(): void;
    decrementParsedTextUsage(): void;
}

export class ChatMessageUtils {
    static renderChatMessageInto(vm: AbstractChatMessage): [HTMLDivElement, IDisposable] {
        const resultDisposables: IDisposable[] = [];
        //let resultDisposable: IDisposable = EmptyDisposable;

        let elMain = document.createElement("div");
        elMain.classList.add("messageitem");

        let isSystemMessage = vm.type == ChannelMessageType.SYSTEM || vm.type == ChannelMessageType.SYSTEM_IMPORTANT;

        let emoteStyle: ("none" | "normal" | "possessive") = "none";
        if (vm.type == ChannelMessageType.CHAT && vm.text.startsWith("/me ")) {
            emoteStyle = "normal";
        }
        else if (vm.type == ChannelMessageType.CHAT && vm.text.startsWith("/me's ")) {
            emoteStyle = "possessive";
        }

        const elTimestamp = document.createElement("span");
        elTimestamp.classList.add("timestamp");
        const tsText = "[" + DateUtils.formatForChatTimestamp(vm.timestamp) + "]";
        elTimestamp.innerText = tsText;
        elTimestamp.setAttribute("data-copycontent", `[sub]${tsText}[/sub]`);
        elMain.appendChild(elTimestamp);

        const elTsSpacer = document.createElement("span");
        elTsSpacer.classList.add("timestamp-spacer");
        elTsSpacer.innerText = " ";
        elMain.appendChild(elTsSpacer);

        if (vm.type == ChannelMessageType.AD) {
            // const elAd = document.createElement("div");
            // elAd.classList.add("ad-flag");
            
            // const elAdInner = document.createElement("x-iconimage");
            // elAdInner.classList.add("ad-flag-inner");
            // elAdInner.setAttribute("src", "assets/ui/ad-icon.svg");

            // elAd.appendChild(elAdInner);
            // elMain.appendChild(elAd);

            // const elAdSpacer = document.createElement("span");
            // elAdSpacer.classList.add("ad-spacer");
            // elAdSpacer.innerText = " ";
            // elMain.appendChild(elAdSpacer);
        }

        if (vm.type == ChannelMessageType.ROLL) {
            const elDiceIcon = document.createElement("span");
            elDiceIcon.classList.add("dice-icon");
            elDiceIcon.innerText = "\u{1F3B2} ";
            elMain.appendChild(elDiceIcon);
        }
        else if (vm.type == ChannelMessageType.SPIN) {
            const elBottleIcon = document.createElement("span");
            elBottleIcon.classList.add("dice-icon");
            elBottleIcon.innerText = "\u{1F37E} ";
            elMain.appendChild(elBottleIcon);
        }

        if (!isSystemMessage) {
            const sdLightweight = new StatusDotLightweight();
            sdLightweight.status = vm.characterStatus.status;
            sdLightweight.element.classList.add("character-status");
            sdLightweight.element.setAttribute("data-copycontent", "");
            elMain.appendChild(sdLightweight.element);
            resultDisposables.push(sdLightweight);

            // const elUsernameStatus = document.createElement("x-statusdot");
            // elUsernameStatus.classList.add("character-status");
            // elUsernameStatus.setAttribute("status", OnlineStatusConvert.toString(vm.characterStatus.status));
            // elUsernameStatus.setAttribute("statusmessage", vm.characterStatus.statusMessage);
            // elMain.appendChild(elUsernameStatus);

            const elCSSpacer = document.createElement("span");
            elCSSpacer.classList.add("character-status-spacer");
            elCSSpacer.setAttribute("data-copycontent", "");
            elCSSpacer.innerText = " ";
            elMain.appendChild(elCSSpacer);
        }

        const elUsername = document.createElement("span");
        elUsername.classList.add("character");
        if (!isSystemMessage) {
            elUsername.classList.add("gender-" + (CharacterGenderConvert.toString(vm.characterStatus.gender) ?? "none"));
            elUsername.setAttribute("data-copycontent", `[user]${vm.characterStatus.characterName.value}[/user]`);
            CharacterLinkUtils.setupCharacterLink(elUsername, vm.activeLoginViewModel, vm.characterStatus.characterName, vm.channelViewModel ?? null);
        }
        const ecnFrag = getEffectiveCharacterNameDocFragment(vm.characterStatus.characterName, vm.channelViewModel ?? vm.activeLoginViewModel);
        elUsername.appendChild(ecnFrag);
        elMain.appendChild(elUsername);

        let spacerText = "";
        switch (vm.type) {
            case ChannelMessageType.ROLL:
                spacerText = " ";
                break;
            case ChannelMessageType.SPIN:
                spacerText = " ";
                break;
            case ChannelMessageType.CHAT:
                if (emoteStyle == "none") {
                    spacerText = ": "
                }
                else if (emoteStyle == "normal") {
                    spacerText = " ";
                }
                else if (emoteStyle == "possessive") {
                    spacerText = "'s ";
                }
                break;
            case ChannelMessageType.AD:
                spacerText = ": ";
                break;
            case ChannelMessageType.SYSTEM:
            case ChannelMessageType.SYSTEM_IMPORTANT:
                spacerText = ": ";
                break;
        }
        const elUsernameSpacer = document.createElement("span");
        elUsernameSpacer.classList.add("character-spacer");
        elUsernameSpacer.innerText = spacerText;
        elMain.appendChild(elUsernameSpacer); 

        const elMessageText = document.createElement("span");
        elMessageText.classList.add("messagetext");
        vm.incrementParsedTextUsage();
        resultDisposables.push(asDisposable(() => vm.decrementParsedTextUsage()));
        elMessageText.appendChild(vm.parsedText);
        elMain.appendChild(elMessageText);

        elMain.classList.toggle("emote", (emoteStyle != "none"));
        elMain.classList.toggle("ad", (vm.type == ChannelMessageType.AD));
        elMain.classList.toggle("system", isSystemMessage);
        elMain.classList.toggle("important", (vm.type == ChannelMessageType.SYSTEM_IMPORTANT));
        elMain.classList.toggle("has-ping", vm.containsPing);
        elMain.classList.toggle("from-me", CharacterName.equals(vm.characterStatus.characterName, vm.activeLoginViewModel.characterName));

        return [elMain, asDisposable(...resultDisposables)];
    }
}