import { ChannelName } from "../shared/ChannelName";
import { CharacterName } from "../shared/CharacterName";
import { OnlineStatus } from "../shared/OnlineStatus";
import { TypingStatus } from "../shared/TypingStatus";
import { IDisposable } from "../util/Disposable";
import { IdleDetectionScreenState, IdleDetectionUserState } from "../util/IdleDetection";
import { ChatChannelMessageMode } from "../viewmodel/ChatChannelViewModel";


export interface ChatConnection extends IDisposable {
    readonly isDisposed: boolean;

    readonly extendedFeaturesEnabled: boolean;

    debug_injectReceivedMessage(message: string): void;
    debug_outputMessage(message: string): void;
    
    identifyAsync(accountName: string, characterName: CharacterName, ticket: string): Promise<void>;
    disconnect(): Promise<void>;
    logOut(): Promise<void>;

    quiesceAsync(): Promise<void>;

    joinChannelAsync(channel: ChannelName, titleHint?: string): Promise<void>;
    leaveChannelAsync(channel: ChannelName): Promise<void>;
    closeChannelTab(channel: ChannelName): Promise<void>;
    markChannelSeen(channel: ChannelName): Promise<void>;

    checkChannelSendMessageAsync(channel: ChannelName, message: string): Promise<void>;
    channelSendMessageAsync(channel: ChannelName, message: string): Promise<void>;
    checkChannelAdMessageAsync(channel: ChannelName, message: string): Promise<void>;
    channelAdMessageAsync(channel: ChannelName, message: string): Promise<void>;
    channelPerformRollAsync(channel: ChannelName, rollSpecification: string): Promise<void>;
    channelPerformBottleSpinAsync(channel: ChannelName): Promise<void>;

    setIdleStatusAsync(userState: IdleDetectionUserState, screenState: IdleDetectionScreenState): Promise<void>;
    setStatusAsync(status: OnlineStatus, statusMessage: string): Promise<void>;
    setTypingStatusAsync(chanracter: CharacterName, typingStatus: TypingStatus): Promise<void>;
    checkPrivateMessageSendAsync(character: CharacterName, message: string): Promise<void>;
    privateMessageSendAsync(character: CharacterName, message: string): Promise<void>;
    privateMessagePerformRollAsync(character: CharacterName, rollSpecification: string): Promise<void>;
    openPrivateMessageTab(character: CharacterName): Promise<void>;
    closePrivateMessageTab(character: CharacterName): Promise<void>;
    markPMConvoSeen(character: CharacterName): Promise<void>;

    markConsoleSeen(): Promise<void>;

    getPublicChannelsAsync(): Promise<ChannelMetadata[]>; // TODO:
    getPrivateChannelsAsync(): Promise<ChannelMetadata[]>; // TODO:

    kickFromChannelAsync(channel: ChannelName, character: CharacterName): Promise<void>;
    timeoutFromChannelAsync(channel: ChannelName, character: CharacterName, minutes: number): Promise<void>;
    banFromChannelAsync(channel: ChannelName, character: CharacterName): Promise<void>;
    inviteToChannelAsync(channel: ChannelName, character: CharacterName): Promise<void>;
    channelSetOwnerAsync(channel: ChannelName, character: CharacterName): Promise<void>;
    unbanFromChannelAsync(channel: ChannelName, character: CharacterName): Promise<void>;
    getChannelBanListAsync(channel: ChannelName): Promise<ChannelBanListInfo>;
    getChannelOpListAsync(channel: ChannelName): Promise<ChannelOpListInfo>;
    channelAddOpAsync(channel: ChannelName, character: CharacterName): Promise<void>;
    channelRemoveOpAsync(channel: ChannelName, character: CharacterName): Promise<void>;
    channelSetModeAsync(channel: ChannelName, mode: "chat" | "ads" | "both"): Promise<void>;
    changeChannelPrivacyStatusAsync(channel: ChannelName, status: "public" | "private"): Promise<void>;

    createChannelAsync(title: string): Promise<ChannelName>;
    changeChannelDescriptionAsync(channel: ChannelName, description: string): Promise<void>;

    ignoreCharacterAsync(character: CharacterName): Promise<void>;
    unignoreCharacterAsync(character: CharacterName): Promise<void>;
    notifyIgnoredAsync(character: CharacterName): Promise<void>;

    performPartnerSearchAsync(args: PartnerSearchArgs): Promise<PartnerSearchResult>;

    submitReportAsync(logId: number, text: string, channel: string): Promise<void>;
}

export interface ChannelOpListInfo {
    channelTitle: string;
    ops: CharacterName[];
}
export interface ChannelBanListInfo {
    channelTitle: string;
    bans: CharacterName[];
}

export interface PartnerSearchArgs {
    genders: readonly string[];
    orientations: readonly string[];
    roles: readonly string[];
    positions: readonly string[];
    languages: readonly string[];
    furryprefs: readonly string[];
    kinks: readonly string[];
}

export interface PartnerSearchResult {
    characters: CharacterName[];
}

export interface ChannelMetadata {
    name: ChannelName;
    title: string;
    count: number;
    mode?: ChatChannelMessageMode;
}

export class IdentificationFailedError extends Error {
    constructor(message?: string, options?: ErrorOptions) {
        super(message ?? "Identification Failed", options);
    }
}