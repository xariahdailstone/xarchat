import { ChannelName } from "../shared/ChannelName";
import { CharacterGender, CharacterGenderConvert } from "../shared/CharacterGender";
import { CharacterName } from "../shared/CharacterName";
import { CharacterStatus } from "../shared/CharacterSet";
import { OnlineStatus, OnlineStatusConvert } from "../shared/OnlineStatus";
import { TypingStatus, TypingStatusConvert } from "../shared/TypingStatus";
import { AsyncBuffer } from "../util/AsyncBuffer";
import { ChatChannelMessageMode, ChatChannelMessageModeConvert } from "../viewmodel/ChatChannelViewModel";
import { BottleSpinData, ChatConnectionSink, ChatDisconnectReason, RollData, completeSink } from "./ChatConnectionSink";
import { ServerADLMessage, ServerAOPMessage, ServerBROMessage, ServerCBUMessage, ServerCDSMessage, ServerCHAMessage, ServerCIUMessage, ServerCKUMessage, ServerCOAMessage, ServerCOLMessage, ServerCONMessage, ServerCORMessage, ServerCSOMessage, ServerCTUMessage, ServerERRMessage, ServerFLNMessage, ServerFRLMessage, ServerHLOMessage, ServerICHMessage, ServerIDNMessage, ServerIGNMessage, ServerJCHMessage, ServerLCHMessage, ServerLISMessage, ServerLRPMessage, ServerMSGMessage, ServerNLNMessage, ServerORSMessage, ServerPRIMessage, ServerRLLMessage, ServerRTBMessage, ServerSTAMessage, ServerSYSMessage, ServerTPNMessage, ServerVARMessage, ServerXHMMessage } from "./ServerMessages";
import { ChatMessage, Handleable, TypedChatMessage, HandleableTypedChatMessage, HandleableChatMessage } from "./ChatConnectionFactory";
import { ChannelMetadata, ChatConnection } from "./ChatConnection";
import { IncomingMessageSink } from "./IncomingMessageSink";
import { PromiseSource } from "../util/PromiseSource";
import { Mutex } from "../util/Mutex";
import { CancellationToken, CancellationTokenSource } from "../util/CancellationTokenSource";
import { StringUtils } from "../util/StringUtils";
import { ProfileInfo } from "./api/FListApi";
import { ServerErrorNumbers } from "./ServerErrorNumbers";
import { TaskUtils } from "../util/TaskUtils";
import { IdleDetectionScreenState, IdleDetectionUserState } from "../util/IdleDetection";
import { XarChatUtils } from "../util/XarChatUtils";
import { Logger, Logging } from "../util/Logger";
import { ImmutableList } from "../util/collections/ImmutableList";

export class ServerError extends Error {
    constructor(message: ChatMessage);
    constructor(errorNumber: number, message: string);
    constructor(arg1: ChatMessage | number, arg2?: string) {
        super(typeof arg1 == "number" ? arg2 : (arg1 as ChatMessage).body?.message);
        if (typeof arg1 == "number") {
            this.errorNumber = +arg1
        }
        else {
            this.errorNumber = +((arg1 as ChatMessage).body?.number ?? 0);
        }
    }

    readonly errorNumber: number;
}

const ERRAsFailure = (msg: ChatMessage) => {
    if (msg.code == "ERR") {
        throw new ServerError(msg);
    }
};

let nextChatConnId = 1;

export class ChatConnectionImpl implements ChatConnection {
    constructor(
        sink: Partial<ChatConnectionSink>,
        private readonly onOutgoingData: (data: string) => (Promise<void> | void)) {

        this._chatConnId = nextChatConnId++;
        this._logger = Logging.createLogger("ChatConnectionImpl");
        this._logger.enterScope(`id=#${this._chatConnId}`);

        this.sink = completeSink(sink);
        this.processIncomingDataLoop();
    }
    private readonly sink: ChatConnectionSink;

    private readonly _chatConnId: number;
    private readonly _logger: Logger;

    private _disposed = false;
    private _disposeCTS: CancellationTokenSource = new CancellationTokenSource();
    private _incomingMessageBuffer: AsyncBuffer<string> = new AsyncBuffer();

    private readonly _bracketedSendMutex: Mutex = new Mutex();
    
    async bracketedSendAsync(message: ChatMessage | null, callback?: (recvMsg: HandleableChatMessage) => void, cancellationToken?: CancellationToken) {
        using _ = await this._bracketedSendMutex.acquireAsync(cancellationToken);

        await this.sendMessageRawAsync({ code: "TPN", body: { character: this._identifiedCharacter.value, status: TypingStatusConvert.toString(TypingStatus.TYPING) }});
        if (message) {
            await this.sendMessageRawAsync(message);
        }
        await this.sendMessageRawAsync({ code: "TPN", body: { character: this._identifiedCharacter.value, status: TypingStatusConvert.toString(TypingStatus.NONE) }});

        using ms = this.createIncomingMessageSink();

        let inBracketedReceive = false;
        let bracketFinished = false;

        while (!bracketFinished) {
            await ms.readMessage((msg) => {
                if (msg.code == "TPN" && msg.body!.character == this._identifiedCharacter.value) {
                    const tstatus = msg.body!.status;
                    if (tstatus == TypingStatusConvert.toString(TypingStatus.TYPING)) {
                        inBracketedReceive = true;
                    }
                    else if (tstatus == TypingStatusConvert.toString(TypingStatus.NONE)) {
                        bracketFinished = true;
                    }
                }
                else {
                    if (inBracketedReceive && callback) {
                        callback(msg);
                    }
                }
            }, cancellationToken);
        }
    }

    private _requestedDisconnect = false;
    private _bannedFromChat = false;

    get extendedFeaturesEnabled(): boolean { return this._extendedFeaturesEnabled; }

    async disconnect(): Promise<void> {
        this._requestedDisconnect = true;
        this.dispose();
    }

    async logOut(): Promise<void> {
        if (this._extendedFeaturesEnabled) {
            this._requestedDisconnect = true;
            try {
                await this.bracketedSendAsync({ code: "MSG", body: { message: ".dc" }}, ERRAsFailure);
            }
            catch { }
        }
        else {
            await this.disconnect();
        }
    }

    async joinChannelAsync(channel: ChannelName): Promise<void> {
        await this.bracketedSendAsync({ code: "JCH", body: { channel: channel.value }}, ERRAsFailure);
    }

    async leaveChannelAsync(channel: ChannelName): Promise<void> {
        await this.bracketedSendAsync({ code: "LCH", body: { channel: channel.value }}, ERRAsFailure);
    }

    async closeChannelTab(channel: ChannelName): Promise<void> {
        if (this._extendedFeaturesEnabled) {
            // TODO?
        }
    }

    async markChannelSeen(channel: ChannelName): Promise<void> {
        if (this._extendedFeaturesEnabled) {
            await this.sendMessageRawAsync({ code: "XSN", body: { tabid: "ch:" + channel.value }});
        }
    }

    async channelSendMessageAsync(channel: ChannelName, message: string): Promise<void> {
        await this.bracketedSendAsync({ code: "MSG", body: { channel: channel.value, message: message }}, ERRAsFailure);
    }

    async channelAdMessageAsync(channel: ChannelName, message: string): Promise<void> {
        await this.bracketedSendAsync({ code: "LRP", body: { channel: channel.value, message: message }}, ERRAsFailure);
    }

    async channelPerformRollAsync(channel: ChannelName, rollSpecification: string): Promise<void> {
        this.bracketedSendAsync({ code: "RLL", body: { channel: channel.value, dice: rollSpecification }}, ERRAsFailure);
    }

    async channelPerformBottleSpinAsync(channel: ChannelName): Promise<void> {
        this.bracketedSendAsync({ code: "RLL", body: { channel: channel.value, dice: "bottle" }}, ERRAsFailure);
    }

    async setIdleStatusAsync(userState: IdleDetectionUserState, screenState: IdleDetectionScreenState): Promise<void> {
        if (this._extendedFeaturesEnabled) {
            await this.setIdleStatusExtendedAsync(userState, screenState);
        }
        else {
            await this.setIdleStatusDirectAsync(userState, screenState);
        }
    }

    private _restoreIdleStatus: OnlineStatus | null = null;
    private async setIdleStatusDirectAsync(userState: IdleDetectionUserState, screenState: IdleDetectionScreenState): Promise<void> {
        let overrideStatus: OnlineStatus | null = null;

        const curStatus = { status: this._myOnlineStatus, statusMessage: this._myStatusMessage };

        if (screenState == "locked") {
            overrideStatus = OnlineStatus.AWAY;
        }
        else if (userState == "idle") {
            overrideStatus = OnlineStatus.IDLE;
        }
        
        if (overrideStatus) {
            if (this._restoreIdleStatus == null) {
                this._restoreIdleStatus = curStatus.status;
            }
            if (curStatus.status != overrideStatus) {
                this.setStatusAsync(overrideStatus, curStatus.statusMessage);
            }
        }
        else {
            if (this._restoreIdleStatus != null) {
                const restoreStatus = this._restoreIdleStatus;
                this._restoreIdleStatus = null;
                if (curStatus.status != restoreStatus) {
                    this.setStatusAsync(restoreStatus, curStatus.statusMessage);
                }
            }
        }
    }

    private async setIdleStatusExtendedAsync(userState: IdleDetectionUserState, screenState: IdleDetectionScreenState): Promise<void> {
        await this.sendMessageRawAsync({ code: "XIL", body: { state: userState, screen: screenState }});
    }

    async setStatusAsync(status: OnlineStatus, statusMessage: string): Promise<void> {
        let attemptCount = 0;
        let sendAgain = true;
        while (sendAgain) {
            sendAgain = false;
            attemptCount++;

            await this.bracketedSendAsync({ code: "STA", body: { 
                status: OnlineStatusConvert.toString(status).toLowerCase(), 
                statusmsg: statusMessage ?? "" 
            }}, (msg: HandleableChatMessage) => {
                if (msg.code == "ERR" && (msg.body as ServerERRMessage).number == ServerErrorNumbers.StatusUpdatesTooFast && (attemptCount < 8)) {
                    msg.handled = true;
                    sendAgain = true;
                }
                else {
                    ERRAsFailure(msg);
                }
            });

            if (sendAgain) {
                await TaskUtils.delay(1000);
            }
        }
    }

    async setTypingStatusAsync(character: CharacterName, typingStatus: TypingStatus): Promise<void> {
        await this.sendMessageRawAsync({ code: "TPN", body: { character: character.value, status: TypingStatusConvert.toString(typingStatus) }});
    }

    async privateMessageSendAsync(character: CharacterName, message: string): Promise<void> {
        await this.bracketedSendAsync({ code: "PRI", body: { recipient: character.value, message: message }}, ERRAsFailure);
    }

    async privateMessagePerformRollAsync(character: CharacterName, rollSpecification: string): Promise<void> {
        this.bracketedSendAsync({ code: "RLL", body: { recipient: character.value, dice: rollSpecification }}, ERRAsFailure);
    }

    async openPrivateMessageTab(character: CharacterName): Promise<void> {
        if (this._extendedFeaturesEnabled) {
            this.sendMessageRawAsync({ code: "XPM", body: { character: character.value, action: "opened" }});
        }
    }

    async closePrivateMessageTab(character: CharacterName): Promise<void> {
        if (this._extendedFeaturesEnabled) {
            this.sendMessageRawAsync({ code: "XPM", body: { character: character.value, action: "closed" }});
        }
    }

    async markPMConvoSeen(character: CharacterName): Promise<void> {
        if (this._extendedFeaturesEnabled) {
            await this.sendMessageRawAsync({ code: "XSN", body: { tabid: "pm:" + character.value }});
        }
    }

    async markConsoleSeen(): Promise<void> {
        if (this._extendedFeaturesEnabled) {
            await this.sendMessageRawAsync({ code: "XSN", body: { tabid: "console" }});
        }
    }

    async getPublicChannelsAsync(): Promise<ChannelMetadata[]> {
        const results: ChannelMetadata[] = [];

        await this.bracketedSendAsync({ code: "CHA" }, (msg) => {
            ERRAsFailure(msg);

            if (msg.code == "CHA") {
                const body = msg.body as ServerCHAMessage;
                for (let channel of body.channels) {
                    results.push({
                        name: ChannelName.create(channel.name),
                        title: StringUtils.unescapeHTMLChat(channel.name),
                        count: channel.characters,
                        mode: ChatChannelMessageModeConvert.toMode(channel.mode) ?? ChatChannelMessageMode.BOTH
                    });
                }
                msg.handled = true;
            }
        });

        return results;
    }

    async getPrivateChannelsAsync(): Promise<ChannelMetadata[]> {
        const results: ChannelMetadata[] = [];

        await this.bracketedSendAsync({ code: "ORS" }, (msg) => {
            ERRAsFailure(msg);

            if (msg.code == "ORS") {
                const body = msg.body as ServerORSMessage;
                for (let channel of body.channels) {
                    results.push({
                        name: ChannelName.create(channel.name),
                        title: StringUtils.unescapeHTMLChat(channel.title),
                        count: channel.characters
                    });
                }
                msg.handled = true;
            }
        });

        return results;
    }

    dispose() {
        if (!this._disposed) {
            this._disposed = true;
            this._disposeCTS.cancel();
            if (this.ondisposed) {
                try { this.ondisposed(); }
                catch { }
            }
        }
    }

    [Symbol.dispose]() { this.dispose(); }

    get disposed() { return this._disposed; }

    ondisposed: ((() => void)  | null) = null;

    processIncomingData(data: string) {
        this._incomingMessageBuffer.enqueue(data);
    }

    private async processIncomingDataLoop() {
        const cancellationToken = this._disposeCTS.token;

        try {
            let i = 0;
            while (true) { // TODO: exit condition
                //console.log("readmsg", ++i);
                const data = await this._incomingMessageBuffer.dequeueAsync(cancellationToken);
                //console.log("gotmsg", i);
                const msg = this.parseChatMessage(data);

                try {
                    if (msg.code == "PIN") {
                        await this.sendMessageRawAsync({ code: "PIN" });
                        msg.handled = true;
                        continue;
                    }

                    for (let tmsgsink of this._incomingMessageSinks) {
                        await tmsgsink.handleAsync(msg);
                        if (msg.handled) {
                            break;
                        }
                    }

                    if (!msg.handled) {
                        this.defaultMessageHandle(msg);
                    }
                }
                catch (e) {
                    this._logger.logWarn("FAILED handling message", msg, e);
                }
            }
        }
        catch (e) {
            this.handleDisconnect();

            if (!this._disposeCTS.isCancellationRequested) {
                throw e;
            }
            else {
                this._logger.logInfo("stopping message loop, disposed");
            }
        }
    }

    private parseChatMessage(data: string): (ChatMessage & Handleable) {
        const spaceIdx = data.indexOf(' ');
        let msg: (ChatMessage & Handleable);
        if (spaceIdx == -1) {
            msg = { code: data, handled: false };
        }
        else {
            const code = data.substring(0, spaceIdx);
            const body = data.substring(spaceIdx + 1);
            msg = { code: code, body: JSON.parse(body), handled: false };
        }
        return msg;
    }

    private readonly _serverVariables: Map<string, any> = new Map();

    private readonly _messageHandlers: Map<string, Function> = new Map();

    private defaultMessageHandle(msg: ChatMessage & Handleable) {
        let handler = this._messageHandlers.get(msg.code);
        if (!handler) {
            handler = (this as any)[`handle${msg.code}Message`];
            if (!handler || (typeof handler != "function")) {
                handler = () => {};
            }
            this._messageHandlers.set(msg.code, handler);
        }
        handler.call(this, msg);

        if (!msg.handled) {
            this._logger.logWarn("UNHANDLED", msg.code, msg.body);
        }
    }

    private _identifiedCharacter: CharacterName = CharacterName.create("");

    private handleDisconnect() {
        if (this._bannedFromChat) {
            this.sink.disconnectedFromServer(ChatDisconnectReason.KICKED_FROM_SERVER);
        }
        else if (this._requestedDisconnect) {
            this.sink.disconnectedFromServer(ChatDisconnectReason.REQUESTED_DISCONNECT);
        }
        else {
            this.sink.disconnectedFromServer(ChatDisconnectReason.UNEXPECTED_DISCONNECT);
        }
    }

    // character identified
    private handleIDNMessage(msg: HandleableTypedChatMessage<ServerIDNMessage>) {
        // this should be handled elsewhere
        // this._identifiedCharacter = CharacterName.create(msg.body.character);
        // this.sink.identified(this._identifiedCharacter);
        // msg.handled = true;
    }

    // set server variable
    private handleVARMessage(msg: HandleableTypedChatMessage<ServerVARMessage>) {
        this._serverVariables.set(msg.body.variable, msg.body.value);
        this.sink.serverVariableSet(msg.body.variable, msg.body.value);
        msg.handled = true;
    }

    // server hello
    private handleHLOMessage(msg: HandleableTypedChatMessage<ServerHLOMessage>) {
        this.sink.serverHelloReceived(msg.body.message);
        msg.handled = true;
    }

    // connected clients count
    private handleCONMessage(msg: HandleableTypedChatMessage<ServerCONMessage>) {
        this.sink.connectedCharactersCountReceived(msg.body.count);
        msg.handled = true;
    }

    private handleAOPMessage(msg: HandleableTypedChatMessage<ServerAOPMessage>) {
        this.sink.serverOpsAdded([ CharacterName.create(msg.body.character) ], false);
        msg.handled = true;
    }

    private handleDOPMessage(msg: HandleableTypedChatMessage<ServerAOPMessage>) {
        this.sink.serverOpsRemoved([ CharacterName.create(msg.body.character) ]);
        msg.handled = true;
    }

    // friends list
    private handleFRLMessage(msg: HandleableTypedChatMessage<ServerFRLMessage>) {
        this.sink.bookmarkCharactersAdded(msg.body.characters.map(n => CharacterName.create(n)), true);
        msg.handled = true;
    }

    // ignore list
    private handleIGNMessage(msg: HandleableTypedChatMessage<ServerIGNMessage>) {
        if (msg.body.action == "init") {
            this.sink.ignoredCharactersAdded(msg.body.characters!.map(n => CharacterName.create(n)), true);
            msg.handled = true;
        }
        else if (msg.body.action == "add") {
            const char = CharacterName.create(msg.body.character!);
            this.sink.ignoredCharactersAdded([ char ], false);
            msg.handled = true;
        }
        else if (msg.body.action == "delete") {
            const char = CharacterName.create(msg.body.character!);
            this.sink.ignoredCharactersRemoved([ char ]);
            msg.handled = true;
        }
        // TODO:
    }

    // server ops list
    private handleADLMessage(msg: HandleableTypedChatMessage<ServerADLMessage>) {
        this.sink.serverOpsAdded(msg.body.ops.map(x => CharacterName.create(x)), true);
        msg.handled = true;
    }

    // initial character list
    private handleLISMessage(msg: HandleableTypedChatMessage<ServerLISMessage>) {
        const mappedStatuses = msg.body.characters.map(f => {
            const name = CharacterName.create(f[0]);
            const gender = CharacterGenderConvert.toCharacterGender(f[1]);
            const stat = OnlineStatusConvert.toOnlineStatus(f[2]);
            const statMsg = this.unescapeHTML(f[3]);
            const x: Partial<CharacterStatus> = {
                characterName: name,
                gender: gender ?? undefined,
                status: stat ?? undefined,
                statusMessage: StringUtils.discardUnseen(statMsg),
                typingStatus: TypingStatus.NONE
            };
            return x;
        });
        this.sink.charactersStatusUpdated(mappedStatuses, true, false);

        msg.handled = true;
    }

    private handleBROMessage(msg: HandleableTypedChatMessage<ServerBROMessage>) {
        this.sink.broadcastMessageReceived({
            message: msg.body.message,
            isHistorical: false
        });

        msg.handled = true;
    }

    // character came online
    private handleNLNMessage(msg: HandleableTypedChatMessage<ServerNLNMessage>) {
        const x: Partial<CharacterStatus> = {
            characterName: CharacterName.create(msg.body.identity),
            gender: CharacterGenderConvert.toCharacterGender(msg.body.gender) ?? undefined,
            status: OnlineStatusConvert.toOnlineStatus(msg.body.status) ?? undefined,
            typingStatus: TypingStatus.NONE
        };
        this.sink.charactersStatusUpdated([x], false, true);
        this.sink.characterCameOnline(x.characterName!);

        msg.handled = true;
    }

    // character went offline
    private handleFLNMessage(msg: HandleableTypedChatMessage<ServerFLNMessage>) {
        const x: Partial<CharacterStatus> = {
            characterName: CharacterName.create(msg.body.character),
            gender: CharacterGender.NONE,
            status: OnlineStatus.OFFLINE,
            statusMessage: "",
            typingStatus: TypingStatus.NONE
        };
        this.sink.charactersStatusUpdated([x], false, true);
        this.sink.characterWentOffline(x.characterName!);

        msg.handled = true;
    }

    // character joined channel
    private handleJCHMessage(msg: HandleableTypedChatMessage<ServerJCHMessage>) {
        const chanName = ChannelName.create(msg.body.channel);
        const charName = CharacterName.create(msg.body.character.identity);
        if (CharacterName.equals(this._identifiedCharacter, charName)) {
            this.sink.joinedChannel(chanName, this.unescapeHTML(msg.body.title));
            msg.handled = true;
        }
        else {
            this.sink.channelCharactersJoined(chanName, [charName], false);
            msg.handled = true;
        }
    }

    // character left channel
    private handleLCHMessage(msg: HandleableTypedChatMessage<ServerLCHMessage>) {
        const chanName = ChannelName.create(msg.body.channel);
        const charName = CharacterName.create(msg.body.character);
        if (CharacterName.equals(this._identifiedCharacter, charName)) {
            this.sink.leftChannel(chanName);
            msg.handled = true;
        }
        else {
            this.sink.channelCharactersLeft(chanName, [charName]);
            msg.handled = true;
        }
    }

    // channel op list
    private handleCOLMessage(msg: HandleableTypedChatMessage<ServerCOLMessage>) {
        const chanName = ChannelName.create(msg.body.channel);
        this.sink.channelOwnerChanged(chanName, msg.body.oplist[0] != "" ? CharacterName.create(msg.body.oplist[0]) : null, true);

        const z: CharacterName[] = [];
        for (let i = 1; i < msg.body.oplist.length; i++) {
            z.push(CharacterName.create(msg.body.oplist[i]));
        }
        this.sink.channelOpsAdded(chanName, z, true);

        msg.handled = true;
    }

    private handleCOAMessage(msg: HandleableTypedChatMessage<ServerCOAMessage>) {
        const chanName = ChannelName.create(msg.body.channel);
        const char = CharacterName.create(msg.body.character);
        this.sink.channelOpsAdded(chanName, [ char ], false);
        msg.handled = true;
    }

    private handleCORMessage(msg: HandleableTypedChatMessage<ServerCORMessage>) {
        const chanName = ChannelName.create(msg.body.channel);
        const char = CharacterName.create(msg.body.character);
        this.sink.channelOpRemoved(chanName, char);
        msg.handled = true;
    }

    private handleCSOMessage(msg: HandleableTypedChatMessage<ServerCSOMessage>) {
        const chanName = ChannelName.create(msg.body.channel);
        const char = CharacterName.create(msg.body.character);
        this.sink.channelOwnerChanged(chanName, char, false);
        msg.handled = true;
    }


    // channel user list
    private handleICHMessage(msg: HandleableTypedChatMessage<ServerICHMessage>) {
        const chanName = ChannelName.create(msg.body.channel);
        this.sink.channelModeChanged(chanName, ChatChannelMessageModeConvert.toMode(msg.body.mode) ?? ChatChannelMessageMode.BOTH);

        const u = msg.body.users.map(x => CharacterName.create(x.identity));
        this.sink.channelCharactersJoined(chanName, u, true);

        msg.handled = true;
    }

    // channel description
    private handleCDSMessage(msg: HandleableTypedChatMessage<ServerCDSMessage>) {
        const chanName = ChannelName.create(msg.body.channel);
        this.sink.channelDescriptionChanged(chanName, this.unescapeHTML(msg.body.description));
        msg.handled = true;
    }

    private _myOnlineStatus: OnlineStatus = OnlineStatus.OFFLINE;
    private _myStatusMessage: string = "";

    // character status changed
    private handleSTAMessage(msg: HandleableTypedChatMessage<ServerSTAMessage>) {
        const staCharacter = CharacterName.create(msg.body.character);
        const x: Partial<CharacterStatus> = {
            characterName: staCharacter,
            status: OnlineStatusConvert.toOnlineStatus(msg.body.status) ?? undefined,
            statusMessage: this.unescapeHTML(msg.body.statusmsg)
        };
        this.sink.charactersStatusUpdated([x], false, false);

        if (staCharacter == this._identifiedCharacter) {
            this._myOnlineStatus = OnlineStatusConvert.toOnlineStatus(msg.body.status) ?? this._myOnlineStatus;
            this._myStatusMessage = this.unescapeHTML(msg.body.statusmsg) ?? this._myStatusMessage;
        }

        msg.handled = true;
    }

    private handleTPNMessage(msg: HandleableTypedChatMessage<ServerTPNMessage>) {
        this.sink.charactersStatusUpdated([
            { characterName: CharacterName.create(msg.body.character), typingStatus: TypingStatusConvert.toTypingStatus(msg.body.status) ?? TypingStatus.NONE }
        ], false, false);
        msg.handled = true;
    }

    private handlePRIMessage(msg: HandleableTypedChatMessage<ServerPRIMessage>) {
        const convoCharacter = CharacterName.create(msg.body!.character);
        const speakingCharacter = convoCharacter;
        this.sink.pmConvoMessageReceived(convoCharacter, {
                isAd: false,
                message: this.unescapeHTML(msg.body!.message),
                asOf: new Date(),
                speakingCharacter: speakingCharacter,
                seen: false
            });
        if (speakingCharacter != this._identifiedCharacter) {
            this.sink.charactersStatusUpdated([
                { characterName: speakingCharacter, typingStatus: TypingStatus.NONE }
            ], false, false);
        }

        msg.handled = true;
    }

    // channel message received
    private handleMSGMessage(msg: HandleableTypedChatMessage<ServerMSGMessage>) {
        const chanName = ChannelName.create(msg.body.channel);
        const charName = CharacterName.create(msg.body.character);
        this.sink.channelMessageReceived(chanName, {
            isAd: false,
            message: this.unescapeHTML(msg.body.message),
            speakingCharacter: charName,
            asOf: new Date(),
            seen: false
        });
        msg.handled = true;
    }

    // channel ad received
    private handleLRPMessage(msg: HandleableTypedChatMessage<ServerLRPMessage>) {
        const chanName = ChannelName.create(msg.body.channel);
        const charName = CharacterName.create(msg.body.character);
        this.sink.channelMessageReceived(chanName, {
            isAd: true,
            message: this.unescapeHTML(msg.body.message),
            speakingCharacter: charName,
            asOf: new Date(),
            seen: false
        });
        msg.handled = true;
    }

    // roll received (channel or private)
    private handleRLLMessage(msg: HandleableTypedChatMessage<ServerRLLMessage>) {
        if (msg.body.type == "dice") {
            const rollData: RollData = {
                rollingCharacter: CharacterName.create(msg.body.character),
                endResult: msg.body.endresult!,
                individualResults: msg.body.results!,
                individualRolls: msg.body.rolls!,
                message: msg.body.message
            };
            if (msg.body.channel) {
                this.sink.channelRollReceived(ChannelName.create(msg.body.channel!), rollData);
                msg.handled = true;
            }
            else {
                const char = CharacterName.create(msg.body.character);
                const recipient = CharacterName.create(msg.body.recipient!);
                const convoChar = this._identifiedCharacter == char ? recipient : char;
                this.sink.pmConvoRollReceived(convoChar, rollData);
                if (char != this._identifiedCharacter) {
                    this.sink.charactersStatusUpdated([
                        { characterName: char, typingStatus: TypingStatus.NONE }
                    ], false, false);
                }
                msg.handled = true;
            }
        }
        else if (msg.body.type == "bottle") {
            const spinData: BottleSpinData = {
                spinningCharacter: CharacterName.create(msg.body.character),
                targetCharacter: CharacterName.create(msg.body.target!)
            };
            this.sink.channelSpinReceived(ChannelName.create(msg.body.channel!), spinData);
            msg.handled = true;
        }
    }

    private handleCIUMessage(msg: HandleableTypedChatMessage<ServerCIUMessage>) {
        this.sink.channelInviteReceived(
            ChannelName.create(msg.body.name),
            CharacterName.create(msg.body.sender),
            msg.body.title
        );
        msg.handled = true;
    }

    // Real-time bridge (friends, notes, etc.)
    private handleRTBMessage(msg: HandleableTypedChatMessage<ServerRTBMessage>) {
        switch (msg.body.type) {
            case "trackadd":
                {
                    const charName = CharacterName.create(msg.body.name!);
                    this.sink.bookmarkCharactersAdded([charName], false);
                    msg.handled = true;
                }
                break;
            case "trackrem":
                {
                    const charName = CharacterName.create(msg.body.name!);
                    this.sink.bookmarkCharactersRemoved([charName]);
                    msg.handled = true;
                }
                break;
            case "note":
                {
                    const senderChar = CharacterName.create(msg.body.sender!);
                    const subject = msg.body.subject!;
                    const id = msg.body.id!;
                    this.sink.noteReceived(senderChar, subject, id);
                    msg.handled = true;
                }
                break;
            case "friendadd":
                {
                    const name = CharacterName.create(msg.body.name!);
                    this.sink.friendAdded(name);
                    msg.handled = true;
                }
                break;
            case "friendremove":
                {
                    const name = CharacterName.create(msg.body.name!);
                    this.sink.friendRemoved(name);
                    msg.handled = true;
                }
                break;
            case "friendrequest":
                {
                    const name = CharacterName.create(msg.body.name!);
                    this.sink.friendRequestReceived(name);
                    msg.handled = true;
                }
            default:
                break;
        }
    }

    private handleCKUMessage(msg: HandleableTypedChatMessage<ServerCKUMessage>) {
        const chan = ChannelName.create(msg.body.channel);
        const op = CharacterName.create(msg.body.operator);
        const kickedChar = CharacterName.create(msg.body.character);
        if (kickedChar != this._identifiedCharacter) {
            this.sink.channelCharacterKicked(chan, op, kickedChar);
        }
        else {
            this.sink.kickedFromChannel(chan, op);
        }
        msg.handled = true;
    }

    private handleCBUMessage(msg: HandleableTypedChatMessage<ServerCBUMessage>) {
        const chan = ChannelName.create(msg.body.channel);
        const op = CharacterName.create(msg.body.operator);
        const kickedChar = CharacterName.create(msg.body.character);
        if (kickedChar != this._identifiedCharacter) {
            this.sink.channelCharacterBanned(chan, op, kickedChar);
        }
        else {
            this.sink.bannedFromChannel(chan, op);
        }
        msg.handled = true;
    }

    private handleCTUMessage(msg: HandleableTypedChatMessage<ServerCTUMessage>) {
        const chan = ChannelName.create(msg.body.channel);
        const op = CharacterName.create(msg.body.operator);
        const kickedChar = CharacterName.create(msg.body.character);
        if (kickedChar != this._identifiedCharacter) {
            this.sink.channelCharacterTimedOut(chan, op, kickedChar, msg.body.length);
        }
        else {
            this.sink.timedOutFromChannel(chan, op, msg.body.length);
        }
        msg.handled = true;
    }

    private handleERRMessage(msg: HandleableTypedChatMessage<ServerERRMessage>) {
        const errorNum = msg.body!.number;

        this.sink.serverErrorReceived(msg.body!.number, msg.body!.message);
        
        if (errorNum == ServerErrorNumbers.BannedFromServer) {
            this._bannedFromChat = true;
            this.dispose();
        }

        msg.handled = true;
    }

    private handleSYSMessage(msg: HandleableTypedChatMessage<ServerSYSMessage>) {
        if (msg.body.channel) {
            const chan = ChannelName.create(msg.body.channel);
            this.sink.systemMessageReceived(chan, msg.body.message);
        }
        else {
            this.sink.systemMessageReceived(null, msg.body.message);
        }

        msg.handled = true;
    }

    // restore chat state message
    private handleXHMMessage(msg: HandleableTypedChatMessage<ServerXHMMessage>) {
        if (msg.body.channel.startsWith("ch:")) {
            const channel = ChannelName.create(msg.body.channel.substring(3));
            this.sink.markChannelReplaying(channel);
            switch (msg.body.messagetype) {
                case "XXX":
                    break;
                case "CLR":
                    this.sink.channelClear(channel);
                    msg.handled = true;
                    break;
                case "LRP":
                case "MSG":
                case "SYS":
                    {
                        this.sink.channelMessageReceived(channel, {
                            isAd: (msg.body.messagetype == "LRP"),
                            speakingCharacter: CharacterName.create(msg.body.character),
                            message: this.unescapeHTML(msg.body.message),
                            asOf: (+msg.body.asof > 0) ? new Date(+msg.body.asof) : new Date(),
                            gender: CharacterGenderConvert.toCharacterGender(msg.body.characterGender) ?? undefined,
                            status: OnlineStatusConvert.toOnlineStatus(msg.body.characterStatus) ?? undefined,
                            seen: msg.body.seen,
                            isHistorical: true
                        });
                        msg.handled = true;
                    }
                    break;
                case "BRO":
                    {
                        this.sink.broadcastMessageReceived({
                            historicalPMConvoInterlocutor: undefined,
                            historicalChannel: channel,
                            message: msg.body.message,
                            asOf: (+msg.body.asof > 0) ? new Date(+msg.body.asof) : new Date(),
                            seen: msg.body.seen,
                            isHistorical: true
                        });
                        msg.handled = true;
                    }
                    break;
                case "SPIN":
                    {
                        const m = msg.body.message.match(/^\[user\].+?\[\/user\] spins the bottle: \[user\](.+?)\[\/user\]$/)!;
                        const targetChar = m[1]!;

                        this.sink.channelSpinReceived(channel, {
                            spinningCharacter: CharacterName.create(msg.body.character),
                            targetCharacter: CharacterName.create(targetChar),
                            asOf: (+msg.body.asof > 0) ? new Date(+msg.body.asof) : new Date(),
                            gender: CharacterGenderConvert.toCharacterGender(msg.body.characterGender) ?? undefined,
                            status: OnlineStatusConvert.toOnlineStatus(msg.body.characterStatus) ?? undefined,
                            seen: msg.body.seen,
                            isHistorical: true
                        });
                        msg.handled = true;
                    }
                    break;
                case "ROLL":
                    {
                        this.sink.channelRollReceived(channel, {
                            endResult: msg.body.endresult!,
                            individualResults: msg.body.results!,
                            individualRolls: msg.body.rolls!,
                            rollingCharacter: CharacterName.create(msg.body.character),
                            message: msg.body.message,
                            asOf: (+msg.body.asof > 0) ? new Date(+msg.body.asof) : new Date(),
                            gender: CharacterGenderConvert.toCharacterGender(msg.body.characterGender) ?? undefined,
                            status: OnlineStatusConvert.toOnlineStatus(msg.body.characterStatus) ?? undefined,
                            seen: msg.body.seen,
                            isHistorical: true
                        });
                        msg.handled = true;
                    }
                    break;
                default:
                    break;
            }
        }
        else if (msg.body.channel.startsWith("pm:")) {
            const convoCharacter = CharacterName.create(msg.body.channel.substring(3));
            this.sink.markPmConvoReplaying(convoCharacter);
            switch (msg.body.messagetype) {
                case "XXX":
                    break;
                case "CLR":
                    this.sink.pmConvoClear(convoCharacter);
                    msg.handled = true;
                    break;
                case "LRP":
                case "MSG":
                case "SYS":
                    {
                        this.sink.pmConvoMessageReceived(convoCharacter, {
                            isAd: false,
                            speakingCharacter: CharacterName.create(msg.body.character),
                            message: this.unescapeHTML(msg.body.message),
                            asOf: (+msg.body.asof > 0) ? new Date(+msg.body.asof) : new Date(),
                            gender: CharacterGenderConvert.toCharacterGender(msg.body.characterGender) ?? undefined,
                            status: OnlineStatusConvert.toOnlineStatus(msg.body.characterStatus) ?? undefined,
                            seen: msg.body.seen,
                            isHistorical: true
                        });
                        msg.handled = true;
                    }
                    break;
                case "BRO":
                    {
                        this.sink.broadcastMessageReceived({
                            historicalPMConvoInterlocutor: convoCharacter,
                            historicalChannel: undefined,
                            message: msg.body.message,
                            asOf: (+msg.body.asof > 0) ? new Date(+msg.body.asof) : new Date(),
                            seen: msg.body.seen,
                            isHistorical: true
                        });
                        msg.handled = true;
                    }
                    break;
                case "SPIN":
                case "ROLL":
                    {
                        this.sink.pmConvoRollReceived(convoCharacter, {
                            endResult: msg.body.endresult!,
                            individualResults: msg.body.results!,
                            individualRolls: msg.body.rolls!,
                            rollingCharacter: CharacterName.create(msg.body.character),
                            message: msg.body.message,
                            asOf: (+msg.body.asof > 0) ? new Date(+msg.body.asof) : new Date(),
                            gender: CharacterGenderConvert.toCharacterGender(msg.body.characterGender) ?? undefined,
                            status: OnlineStatusConvert.toOnlineStatus(msg.body.characterStatus) ?? undefined,
                            seen: msg.body.seen,
                            isHistorical: true
                        });
                        msg.handled = true;
                    }
                    break;
                default:
                    break;
            }
        }
        else if (msg.body.channel == "con") {
            switch (msg.body.messagetype) {
                case "CLR":
                    this.sink.consoleClear();
                    msg.handled = true;
                    break;
                case "BRO":
                    {
                        this.sink.broadcastMessageReceived({
                            historicalPMConvoInterlocutor: undefined,
                            historicalChannel: undefined,
                            message: msg.body.message,
                            asOf: (+msg.body.asof > 0) ? new Date(+msg.body.asof) : new Date(),
                            seen: msg.body.seen,
                            isHistorical: true
                        });
                        msg.handled = true;
                    }
                    break;
                case "SYS":
                    {
                        this.sink.addConsoleMessage({
                            isAd: false,
                            speakingCharacter: CharacterName.SYSTEM,
                            message: msg.body.message,
                            asOf: (+msg.body.asof > 0) ? new Date(+msg.body.asof) : new Date(),
                            seen: msg.body.seen,
                            isHistorical: true
                        });
                        msg.handled = true;
                    }
                    break;
                default:
                    break;
            }
        }
    }

    // restore chat state pm tab
    private handleXPMMessage(msg: HandleableTypedChatMessage<any>) {
        msg.handled = true;
    }

    private _extendedFeaturesEnabled = false;

    // extended features enabled
    private handleXNNMessage(msg: HandleableTypedChatMessage<any>) {
        this._extendedFeaturesEnabled = true;
        msg.handled = true;
    }

    private _incomingMessageSinks: ImmutableList<IncomingMessageSink> = ImmutableList.EMPTY;

    private createIncomingMessageSink(): IncomingMessageSink {
        const sink = new IncomingMessageSink(() => {
                this._incomingMessageSinks = this._incomingMessageSinks.removeWhere(x => x == sink);
            },
            this._disposeCTS.token);
        
        this._incomingMessageSinks = this._incomingMessageSinks.add(sink);
        return sink;
    }

    private unescapeHTML(raw: string) {
        return raw
            .replaceAll("&lt;", "<")
            .replaceAll("&gt;", ">")
            .replaceAll("&amp;", "&");
    }

    private escapeHTML(raw: string) {
        return raw
            .replaceAll("&", "&amp;")
            .replaceAll(">", "&gt;")
            .replaceAll("<", "&lt;");
    }

    private async sendMessageRawAsync(msg: ChatMessage): Promise<void> {
        const builder = [];
        builder.push(msg.code);
        if (msg.body) {
            builder.push(JSON.stringify(msg.body!));
        }
        const maybePromise = this.onOutgoingData(builder.join(' '));
        if (maybePromise) {
            await maybePromise;
        }
    }

    private _identified: boolean = false;
    async identifyAsync(accountName: string, characterName: CharacterName, ticket: string, cancellationToken?: CancellationToken): Promise<void> {
        if (this._identified) {
            throw new Error("already identified");
        }

        await this.sendMessageRawAsync({
            code: "IDN", body: {
                method: "ticket",
                account: accountName,
                character: characterName.value,
                ticket: ticket,
                cname: "XarChat",
                cversion: XarChatUtils.clientVersion
            }
        });

        using ms = this.createIncomingMessageSink();

        let readMore = true;
        while (readMore) {
            await ms.readMessage((msg) => {
                if (msg.code == "IDN") {
                    this._identified = true;
                    this._identifiedCharacter = CharacterName.create(msg.body!.character);
                    this._logger.enterScope(`ch=${this._identifiedCharacter.value}`);
                    ms.dispose();
                    this.sink.identified(this._identifiedCharacter);
                    msg.handled = true;
                    readMore = false;
                }
                else if (msg.code == "ERR") {
                    throw new Error("Identification failed");
                }
            }, cancellationToken);
        }
    }

    async quiesceAsync(): Promise<void> {
        await this.bracketedSendAsync(null);
    }

    async kickFromChannelAsync(channel: ChannelName, character: CharacterName): Promise<void> {
        await this.bracketedSendAsync({
            code: "CKU", body: {
                channel: channel.value,
                character: character.value
            }
        });
    }

    async banFromChannelAsync(channel: ChannelName, character: CharacterName): Promise<void> {
        await this.bracketedSendAsync({
            code: "CBU", body: {
                channel: channel.value,
                character: character.value
            }
        });
    }

    async inviteToChannelAsync(channel: ChannelName, character: CharacterName): Promise<void> {
        await this.bracketedSendAsync({
            code: "CIU", body: {
                channel: channel.value,
                character: character.value
            }
        });
    }

    async ignoreCharacterAsync(character: CharacterName): Promise<void> { 
        await this.bracketedSendAsync({
            code: "IGN", body: {
                action: "add",
                character: character.value
            }
        });
    }

    async unignoreCharacterAsync(character: CharacterName): Promise<void> { 
        await this.bracketedSendAsync({
            code: "IGN", body: {
                action: "delete",
                character: character.value
            }
        });
    }

    async notifyIgnoredAsync(character: CharacterName): Promise<void> {
        await this.bracketedSendAsync({
            code: "IGN", body: {
                action: "notify",
                character: character.value
            }
        });
    }
}
