import { ChannelName } from "../shared/ChannelName";
import { CharacterName } from "../shared/CharacterName";
import { OnlineStatus } from "../shared/OnlineStatus";
import { TypingStatus } from "../shared/TypingStatus";
import { EventListenerUtil } from "../util/EventListenerUtil";
import { HostInterop } from "../util/hostinterop/HostInterop";
import { IdleDetectionScreenState, IdleDetectionUserState } from "../util/IdleDetection";
import { PromiseSource } from "../util/PromiseSource";
import { Scheduler } from "../util/Scheduler";
import { SnapshottableSet } from "../util/collections/SnapshottableSet";
import { ChannelBanListInfo, ChannelMetadata, ChannelOpListInfo, ChatConnection, PartnerSearchArgs, PartnerSearchResult } from "./ChatConnection";
import { ChatConnectionImpl } from "./ChatConnectionImpl";
import { ChatConnectionSink } from "./ChatConnectionSink";
import { ProfileInfo } from "./api/FListApi";
import { ChatWebSocket } from "../util/hostinterop/IHostInterop";

const testDisconnectActions = new Map<object, () => void>();
(window as any).__getSocketCount = () => { return testDisconnectActions.size; };
(window as any).__testDisconnect = () => {
    for (let a of [...testDisconnectActions.values()]) {
        a();
    }
};

export class ChatConnectionFactoryImpl {
    create(sink: Partial<ChatConnectionSink>): Promise<ChatConnection> {
        return this.createWithWebSocket(sink);
    }

    readonly _openWebSockets: SnapshottableSet<ChatWebSocket> = new SnapshottableSet();

    createWithWebSocket(sink: Partial<ChatConnectionSink>): Promise<ChatConnection> {
        return new Promise<ChatConnection>((resolve, reject) => {
            let zws: ChatWebSocket | null = null;
            let completed = false;
            let socketSendFailure: (string | null) = "Socket not yet open";
            let zcci: ChatConnectionImpl | null = null;
            try {
                const ws = HostInterop.createChatWebSocket();
                zws = ws;
                const cci = new ChatConnectionImpl(sink, data => { 
                        if (socketSendFailure == null) {
                            ws.send(data); 
                        }
                        else {
                            throw new Error(`Cannot send: ${socketSendFailure}`);
                        }
                    },
                    () => {
                        try { ws.close(); }
                        catch { }
                    });
                zcci = cci;
                this._openWebSockets.add(ws);
                const testDisconnectKey = {};
                testDisconnectActions.set(testDisconnectKey, () => ws.close());
                ws.onopen = (e) => {
                    socketSendFailure = null;
                    if (!completed) {
                        completed = true;
                        resolve(cci);
                    }
                };
                ws.onmessage = (e) => {
                    if (completed) {
                        Scheduler.scheduleNamedCallback("ChatConnectionFactory.createWithWebSocket.onmessage", ["idle", 100], () => {
                            cci.processIncomingData(e.data);
                        });
                    }
                };
                ws.onclose = (e) => {
                    testDisconnectActions.delete(testDisconnectKey);
                    this._openWebSockets.delete(ws);
                    socketSendFailure = "Socket was closed";
                    if (!completed) {
                        completed = true;
                        reject();
                    }
                    else {
                        cci.dispose();
                    }
                };
                ws.onerror = (e) => {
                    this._openWebSockets.delete(ws);
                    socketSendFailure = "Socket was closed by error";
                    if (!completed) {
                        completed = true;
                        reject();
                    }
                    else {
                        cci.dispose();
                    }
                };
            }
            catch (e) {
                if (zws) {
                    this._openWebSockets.delete(zws);
                    socketSendFailure = "Socket was closed by unexpected error";
                    if (!completed) {
                        completed = true;
                        reject();
                        try {
                            zws?.close();
                        }
                        catch { }
                    }
                    else {
                        zcci?.dispose();
                    }
                }
            }
        });
    }

    debugKillOpenSockets() {
        this._openWebSockets.forEachValueSnapshotted(ws => {
            ws.close();
        });
    }
}

export class NullChatConnection implements ChatConnection {
    constructor() {
    }

    debug_injectReceivedMessage(message: string): void {
    }

    debug_outputMessage(message: string): void {
    }

    async markChannelSeen(channel: ChannelName): Promise<void> {
    }

    async markPMConvoSeen(character: CharacterName): Promise<void> {
    }

    async markConsoleSeen(): Promise<void> {
    }

    async closeChannelTab(channel: ChannelName): Promise<void> {
    }

    async openPrivateMessageTab(character: CharacterName): Promise<void> {
    }

    async closePrivateMessageTab(character: CharacterName): Promise<void> {
    }

    async channelPerformRollAsync(channel: ChannelName, rollSpecification: string): Promise<void> {
    }

    async channelPerformBottleSpinAsync(channel: ChannelName): Promise<void> {
    }

    async privateMessagePerformRollAsync(character: CharacterName, rollSpecification: string): Promise<void> {
    }

    async setIdleStatusAsync(userState: IdleDetectionUserState, screenState: IdleDetectionScreenState): Promise<void> {
    }

    async setStatusAsync(status: OnlineStatus, statusMessage: string): Promise<void> {
    }

    async joinChannelAsync(channel: ChannelName, titleHint?: string): Promise<void> {
    }

    async leaveChannelAsync(channel: ChannelName): Promise<void> {
    }

    async checkChannelSendMessageAsync(channel: ChannelName, message: string): Promise<void> {
    }

    async channelSendMessageAsync(channel: ChannelName, message: string): Promise<void> {
    }

    async checkChannelAdMessageAsync(channel: ChannelName, message: string): Promise<void> {
    }

    async channelAdMessageAsync(channel: ChannelName, message: string): Promise<void> {
    }

    async setTypingStatusAsync(chanracter: CharacterName, typingStatus: TypingStatus): Promise<void> {
    }

    async checkPrivateMessageSendAsync(character: CharacterName, message: string): Promise<void> {
    }

    async privateMessageSendAsync(character: CharacterName, message: string): Promise<void> {
    }

    async identifyAsync(accountName: string, characterName: CharacterName, ticket: string): Promise<void> {
    }

    async quiesceAsync(): Promise<void> {
    }

    async disconnect(): Promise<void> {
    }

    async logOut(): Promise<void> {
    }

    async getPublicChannelsAsync(): Promise<ChannelMetadata[]> {
        return [];
    }

    async getPrivateChannelsAsync(): Promise<ChannelMetadata[]> {
        return [];
    }

    async kickFromChannelAsync(channel: ChannelName, character: CharacterName): Promise<void> { }
    async timeoutFromChannelAsync(channel: ChannelName, character: CharacterName, minutes: number): Promise<void> { }
    async banFromChannelAsync(channel: ChannelName, character: CharacterName): Promise<void> { }
    async inviteToChannelAsync(channel: ChannelName, character: CharacterName): Promise<void> { }
    async channelSetOwnerAsync(channel: ChannelName, character: CharacterName): Promise<void> { }
    async unbanFromChannelAsync(channel: ChannelName, character: CharacterName): Promise<void> { }
    async getChannelBanListAsync(channel: ChannelName): Promise<ChannelBanListInfo> { throw new Error("unavailable"); }
    async getChannelOpListAsync(channel: ChannelName): Promise<ChannelOpListInfo> { throw new Error("unavailable"); }
    async channelAddOpAsync(channel: ChannelName, character: CharacterName): Promise<void> { }
    async channelRemoveOpAsync(channel: ChannelName, character: CharacterName): Promise<void> { }
    async channelSetModeAsync(channel: ChannelName, mode: "chat" | "ads" | "both"): Promise<void> { }
    async changeChannelPrivacyStatusAsync(channel: ChannelName, status: "public" | "private"): Promise<void> { }

    async createChannelAsync(title: string): Promise<ChannelName> { throw new Error("unavailable"); }
    async changeChannelDescriptionAsync(channel: ChannelName, description: string): Promise<void> { }

    async ignoreCharacterAsync(character: CharacterName): Promise<void> { }
    async unignoreCharacterAsync(character: CharacterName): Promise<void> { }
    async notifyIgnoredAsync(character: CharacterName): Promise<void> { }

    async performPartnerSearchAsync(args: PartnerSearchArgs): Promise<PartnerSearchResult> { throw new Error("unavailable"); }

    async submitReportAsync(logId: number, text: string, channel: string): Promise<void> { throw new Error("unavailable"); }

    dispose(): void {
    }

    [Symbol.dispose]() { this.dispose(); }

    get isDisposed() { return false; }

    get extendedFeaturesEnabled() { return false; }
}

export interface ChatMessage {
    code: string;
    body?: any;
}

export interface TypedChatMessage<T> {
    code: string;
    body: T;
}

export interface Handleable {
    handled: boolean;
}

export type HandleableChatMessage = ChatMessage & Handleable;
export type HandleableTypedChatMessage<T> = TypedChatMessage<T> & Handleable;

export const ChatConnectionFactory = new ChatConnectionFactoryImpl();
(window as any).__chatConnectionFactory = ChatConnectionFactory;