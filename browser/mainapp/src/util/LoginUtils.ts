import { ChatViewModelSink } from "../ChatViewModelSink";
import { ApiTicket, FListAuthenticatedApi } from "../fchat/api/FListApi";
import { ChatConnection, IdentificationFailedError } from "../fchat/ChatConnection";
import { ChatConnectionFactory } from "../fchat/ChatConnectionFactory";
import { AppSettings } from "../settings/AppSettings";
import { ChannelName } from "../shared/ChannelName";
import { CharacterName } from "../shared/CharacterName";
import { OnlineStatus } from "../shared/OnlineStatus";
import { ActiveLoginViewModel, ChatConnectionState } from "../viewmodel/ActiveLoginViewModel";
import { AppNotifyEventType, AppViewModel } from "../viewmodel/AppViewModel";
import { ChatChannelPresenceState } from "../viewmodel/ChatChannelViewModel";
import { CancellationToken } from "./CancellationTokenSource";
import { CatchUtils } from "./CatchUtils";
import { TupleComparer } from "./Comparer";
import { HostInterop } from "./HostInterop";
import { IterableUtils } from "./IterableUtils";
import { Logging } from "./Logger";
import { TaskUtils } from "./TaskUtils";

const logger = Logging.createLogger("LoginUtils");

export class LoginUtils {
    private static async getLoggedInChatConnectionAsync(
        appViewModel: AppViewModel, 
        activeLoginViewModel: ActiveLoginViewModel | null,
        account: string, password: string, character: CharacterName,
        isReconnect: boolean,
        cancellationToken: CancellationToken
    ) {
        let maybeUsingStaleTicket: boolean = true;

        let authApi: FListAuthenticatedApi | null = null;
        let apiTicket: ApiTicket | null = null;
        let cc: ChatConnection | null = null;

        let disposeALVMOnError = false;

        while (true) {
            try {
                if (activeLoginViewModel == null) {
                    authApi = await appViewModel.flistApi.getAuthenticatedApiAsync(account, password, cancellationToken);
                    apiTicket = await authApi.getApiTicketAsync(cancellationToken);

                    const appSettings = appViewModel.appSettings;

                    activeLoginViewModel = new ActiveLoginViewModel(appViewModel, authApi, appSettings.savedChatStates.getOrCreate(character));
                    disposeALVMOnError = true;
                }
                else {
                    authApi = activeLoginViewModel.authenticatedApi;
                    apiTicket = await authApi.getApiTicketAsync(cancellationToken);
                }

                const sink = new ChatViewModelSink(activeLoginViewModel, isReconnect);
                sink.isLoggingIn = true;
                cc = await ChatConnectionFactory.create(sink);
                activeLoginViewModel.chatConnection = cc;
                await cc.identifyAsync(authApi.account, character, apiTicket.ticket);
                maybeUsingStaleTicket = false;
                await cc.quiesceAsync();
                sink.isLoggingIn = false;

                return { activeLoginViewModel: activeLoginViewModel, chatConnection: cc };
            }
            catch (e) {
                // try { cc?.dispose(); }
                // catch { }

                // if (e instanceof IdentificationFailedError && maybeUsingStaleTicket && authApi && apiTicket) {
                //     maybeUsingStaleTicket = false;
                //     await authApi.invalidateApiTicketAsync(apiTicket.ticket, cancellationToken);
                // }
                // else {
                    throw e;
                //}
            }
        }
    }

    static async performLoginAsync(appViewModel: AppViewModel, account: string, password: string, character: CharacterName, cancellationToken: CancellationToken) {

        const nscc = await this.getLoggedInChatConnectionAsync(appViewModel, null, account, password, character, false, cancellationToken);
        const ns = nscc.activeLoginViewModel;
        const cc = nscc.chatConnection;

        const appSettings = appViewModel.appSettings;
        const savedChatState = appSettings.savedChatStates.getOrCreate(character);

        if (savedChatState) {
            const charStatus = ns.characterSet.getCharacterStatus(character);
            if (charStatus.statusMessage == "" && savedChatState.statusMessage != "") {
                // TODO: set character status
                if (ns.getFirstConfigEntryHierarchical([ "restoreStatusMessageOnLogin" ])) {
                    cc.setStatusAsync(OnlineStatus.ONLINE, savedChatState.statusMessage);
                }
            }

            for (let chp of savedChatState.joinedChannels) {
                if (cc.isDisposed) {
                    throw new Error("Disconnected during connect");
                }

                const channelName = chp.name;
                const channelTitle = chp.title;

                const existingCh = ns.getChannel(channelName);
                if (!existingCh || existingCh.presenceState != ChatChannelPresenceState.IN_CHANNEL) {
                    logger.logDebug("auto joining channel", channelName, channelTitle);
                    try {
                        await cc.joinChannelAsync(channelName, chp.title);
                    }
                    catch (e) {
                        if (!cc.isDisposed) {
                            const ch = ns.getOrCreateChannel(channelName, channelTitle);
                            if (ch) {
                                ch.presenceState = ChatChannelPresenceState.NOT_IN_CHANNEL;
                                ch.addSystemMessage(new Date(), `Could not connect to this channel: ${CatchUtils.getMessage(e)}`);
                            }
                        }
                    }
                }
                else {
                    //this.logging.logWarn("not auto joining channel", channelName, channelTitle);
                }
            }
            for (let pc of savedChatState.pinnedChannels) {
                const channelName = pc;
                const ch = ns.getChannel(channelName);
                if (ch) {
                    //this.logging.logInfo("auto pinning channel", channelName, ch.title);
                    ch.isPinned = true;
                }
            }
            for (let pmc of savedChatState.pmConvos) {
                const charName = pmc.character;
                const convo = ns.getOrCreatePmConvo(charName, false);
                if (convo) {
                    convo.lastInteractionAt = Math.max(convo.lastInteractionAt, pmc.lastInteraction);
                }
            }

            const channelsOrdered = IterableUtils.asQueryable(savedChatState.joinedChannels)
                .orderBy(jc => [jc.order, jc.title], TupleComparer)
                .select(jc => jc.name).toArray();
            ns.setChannelOrdering(channelsOrdered);

            ns.pinnedChannelsCollapsed = savedChatState.pinnedChannelSectionCollapsed;
            ns.channelsCollapsed = savedChatState.unpinnedChannelSectionCollapsed;
            ns.pmConvosCollapsed = savedChatState.pmConvosSectionCollapsed;

            const savedSelectedChannel = savedChatState.selectedChannel ?? "console";
            if (savedSelectedChannel.startsWith("ch:")) {
                const chanName = ChannelName.create(savedSelectedChannel.substring(3));
                ns.selectedChannel = ns.getChannel(chanName);
            }
            else if (savedSelectedChannel.startsWith("pm:")) {
                const charName = CharacterName.create(savedSelectedChannel.substring(3));
                ns.selectedChannel = ns.getPmConvo(charName);
            }
            else if (savedSelectedChannel == "console") {
                ns.selectedChannel = ns.console;
            }

            savedChatState.lastLogin = (new Date()).getTime();
        }

        appViewModel.currentlySelectedSession = ns;
        ns.connectionState = ChatConnectionState.CONNECTED;
        HostInterop.signalLoginSuccessAsync();
    }

    static async reconnectAsync(activeLoginViewModel: ActiveLoginViewModel, cancellationToken: CancellationToken): Promise<void> {
        const nscc = await this.getLoggedInChatConnectionAsync(activeLoginViewModel.appViewModel, activeLoginViewModel,
            "", "", activeLoginViewModel.characterName, true, cancellationToken);
        const cc = nscc.chatConnection;

        // Reconnect pending channels
        logger.logDebug("reconnectAsync: reconnecting pending channels...");
        for (let ch of [...activeLoginViewModel.pinnedChannels, ...activeLoginViewModel.unpinnedChannels]) {
            if (cc.isDisposed) {
                throw new Error("Disconnected during reconnect");
            }

            if (ch.presenceState == ChatChannelPresenceState.PENDING_RECONNECT) {
                try {
                    logger.logDebug("reconnectAsync: joining channel...", ch.name, ch.title);
                    await cc.joinChannelAsync(ch.name, ch.title);
                }
                catch (e) {
                    if (!cc.isDisposed) {
                        logger.logDebug("reconnectAsync: failed to join channel...", ch.name, ch.title);
                        ch.presenceState = ChatChannelPresenceState.NOT_IN_CHANNEL;
                        ch.addSystemMessage(new Date(), `Could not reconnect to this channel: ${CatchUtils.getMessage(e)}`);
                    }
                    else {
                        logger.logDebug("reconnectAsync: failed to join channel because cc disposed...", ch.name, ch.title);
                        throw new Error("Disconnected during reconnect");
                    }
                }
            }
        }

        logger.logDebug("reconnectAsync: done reconnecting, setting state CONNECTED...");
        activeLoginViewModel.connectionState = ChatConnectionState.CONNECTED;
    }
}