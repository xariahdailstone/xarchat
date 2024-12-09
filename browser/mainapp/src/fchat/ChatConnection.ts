import { ChannelName } from "../shared/ChannelName";
import { CharacterName } from "../shared/CharacterName";
import { OnlineStatus } from "../shared/OnlineStatus";
import { TypingStatus } from "../shared/TypingStatus";
import { IDisposable } from "../util/Disposable";
import { IdleDetectionScreenState, IdleDetectionUserState } from "../util/IdleDetection";
import { ChatChannelMessageMode } from "../viewmodel/ChatChannelViewModel";


export interface ChatConnection extends IDisposable {
    readonly disposed: boolean;

    readonly extendedFeaturesEnabled: boolean;
    
    identifyAsync(accountName: string, characterName: CharacterName, ticket: string): Promise<void>;
    disconnect(): Promise<void>;
    logOut(): Promise<void>;

    quiesceAsync(): Promise<void>;

    joinChannelAsync(channel: ChannelName): Promise<void>;
    leaveChannelAsync(channel: ChannelName): Promise<void>;
    closeChannelTab(channel: ChannelName): Promise<void>;
    markChannelSeen(channel: ChannelName): Promise<void>;

    channelSendMessageAsync(channel: ChannelName, message: string): Promise<void>;
    channelAdMessageAsync(channel: ChannelName, message: string): Promise<void>;
    channelPerformRollAsync(channel: ChannelName, rollSpecification: string): Promise<void>;
    channelPerformBottleSpinAsync(channel: ChannelName): Promise<void>;

    setIdleStatusAsync(userState: IdleDetectionUserState, screenState: IdleDetectionScreenState): Promise<void>;
    setStatusAsync(status: OnlineStatus, statusMessage: string): Promise<void>;
    setTypingStatusAsync(chanracter: CharacterName, typingStatus: TypingStatus): Promise<void>;
    privateMessageSendAsync(character: CharacterName, message: string): Promise<void>;
    privateMessagePerformRollAsync(character: CharacterName, rollSpecification: string): Promise<void>;
    openPrivateMessageTab(character: CharacterName): Promise<void>;
    closePrivateMessageTab(character: CharacterName): Promise<void>;
    markPMConvoSeen(character: CharacterName): Promise<void>;

    markConsoleSeen(): Promise<void>;

    getPublicChannelsAsync(): Promise<ChannelMetadata[]>; // TODO:
    getPrivateChannelsAsync(): Promise<ChannelMetadata[]>; // TODO:

    kickFromChannelAsync(channel: ChannelName, character: CharacterName): Promise<void>;
    banFromChannelAsync(channel: ChannelName, character: CharacterName): Promise<void>;
    inviteToChannelAsync(channel: ChannelName, character: CharacterName): Promise<void>;

    ignoreCharacterAsync(character: CharacterName): Promise<void>;
    unignoreCharacterAsync(character: CharacterName): Promise<void>;
    notifyIgnoredAsync(character: CharacterName): Promise<void>;
}

export interface ChannelMetadata {
    name: ChannelName;
    title: string;
    count: number;
    mode?: ChatChannelMessageMode;
}