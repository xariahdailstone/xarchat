import { OnlineStatus } from "../shared/OnlineStatus";
import { Optional } from "../util/Optional";

export interface RawAppSettings {
    savedWindowLocations: RawSavedWindowLocation[];
    savedAccountCredentials: RawSavedAccountCredentials[];
    lastUsedSavedAccount?: string;
    savedLogins: RawSavedLogin[];
    savedChatStates: RawSavedChatState[];
    autoIdleSec: Optional<number>;
}

export interface RawSavedWindowLocation {
    desktopMetrics: string;
    windowX: number;
    windowY: number;
    windowWidth: number;
    windowHeight: number;
}

export interface RawSavedLogin {
    account: string;
    characterName: string;
}

export interface RawSavedAccountCredentials {
    account: string;
    password?: string;
}

export interface RawSavedChatState {
    characterName: string;
    lastLogin: number | null | undefined;
    joinedChannels: RawSavedChatStateJoinedChannel[];
    pinnedChannels: string[];
    pmConvos: RawSavedChatStatePMConvo[];
    statusMessage: string;
    onlineStatus: OnlineStatus;

    pinnedChannelSectionCollapsed: boolean;
    unpinnedChannelSectionCollapsed: boolean;
    pmConvosSectionCollapsed: boolean;
    selectedChannel?: string;

    pingWords: string[];

    autoAdSettings?: RawSavedChatStateAutoAdSettings;
}

export interface RawSavedChatStateAutoAdSettings {
    entries: RawSavedChatStateAutoAdSettingsEntry[];
    enabled: boolean;
}
export interface RawSavedChatStateAutoAdSettingsEntry {
    enabled: boolean;
    title: string;
    adText: string;
    targetChannels: string[];
    targetOnlineStatuses: string[];
}

export type RawSavedChatStateNamedFilterMap = RawSavedChatStateNamedFilterEntry[];
export interface RawSavedChatStateNamedFilterEntry {
    name: string;
    isSelected: boolean;
    filterClasses: string[];
    canPing?: boolean;
    controlsUnseenDot?: boolean;
    showInAdsOnlyChannel?: boolean;
    showInChatOnlyChannel?: boolean;
    showInBothAdsAndChatChannel?: boolean;
}
export interface RawSavedChatStateHasNamedFilters {
    namedFilters?: RawSavedChatStateNamedFilterMap;
}
export interface RawSavedChatStateJoinedChannel extends RawSavedChatStateHasNamedFilters {
    name: string;
    title: string;
    order: number;
    filters?: string[];
}

export interface RawSavedChatStatePMConvo extends RawSavedChatStateHasNamedFilters {
    character: string;
    lastInteraction: number;
    filters?: string[];
}