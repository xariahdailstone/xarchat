import { ChannelName } from "../shared/ChannelName";
import { CharacterGender } from "../shared/CharacterGender";
import { CharacterName } from "../shared/CharacterName";
import { CharacterStatus } from "../shared/CharacterSet";
import { OnlineStatus } from "../shared/OnlineStatus";
import { ChatChannelMessageMode } from "../viewmodel/ChatChannelViewModel";

export interface ChatConnectionSink {
    disconnectedFromServer(reason: ChatDisconnectReason): void;

    identified(character: CharacterName): void;
    serverVariableSet(varName: string, varValue: any): void;
    serverHelloReceived(message: string): void;
    connectedCharactersCountReceived(count: number): void;
    serverErrorReceived(number: number, message: string): void;
    addConsoleMessage(data: ChannelMessageData): void;
    broadcastMessageReceived(data: BroadcastMessageData): void;

    bookmarkCharactersAdded(characters: CharacterName[], isInitial: boolean): void;
    bookmarkCharactersRemoved(characters: CharacterName[]): void;

    ignoredCharactersAdded(characters: CharacterName[], isInitial: boolean): void;
    ignoredCharactersRemoved(characters: CharacterName[]): void;

    friendAdded(character: CharacterName): void;
    friendRemoved(character: CharacterName): void;
    friendRequestReceived(character: CharacterName): void;

    interestAdded(character: CharacterName): void;
    interestRemoved(character: CharacterName): void;

    serverOpsAdded(characters: CharacterName[], isInitial: boolean): void;
    serverOpsRemoved(characters: CharacterName[]): void;

    charactersStatusUpdated(statuses: Partial<CharacterStatus>[], isInitial: boolean, isOnlineOffline: boolean): void;
    characterCameOnline(character: CharacterName): void;
    characterWentOffline(character: CharacterName): void;

    joinedChannel(channel: ChannelName, title: string): void;
    leftChannel(channel: ChannelName): void;
    kickedFromChannel(channel: ChannelName, operator: CharacterName): void;
    bannedFromChannel(channel: ChannelName, operator: CharacterName): void;
    timedOutFromChannel(channel: ChannelName, operator: CharacterName, lengthMin: number): void;
    channelModeChanged(channel: ChannelName, mode: ChatChannelMessageMode): void;
    channelOwnerChanged(channel: ChannelName, character: CharacterName | null, isInitial: boolean): void;
    channelOpsAdded(channel: ChannelName, characters: CharacterName[], isInitial: boolean): void;
    channelOpRemoved(channel: ChannelName, character: CharacterName): void;
    channelCharactersJoined(channel: ChannelName, character: CharacterName[], isInitial: boolean): void;
    channelCharactersLeft(channel: ChannelName, character: CharacterName[]): void;
    channelCharacterKicked(channel: ChannelName, operator: CharacterName, kickedCharacter: CharacterName): void;
    channelCharacterBanned(channel: ChannelName, operator: CharacterName, bannedCharacter: CharacterName): void;
    channelCharacterTimedOut(channel: ChannelName, operator: CharacterName, timedOutCharacter: CharacterName, lengthMin: number): void;
    channelDescriptionChanged(channel: ChannelName, description: string): void;
    channelMessageReceived(channel: ChannelName, data: ChannelMessageData): void;
    //channelAdReceived(channel: ChannelName, character: CharacterName, message: string): void;
    channelRollReceived(channel: ChannelName, data: RollData): void;
    channelSpinReceived(channel: ChannelName, data: BottleSpinData): void;
    channelInviteReceived(channel: ChannelName, sender: CharacterName, title: string): void;
    channelClear(channel: ChannelName): void;

    //channelBacklogMessageReceived(channel: ChannelName, other: any): void; // TODO:

    pmConvoMessageReceived(convoCharacter: CharacterName, data: ChannelMessageData): void;
    pmConvoRollReceived(convoCharacter: CharacterName, data: RollData): void;
    pmConvoClear(convoCharacter: CharacterName): void;

    consoleClear(): void;

    noteReceived(sender: CharacterName, subject: string, noteId: number): void;

    systemMessageReceived(channel: (ChannelName | null), message: string): void;

    markChannelReplaying(channelName: ChannelName): void;
    markPmConvoReplaying(characterName: CharacterName): void;

    debugCommandReceived(cmd: string): void;
    debugCommandSent(cmd: string): void;
}

export enum ChatDisconnectReason {
    UNEXPECTED_DISCONNECT,
    REQUESTED_DISCONNECT,
    KICKED_FROM_SERVER
}

export interface MaybeHistorical {
    asOf?: Date;
    gender?: CharacterGender | null;
    status?: OnlineStatus | null;
    seen?: boolean;
    isHistorical?: boolean;
}

export interface ChannelMessageData extends MaybeHistorical {
    isAd: boolean;
    speakingCharacter: CharacterName;
    message: string;
    seen: boolean;
}

export interface RollData extends MaybeHistorical {
    rollingCharacter: CharacterName;
    endResult: number; // e.g. 1962
    message: string;  // e.g. "[user]character[/user] rolls 9d500: [b]1962[/b]"
    individualResults: number[];  // e.g. [1962]
    individualRolls: string[];  // e.g. ["9d500"]
}

export interface BottleSpinData extends MaybeHistorical {
    spinningCharacter: CharacterName;
    targetCharacter: CharacterName;
}

export interface BroadcastMessageData extends MaybeHistorical {
    message: string;
    historicalChannel?: ChannelName;
    historicalPMConvoInterlocutor?: CharacterName;
}

export function completeSink(inner: Partial<ChatConnectionSink>): ChatConnectionSink {
    const nullFunc = () => {};

    const result = new Proxy(inner, {
        get: (target, p, recv) => {
            const ix = Reflect.get(inner, p);
            if (ix) {
                if (typeof ix == "function") {
                    return (ix as Function).bind(inner);
                }
                return ix;
            }
            else {
                return nullFunc;
            }
        }
    });

    return result as ChatConnectionSink;
}