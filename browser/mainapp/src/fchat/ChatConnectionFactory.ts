import { ChannelName } from "../shared/ChannelName";
import { CharacterName } from "../shared/CharacterName";
import { OnlineStatus } from "../shared/OnlineStatus";
import { TypingStatus } from "../shared/TypingStatus";
import { EventListenerUtil } from "../util/EventListenerUtil";
import { HostInterop } from "../util/HostInterop";
import { IdleDetectionScreenState, IdleDetectionUserState } from "../util/IdleDetection";
import { PromiseSource } from "../util/PromiseSource";
import { SnapshottableSet } from "../util/collections/SnapshottableSet";
import { ChannelMetadata, ChatConnection } from "./ChatConnection";
import { ChatConnectionImpl } from "./ChatConnectionImpl";
import { ChatConnectionSink } from "./ChatConnectionSink";
import { ProfileInfo } from "./api/FListApi";

export class ChatConnectionFactoryImpl {
    create(sink: Partial<ChatConnectionSink>): Promise<ChatConnection> {
        // if (HostInterop.isInXarChatHost) {
        //     return this.createWithHostInterop(sink);
        // }
        // else {
            return this.createWithWebSocket(sink);
        // }
    }

    // async createWithHostInterop(sink: Partial<ChatConnectionSink>): Promise<ChatConnection> {
    //     const x = await HostInterop.openSocketAsync("wss://flprox.evercrest.com/connect");
    //     const cci = new ChatConnectionImpl(sink, data => { x.sendAsync(data); });
    //     cci.ondisposed = () => {
    //         x.dispose();
    //     };
        
    //     (async function() {
    //         while (true) {
    //             const recvd = await x.receiveAsync();
    //             if (recvd != null) {
    //                 cci.processIncomingData(recvd);
    //             }
    //             else {
    //                 cci.dispose();
    //                 break;
    //             }
    //         }
    //     })();
    //     return cci;
    // }

    readonly _openWebSockets: SnapshottableSet<WebSocket> = new SnapshottableSet();

    createWithWebSocket(sink: Partial<ChatConnectionSink>): Promise<ChatConnection> {
        return new Promise<ChatConnection>((resolve, reject) => {
            let zws: WebSocket | null = null;
            let completed = false;
            let socketSendFailure: (string | null) = "Socket not yet open";
            let zcci: ChatConnectionImpl | null = null;
            try {
                let url = new URL(`wss://${document.location.host}/api/chatSocket`);
                const sp = new URLSearchParams(document.location.search);
                if (sp.has("wsport")) {
                    if (url.hostname == "localhost") {
                        url.port = sp.get("wsport")!;
                    }
                }
                //const ws = new WebSocket(`wss://${document.location.host}/api/chatSocket`);
                const ws = new WebSocket(url.href);
                zws = ws;
                const cci = new ChatConnectionImpl(sink, data => { 
                    if (socketSendFailure == null) {
                        ws.send(data); 
                    }
                    else {
                        throw new Error(`Cannot send: ${socketSendFailure}`);
                    }
                });
                zcci = cci;
                this._openWebSockets.add(ws);
                ws.onopen = (e) => {
                    socketSendFailure = null;
                    if (!completed) {
                        completed = true;
                        resolve(cci);
                    }
                };
                ws.onmessage = (e) => {
                    if (completed) {
                        cci.processIncomingData(e.data);
                    }
                };
                ws.onclose = (e) => {
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

    async joinChannelAsync(channel: ChannelName): Promise<void> {
    }

    async leaveChannelAsync(channel: ChannelName): Promise<void> {
    }

    async channelSendMessageAsync(channel: ChannelName, message: string): Promise<void> {
    }

    async channelAdMessageAsync(channel: ChannelName, message: string): Promise<void> {
    }

    async setTypingStatusAsync(chanracter: CharacterName, typingStatus: TypingStatus): Promise<void> {
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
    async banFromChannelAsync(channel: ChannelName, character: CharacterName): Promise<void> { }
    async inviteToChannelAsync(channel: ChannelName, character: CharacterName): Promise<void> { }

    async ignoreCharacterAsync(character: CharacterName): Promise<void> { }
    async unignoreCharacterAsync(character: CharacterName): Promise<void> { }
    async notifyIgnoredAsync(character: CharacterName): Promise<void> { }

    dispose(): void {
    }

    [Symbol.dispose]() { this.dispose(); }

    get disposed() { return false; }

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