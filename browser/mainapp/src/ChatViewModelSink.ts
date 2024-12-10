import { BottleSpinData, BroadcastMessageData, ChannelMessageData, ChatConnectionSink, ChatDisconnectReason, RollData } from "./fchat/ChatConnectionSink";
import { SavedChatStateJoinedChannel } from "./settings/AppSettings";
import { ChannelName } from "./shared/ChannelName";
import { CharacterName } from "./shared/CharacterName";
import { CharacterStatus } from "./shared/CharacterSet";
import { OnlineStatus, OnlineStatusConvert } from "./shared/OnlineStatus";
import { SnapshottableMap } from "./util/collections/SnapshottableMap";
import { Logger, Logging } from "./util/Logger";
import { StringUtils } from "./util/StringUtils";
import { URLUtils } from "./util/URLUtils";
import { ActiveLoginViewModel, ChatConnectionState } from "./viewmodel/ActiveLoginViewModel";
import { ChannelViewModel } from "./viewmodel/ChannelViewModel";
import { ChatChannelMessageMode, ChatChannelPresenceState, ChatChannelViewModel } from "./viewmodel/ChatChannelViewModel";

let nextSinkId = 1;

class EventMessagesConfig {
    constructor(private readonly activeLoginViewModel: ActiveLoginViewModel) {
    }

    getRouting(args: GetRoutingArgs): { chanVm: ChannelViewModel, isImportant: boolean }[] {
        let targetStr: string | null = null;
        let gotTargetStr = false;
        for (let cfgtarget of [ this.activeLoginViewModel.characterName.canonicalValue, 'global' ]) {
            for (let subtarget of this.getSubtargets(args)) {
                const cfgEntry = `${cfgtarget}.eventMessages.${args.eventType}${subtarget}`;
                const cfgValue = this.activeLoginViewModel.appViewModel.configBlock.get(cfgEntry);
                if (cfgValue != null && typeof cfgValue == 'string') {
                    targetStr = cfgValue;
                    break;
                }
            }
            if (gotTargetStr) {
                break;
            }
        }
        if (targetStr == null) {
            targetStr = "";
            for (let subtarget of this.getSubtargets(args)) {
                const ssubtarget = subtarget.substring(subtarget.length > 0 ? 1 : 0);
                if (args.defaultValue[ssubtarget]) {
                    targetStr = args.defaultValue[ssubtarget];
                    break;
                }
            }
        }

        const resultsMap: Map<ChannelViewModel, boolean> = new Map();
        //const results: { chanVm: ChannelViewModel, isImportant: boolean }[] = [];
        for (let target of targetStr.split(',')) {
            let isImportant: boolean;
            if (target.startsWith("*")) {
                isImportant = (target.startsWith("*"));
                target = target.substring(1);
            }
            else {
                isImportant = false;
            }

            let chanVms: (ChannelViewModel | null)[] = [];
            switch (target.toLowerCase()) {
                case "console":
                    chanVms.push(this.activeLoginViewModel.console);
                    break;
                case "currenttab":
                    chanVms.push(this.activeLoginViewModel.selectedChannel);
                    break;
                case "pmconvo":
                    if (args.targetCharacter) {
                        chanVms.push(this.activeLoginViewModel.getPmConvo(args.targetCharacter));
                    }
                    break;
                case "targetchannel":
                    if (args.targetChannel) {
                        chanVms.push(this.activeLoginViewModel.getChannel(args.targetChannel));
                    }
                    break;
                case "everywhere":
                    {
                        const addedChans = new Set<ChannelViewModel | null>();
                        addedChans.add(this.activeLoginViewModel.console);
                        addedChans.add(this.activeLoginViewModel.selectedChannel);
                        for (let oc of this.activeLoginViewModel.openChannels) {
                            addedChans.add(oc);
                        }
                        for (let pmc of this.activeLoginViewModel.pmConversations.values()) {
                            addedChans.add(pmc);
                        }
                        for (let ac of addedChans.values()) {
                            chanVms.push(ac);
                        }
                    }
                    break;
                default:
                    break;
            }
            for (let chanVm of chanVms) {
                if (chanVm) {
                    resultsMap.set(chanVm, (resultsMap.get(chanVm) ?? false) || isImportant);
                    //results.push({ chanVm: chanVm, isImportant: isImportant });
                }
            }
        }

        const results = [];
        for (let tr of resultsMap.entries()) {
            results.push({ chanVm: tr[0], isImportant: tr[1] });
        }

        return results;
    }

    private getSubtargets(args: GetRoutingArgs) {
        const result = [];
        if (args.targetCharacter != null) {
            const isMe = (args.targetCharacter == this.activeLoginViewModel.characterName);
            const isWatched = (this.activeLoginViewModel.friends.has(args.targetCharacter))
                || (this.activeLoginViewModel.bookmarks.has(args.targetCharacter));
            if (isMe) {
                result.push(".me");
            }
            if (isWatched) {
                result.push(".watched");
            }
            if (!isWatched && !isMe) {
                result.push(".others");
            }
            if (!isMe) {
                result.push(".notme");
            }
        }
        result.push("");
        return result;
    }
}

interface GetRoutingArgs {
    eventType: string;
    defaultValue: Record<string, string>;
    targetCharacter?: CharacterName;
    targetChannel?: ChannelName;
}

export class ChatViewModelSink implements ChatConnectionSink {
    constructor(
        private readonly viewModel: ActiveLoginViewModel, 
        private readonly isReconnect: boolean) {

        this._sinkId = nextSinkId++;
        this._logger = Logging.createLogger("ChatViewModelSink");
        this._logger.enterScope(`sink#${this._sinkId}`);
        this._emc = new EventMessagesConfig(viewModel);
    }

    private readonly _sinkId: number;
    private readonly _logger: Logger;
    private readonly _emc: EventMessagesConfig;

    private sendSystemMessageMultiRouted(
        options: {
            text: string,
            eventName: string,
            defaultRouting: Record<string, string>,
            targetChannel?: ChannelName,
            targetCharacter?: CharacterName,
            suppressPing?: boolean
        }
    ) {
        const routing = this._emc.getRouting({
            eventType: options.eventName,
            defaultValue: options.defaultRouting,
            targetChannel: options.targetChannel,
            targetCharacter: options.targetCharacter
        });
        for (let troute of routing) {
            troute.chanVm.addSystemMessage(new Date(), options.text, troute.isImportant, options.suppressPing ?? false);
        }
    }

    private sendSystemMessageToMulti(
        options: {
            text: string, 
            channels?: (ChannelViewModel | null)[],
            importantChannels?: (ChannelViewModel | null)[],
            suppressPing?: boolean}) {

        const s = new Set<ChannelViewModel>();
        if (options.channels) {
            for (let ch of options.channels) {
                if (ch && ch instanceof ChannelViewModel) {
                    s.add(ch);
                }
            }
        }
        if (options.importantChannels) {
            for (let ch of options.importantChannels) {
                if (ch && ch instanceof ChannelViewModel) {
                    s.add(ch);
                }
            }
        }
        for (let ch of s.values()) {
            const isImportant = options.importantChannels ? (options.importantChannels.indexOf(ch) != -1) : false;
            ch.addSystemMessage(new Date(), options.text, isImportant, options.suppressPing ?? false);
        }
    }

    disconnectedFromServer(reason: ChatDisconnectReason): void {
        const ns = this.viewModel;
        this.charactersStatusUpdated([ { characterName: ns.characterName, status: OnlineStatus.OFFLINE, statusMessage: "" } ], false, true);
        switch (reason) {
            case ChatDisconnectReason.UNEXPECTED_DISCONNECT:
                this._logger.logInfo("Disconnected unexpectedly");
                this.viewModel.connectionState = ChatConnectionState.DISCONNECTED_UNEXPECTEDLY;
                this.viewModel.beginAutoReconnectCountdown();
                break;
            case ChatDisconnectReason.REQUESTED_DISCONNECT:
                this.viewModel.connectionState = ChatConnectionState.DISCONNECTED_NORMALLY;
                this.viewModel.appViewModel.logins.remove(this.viewModel);
                break;
            case ChatDisconnectReason.KICKED_FROM_SERVER:
                this.viewModel.connectionState = ChatConnectionState.DISCONNECTED_KICKED;
                break;
        }
        
    }

    identified(character: CharacterName): void {
        this.viewModel.characterName = character;
        this._logger.enterScope(`c=${character.value}`);
        if (!this.isReconnect) {
            this._logger.logDebug("pushing new login");
            this.viewModel.appViewModel.logins.push(this.viewModel);
        }
        else {
            this._logger.logDebug("not pushing new login", this.isReconnect);
        }
    }

    serverVariableSet(varName: string, varValue: any): void {
    }

    serverHelloReceived(message: string): void {
        this.viewModel.console.addSystemMessage(new Date(), message, false);
    }

    connectedCharactersCountReceived(count: number): void {
        const vm = this.viewModel;
        vm.characterSet.clear();
    }

    serverErrorReceived(number: number, message: string): void {
        this.sendSystemMessageMultiRouted({
            text: `Error #${number}: ${message}`, 
            eventName: "errorReceived",
            defaultRouting: {
                "": "console,*currenttab"
            },
        });
        // this.sendSystemMessageToMulti({ 
        //     text: `Error #${number}: ${message}`, 
        //     channels: [ this.viewModel.console ], 
        //     importantChannels: [ this.viewModel.selectedChannel ]
        // });
    }

    addConsoleMessage(data: ChannelMessageData): void {
        // TODO: pass seen
        this.viewModel.console.addSystemMessage(data.asOf ?? new Date(), data.message, false);
    }

    broadcastMessageReceived(data: BroadcastMessageData): void {
        const ns = this.viewModel;

        // TODO: pass seen
        if (!data.isHistorical) {
            const now = new Date();

            this.sendSystemMessageMultiRouted({
                text: data.message, 
                eventName: "broadcastReceived",
                defaultRouting: {
                    "": "*everywhere"
                },
                suppressPing: true
            });
            
            // ns.console.addSystemMessage(now, data.message, true);
            // for (let ch of ns.openChannels) {
            //     ch.addSystemMessage(now, data.message, true);
            // }
            // for (let convo of ns.pmConversations.values()) {
            //     convo.addSystemMessage(now, data.message, true);
            // }
        }
        else if (data.historicalChannel) {
            let ch = ns.getOrCreateChannel(data.historicalChannel);
            if (ch) {
                ch.addSystemMessage(data.asOf ?? new Date(), data.message, true);
            }
        }
        else if (data.historicalPMConvoInterlocutor) {
            let convo = ns.getOrCreatePmConvo(data.historicalPMConvoInterlocutor);
            if (convo) {
                convo.addSystemMessage(data.asOf ?? new Date(), data.message, true);
            }
        }
        else {
            ns.console.addSystemMessage(data.asOf ?? new Date(), data.message, true);
        }
    }

    bookmarkCharactersAdded(characters: CharacterName[], isInitial: boolean): void {
        const ns = this.viewModel;
        if (isInitial) {
            //ns.watchedChars.clear();
            ns.bookmarks.clear();
        }

        for (let char of characters) {
            ns.watchedChars.add(char);
            ns.bookmarks.add(char);
            if (!isInitial) {
                const msg = `[user]${char.value}[/user] was added to your bookmarks.`;

                this.sendSystemMessageMultiRouted({
                    text: msg, 
                    eventName: "bookmarkAdded",
                    defaultRouting: {
                        "": "console,currenttab,pmconvo"
                    },
                    targetCharacter: char
                });
                // this.sendSystemMessageToMulti({
                //     text: msg, 
                //     channels: [ ns.console, ns.selectedChannel, ns.getPmConvo(char) ]
                // });
            }
        }
        ns.expireMyFriendsListInfo()
    }

    bookmarkCharactersRemoved(characters: CharacterName[]): void {
        const ns = this.viewModel;
        for (let char of characters) {
            ns.watchedChars.delete(char);
            ns.bookmarks.delete(char);

            const msg = `[user]${char.value}[/user] was removed from your bookmarks.`;

            this.sendSystemMessageMultiRouted({
                text: msg, 
                eventName: "bookmarkRemoved",
                defaultRouting: {
                    "": "console,currenttab,pmconvo"
                },
                targetCharacter: char
            });
            // this.sendSystemMessageToMulti({
            //     text: msg, 
            //     channels: [ ns.console, ns.selectedChannel, ns.getPmConvo(char) ]
            // });
        }
        ns.expireMyFriendsListInfo()
    }

    ignoredCharactersAdded(characters: CharacterName[], isInitial: boolean): void {
        const ns = this.viewModel;
        if (isInitial) {
            ns.ignoredChars.clear();
        }
        for (let ch of characters) {
            ns.ignoredChars.add(ch);

            if (!isInitial) {
                this.sendSystemMessageMultiRouted({
                    text: `[user]${ch.value}[/user] was added to your ignore list.`,
                    eventName: "ignoreAdded",
                    defaultRouting: {
                        "": "console,currenttab,pmconvo"
                    },
                    targetCharacter: ch
                });
                // this.sendSystemMessageToMulti({
                //     text: `[user]${ch.value}[/user] was added to your ignore list.`,
                //     channels: [ ns.console, ns.selectedChannel, ns.getPmConvo(ch) ]
                // });
            }
        }
    }

    ignoredCharactersRemoved(characters: CharacterName[]): void {
        const ns = this.viewModel;
        for (let ch of characters) {
            ns.ignoredChars.delete(ch);

            this.sendSystemMessageMultiRouted({
                text: `[user]${ch.value}[/user] was removed from your ignore list.`,
                eventName: "ignoreRemoved",
                defaultRouting: {
                    "": "console,currenttab,pmconvo"
                },
                targetCharacter: ch
            });
            // this.sendSystemMessageToMulti({
            //     text: `[user]${ch.value}[/user] was removed from your ignore list.`,
            //     channels: [ ns.console, ns.selectedChannel, ns.getPmConvo(ch) ]
            // });
        }
    }

    friendAdded(character: CharacterName): void {
        const ns = this.viewModel;
        ns.watchedChars.add(character);
        ns.friends.add(character);

        const msg = `[user]${character.value}[/user] was added as a friend.`;

        this.sendSystemMessageMultiRouted({
            text: msg,
            eventName: "friendAdded",
            defaultRouting: {
                "": "console,currenttab,pmconvo"
            },
            targetCharacter: character
        });
        // this.sendSystemMessageToMulti({
        //     text: msg,
        //     channels: [ ns.console, ns.selectedChannel, ns.getPmConvo(character) ]
        // });

        ns.expireMyFriendsListInfo();
    }

    friendRemoved(character: CharacterName): void {
        const ns = this.viewModel;
        ns.watchedChars.delete(character);
        ns.friends.delete(character);

        const msg = `[user]${character.value}[/user] is no longer a friend.`;

        this.sendSystemMessageMultiRouted({
            text: msg,
            eventName: "friendRemoved",
            defaultRouting: {
                "": "console,currenttab,pmconvo"
            },
            targetCharacter: character
        });
        // this.sendSystemMessageToMulti({
        //     text: msg,
        //     channels: [ ns.console, ns.selectedChannel, ns.getPmConvo(character) ]
        // });

        ns.expireMyFriendsListInfo();
    }

    friendRequestReceived(character: CharacterName): void {
        const ns = this.viewModel;

        const msg = `[user]${character.value}[/user] has requested to be your friend.`;

        this.sendSystemMessageMultiRouted({
            text: msg,
            eventName: "friendRequest",
            defaultRouting: {
                "": "console,currenttab,pmconvo"
            },
            targetCharacter: character
        });
    }

    interestAdded(character: CharacterName): void {
        const ns = this.viewModel;
        ns.watchedChars.add(character);
        ns.interests.add(character);

        const msg = `[user]${character.value}[/user] was added as an interest.`;

        this.sendSystemMessageMultiRouted({
            text: msg,
            eventName: "interestAdded",
            defaultRouting: {
                "": "console,currenttab,pmconvo"
            },
            targetCharacter: character
        });
        // this.sendSystemMessageToMulti({
        //     text: msg,
        //     channels: [ ns.console, ns.selectedChannel, ns.getPmConvo(character) ]
        // });

        ns.expireMyFriendsListInfo();
    }

    interestRemoved(character: CharacterName): void {
        const ns = this.viewModel;
        ns.watchedChars.delete(character);
        ns.interests.delete(character);

        const msg = `[user]${character.value}[/user] is no longer an interest.`;

        this.sendSystemMessageMultiRouted({
            text: msg,
            eventName: "interestRemoved",
            defaultRouting: {
                "": "console,currenttab,pmconvo"
            },
            targetCharacter: character
        });
        // this.sendSystemMessageToMulti({
        //     text: msg,
        //     channels: [ ns.console, ns.selectedChannel, ns.getPmConvo(character) ]
        // });

        ns.expireMyFriendsListInfo();
    }

    serverOpsAdded(characters: CharacterName[], isInitial: boolean): void {
        const ns = this.viewModel;
        if (isInitial) {
            ns.serverOps.clear();
        }
        for (let char of characters) {
            ns.serverOps.add(char);
            if (!isInitial) {
                this.sendSystemMessageMultiRouted({
                    text: `[user]${char.value}[/user] is now a server operator.`,
                    eventName: "serverOpAdded",
                    defaultRouting: {
                        "": "console,*currenttab,pmconvo"
                    },
                    targetCharacter: char
                });
                // this.sendSystemMessageToMulti({
                //     text: `[user]${char.value}[/user] is now a server operator.`,
                //     channels: [ ns.console ],
                //     importantChannels: [ ns.selectedChannel ]
                // });
            }
        }
    }
    
    serverOpsRemoved(characters: CharacterName[]): void {
        const ns = this.viewModel;
        for (let ch of characters) {
            ns.serverOps.delete(ch);
            this.sendSystemMessageMultiRouted({
                text: `[user]${ch.value}[/user] is no longer a server operator.`,
                eventName: "serverOpAdded",
                defaultRouting: {
                    "": "console,*currenttab,pmconvo"
                },
                targetCharacter: ch
            });
            // this.sendSystemMessageToMulti({
            //     text: `[user]${ch.value}[/user] is no longer a server operator.`,
            //     channels: [ ns.console ],
            //     importantChannels: [ ns.selectedChannel ]
            // });
        }
    }

    charactersStatusUpdated(statuses: Partial<CharacterStatus>[], isInitial: boolean, isOnlineOffline: boolean): void {
        const ns = this.viewModel;
        for (let s of statuses) {
            if (s.characterName) {
                const previousStatus = ns.characterSet.getCharacterStatus(s.characterName!);
                const newStatus = ns.characterSet.setCharacterStatus(s.characterName!, s);

                const skipNotification = newStatus.equals(previousStatus) ||
                    newStatus.status == OnlineStatus.OFFLINE ||
                    previousStatus.status == OnlineStatus.OFFLINE ||
                    newStatus.status == OnlineStatus.IDLE ||
                    previousStatus.status == OnlineStatus.IDLE;

                if (s.characterName! == ns.characterName) {
                    const dispStatusChanged =
                        previousStatus.status != newStatus.status ||
                        previousStatus.statusMessage != newStatus.statusMessage;
                    if (dispStatusChanged) {
                        const msgText = `You changed status to ${OnlineStatusConvert.toString(newStatus.status) ?? "unknown"}` +
                            (!StringUtils.isNullOrWhiteSpace(newStatus.statusMessage) ? `: ${newStatus.statusMessage}` : `.`);

                        this.sendSystemMessageMultiRouted({
                            text: msgText,
                            eventName: "characterStatusUpdated",
                            defaultRouting: {
                                "me": "console,currenttab",
                                "watched": "currenttab,pmconvo"
                            },
                            targetCharacter: ns.characterName,
                            suppressPing: true
                        });
                        // this.sendSystemMessageToMulti({
                        //     text: msgText,
                        //     channels: [ ns.console, ns.selectedChannel ],
                        //     suppressPing: true
                        // });
                    }
                }
                else if (!isInitial && !skipNotification && !isOnlineOffline && s.status) {
                    let msgText: string;
                    if (s.statusMessage && s.statusMessage != "") {
                        msgText = `[user]${s.characterName.value}[/user] changed status to ${OnlineStatusConvert.toString(s.status) ?? "unknown"}: ${s.statusMessage}`;
                    }
                    else {
                        msgText = `[user]${s.characterName.value}[/user] changed status to ${OnlineStatusConvert.toString(s.status) ?? "unknown"}.`;
                    }

                    this.sendSystemMessageMultiRouted({
                        text: msgText,
                        eventName: "characterStatusUpdated",
                        defaultRouting: {
                            "me": "console,currenttab",
                            "watched": "currenttab,pmconvo"
                        },
                        targetCharacter: s.characterName
                    });
                    // this.sendSystemMessageToMulti({
                    //     text: msgText,
                    //     channels: [ ns.getPmConvo(s.characterName), ns.watchedChars.has(s.characterName) ? ns.selectedChannel : null ]
                    // });
                }
            }
        }
    }

    characterCameOnline(character: CharacterName): void {
        const ns = this.viewModel;
        this.sendSystemMessageMultiRouted({
            text: `[user]${character.value}[/user] came online.`, 
            eventName: "characterCameOnline",
            defaultRouting: {
                "others": "pmconvo",
                "watched": "pmconvo,currenttab",
                "me": ""
            },
            targetCharacter: character
        });
        // this.sendSystemMessageToMulti({
        //     text: `[user]${character.value}[/user] came online.`, 
        //     channels: [ ns.getPmConvo(character), ns.watchedChars.has(character) ? ns.selectedChannel : null ] 
        // });
    }

    characterWentOffline(character: CharacterName): void {
        const ns = this.viewModel;
        for (let ch of ns.openChannels) {
            ch.removeUser(character);
        }

        this.sendSystemMessageMultiRouted({
            text: `[user]${character.value}[/user] went offline.`, 
            eventName: "characterWentOffline",
            defaultRouting: {
                "others": "pmconvo",
                "watched": "pmconvo,currenttab",
                "me": ""
            },
            targetCharacter: character
        });
        // this.sendSystemMessageToMulti({
        //     text: `[user]${character.value}[/user] went offline.`,
        //     channels: [ ns.getPmConvo(character), ns.watchedChars.has(character) ? ns.selectedChannel : null ]
        // });
    }

    joinedChannel(channel: ChannelName, title: string): void {
        const ns = this.viewModel;
        const ccvm = ns.getOrCreateChannel(channel, title);
        ccvm.title = title;
        ccvm.addUser(ns.characterName);
    }

    leftChannel(channel: ChannelName): void {
        const ns = this.viewModel;
        if (!this.isLeaveIgnored(channel)) {
            const ccvm = ns.getChannel(channel);
            if (ccvm) {
                ccvm.removeUser(ns.characterName);
                ccvm.presenceState = ChatChannelPresenceState.NOT_IN_CHANNEL;
                ccvm.close();
            }
        }
    }

    private _temporaryLeaveIgnores: SnapshottableMap<ChannelName, Date> = new SnapshottableMap();
    private pruneLeaveIgnores() {
        const ifBefore = new Date(new Date().getTime() - 1000 * 5);
        this._temporaryLeaveIgnores.forEachEntrySnapshotted(kvp => {
            if (kvp[1] < ifBefore) {
                this._temporaryLeaveIgnores.delete(kvp[0]);
            }
        });
    }
    
    private isLeaveIgnored(chan: ChannelName): boolean {
        this.pruneLeaveIgnores();
        const lx = this._temporaryLeaveIgnores.get(chan);
        if (lx) {
            const ifAfter = new Date(new Date().getTime() - 1000 * 5);
            if (lx > ifAfter) {
                this._temporaryLeaveIgnores.delete(chan);
                return true;
            }
        }
        return false;
    }

    kickedFromChannel(channel: ChannelName, operator: CharacterName): void {
        const ns = this.viewModel;
        const ccvm = ns.getOrCreateChannel(channel);
        if (ccvm) {
            ccvm.removeUser(ns.characterName);
            ccvm.presenceState = ChatChannelPresenceState.NOT_IN_CHANNEL;
        }

        this.sendSystemMessageMultiRouted({
            text: `You were kicked from [session=${ccvm?.title ?? channel.value}]${channel.value}[/session] by [user]${operator}[/user].`, 
            eventName: "kickedFromChannel",
            defaultRouting: {
                "me": "*console,*currenttab,*targetchannel"
            },
            targetCharacter: ns.characterName,
            targetChannel: channel
        });
        // this.sendSystemMessageToMulti({
        //     text: `You were kicked from [session=${ccvm?.title ?? channel.value}]${channel.value}[/session] by [user]${operator}[/user].`, 
        //     channels: [],
        //     importantChannels: [ ns.console, ccvm ]
        // });

        this.pruneLeaveIgnores();
        this._temporaryLeaveIgnores.set(channel, new Date());
    }

    bannedFromChannel(channel: ChannelName, operator: CharacterName): void {
        const ns = this.viewModel;
        const ccvm = ns.getOrCreateChannel(channel);
        if (ccvm) {
            ccvm.removeUser(ns.characterName);
            ccvm.presenceState = ChatChannelPresenceState.NOT_IN_CHANNEL;
        }

        this.sendSystemMessageMultiRouted({
            text: `You were [b]banned[/b] from [session=${ccvm?.title ?? channel.value}]${channel.value}[/session] by [user]${operator}[/user].`,
            eventName: "bannedFromChannel",
            defaultRouting: {
                "me": "*console,*currenttab,*targetchannel"
            },
            targetCharacter: ns.characterName,
            targetChannel: channel
        });
        // this.sendSystemMessageToMulti({
        //     text: `You were [b]banned[/b] from [session=${ccvm?.title ?? channel.value}]${channel.value}[/session] by [user]${operator}[/user].`,
        //     channels: [],
        //     importantChannels: [ ns.console, ccvm ]
        // });

        this.pruneLeaveIgnores();
        this._temporaryLeaveIgnores.set(channel, new Date());
    }

    timedOutFromChannel(channel: ChannelName, operator: CharacterName, lengthMin: number): void {
        const ns = this.viewModel;
        const ccvm = ns.getOrCreateChannel(channel);
        if (ccvm) {
            ccvm.removeUser(ns.characterName);
            ccvm.presenceState = ChatChannelPresenceState.NOT_IN_CHANNEL;
        }

        this.sendSystemMessageMultiRouted({
            text: `You were [b]temporarily banned[/b] from [session=${ccvm?.title ?? channel.value}]${channel.value}[/session] by [user]${operator}[/user] for ${lengthMin} minute(s).`, 
            eventName: "timedOutFromChannel",
            defaultRouting: {
                "me": "*console,*currenttab,*targetchannel"
            },
            targetCharacter: ns.characterName,
            targetChannel: channel
        });
        // this.sendSystemMessageToMulti({
        //     text: `You were [b]temporarily banned[/b] from [session=${ccvm?.title ?? channel.value}]${channel.value}[/session] by [user]${operator}[/user] for ${lengthMin} minute(s).`, 
        //     channels: [], 
        //     importantChannels: [ ns.console, ccvm ]
        // });

        this.pruneLeaveIgnores();
        this._temporaryLeaveIgnores.set(channel, new Date());
    }

    channelModeChanged(channel: ChannelName, mode: ChatChannelMessageMode): void {
        const ns = this.viewModel;
        const ccvm = ns.getOrCreateChannel(channel);
        if (ccvm) {
            ccvm.messageMode = mode;
            // TODO: isInitial + notification
        }
    }

    channelOwnerChanged(channel: ChannelName, character: CharacterName | null, isInitial: boolean): void {
        const ns = this.viewModel;
        const ccvm = ns.getOrCreateChannel(channel);
        if (ccvm) {
            ccvm.setOwner(character);
            if (!isInitial) {
                this.sendSystemMessageMultiRouted({
                    text: `[user]${character?.value}[/user] is now the owner of channel [session=${ccvm.title}]${ccvm.name.value}[/session].`, 
                    eventName: "channelOwnerChanged",
                    defaultRouting: {
                        "me": "console,currenttab,targetchannel",
                        "notme": "targetchannel"
                    },
                    targetCharacter: character ?? undefined,
                    targetChannel: channel
                });

                //ccvm.addSystemMessage(new Date(), `[user]${character?.value}[/user] is now the owner of channel [session=${ccvm.title}]${ccvm.name.value}[/session].`, false);
            }
        }
    }

    channelOpsAdded(channel: ChannelName, characters: CharacterName[], isInitial: boolean): void {
        const ns = this.viewModel;
        const ccvm = ns.getOrCreateChannel(channel);
        if (ccvm) {
            if (isInitial) {
                ccvm.channelOps.clear();
            }
            ccvm.addChannelOps(characters);
            if (!isInitial) {
                for (let char of characters) {
                    this.sendSystemMessageMultiRouted({
                        text: `[user]${char.value}[/user] is now an operator for channel [session=${ccvm.title}]${ccvm.name.value}[/session].`, 
                        eventName: "channelOpAdded",
                        defaultRouting: {
                            "me": "console,currenttab,targetchannel",
                            "notme": "targetchannel"
                        },
                        targetCharacter: char,
                        targetChannel: channel
                    });

                    //ccvm.addSystemMessage(new Date(), `[user]${char.value}[/user] is now an operator for channel [session=${ccvm.title}]${ccvm.name.value}[/session].`, false);
                }
            }
        }
    }

    channelOpRemoved(channel: ChannelName, character: CharacterName): void {
        const ns = this.viewModel;
        const ccvm = ns.getOrCreateChannel(channel);
        if (ccvm) {
            ccvm.removeChannelOp(character);

            this.sendSystemMessageMultiRouted({
                text: `[user]${character}[/user] is no longer an operator for channel [session=${ccvm.title}]${ccvm.name.value}[/session].`, 
                eventName: "channelOpRemoved",
                defaultRouting: {
                    "me": "console,currenttab,targetchannel",
                    "notme": "targetchannel"
                },
                targetCharacter: character,
                targetChannel: channel
            });
            //ccvm.addSystemMessage(new Date(), `[user]${character}[/user] is no longer an operator for channel [session=${ccvm.title}]${ccvm.name.value}[/session].`, false);
        }
    }

    channelCharactersJoined(channel: ChannelName, character: CharacterName[], isInitial: boolean): void {
        const ns = this.viewModel;
        const ccvm = ns.getOrCreateChannel(channel);
        if (isInitial) {
            ccvm.removeAllUsers();
        }
        for (let c of character) {
            ccvm?.addUser(c);
        }
    }

    channelCharactersLeft(channel: ChannelName, character: CharacterName[]): void {
        const ns = this.viewModel;
        const ccvm = ns.getOrCreateChannel(channel);
        for (let c of character) {
            ccvm?.removeUser(c);
        }
    }

    channelCharacterKicked(channel: ChannelName, operator: CharacterName, kickedCharacter: CharacterName): void {
        const ns = this.viewModel;
        const ccvm = ns.getOrCreateChannel(channel);
        if (ccvm) {
            ccvm.removeUser(kickedCharacter);
            const suppressPing = (operator.equals(ns.characterName));

            this.sendSystemMessageMultiRouted({
                text: `[user]${kickedCharacter.value}[/user] was kicked from the channel by [user]${operator.value}[/user].`,
                eventName: "kickedFromChannel",
                defaultRouting: {
                    "notme": "targetchannel"
                },
                targetCharacter: kickedCharacter,
                targetChannel: channel,
                suppressPing: suppressPing
            });
            //ccvm.addSystemMessage(new Date(), `[user]${kickedCharacter.value}[/user] was kicked from the channel by [user]${operator.value}[/user].`, false, suppressPing);
        }
    }

    channelCharacterBanned(channel: ChannelName, operator: CharacterName, bannedCharacter: CharacterName): void {
        const ns = this.viewModel;
        const ccvm = ns.getOrCreateChannel(channel);
        if (ccvm) {
            ccvm.removeUser(bannedCharacter);
            const suppressPing = (operator.equals(ns.characterName));

            this.sendSystemMessageMultiRouted({
                text: `[user]${bannedCharacter.value}[/user] was [b]banned[/b] from the channel by [user]${operator.value}[/user].`,
                eventName: "bannedFromChannel",
                defaultRouting: {
                    "notme": "targetchannel"
                },
                targetCharacter: bannedCharacter,
                targetChannel: channel,
                suppressPing: suppressPing
            });
            //ccvm.addSystemMessage(new Date(), `[user]${bannedCharacter.value}[/user] was [b]banned[/b] from the channel by [user]${operator.value}[/user].`, false, suppressPing);
        }
    }

    channelCharacterTimedOut(channel: ChannelName, operator: CharacterName, timedOutCharacter: CharacterName, lengthMin: number): void {
        const ns = this.viewModel;
        const ccvm = ns.getOrCreateChannel(channel);
        if (ccvm) {
            ccvm.removeUser(timedOutCharacter);
            const suppressPing = (operator.equals(ns.characterName));

            this.sendSystemMessageMultiRouted({
                text: `[user]${timedOutCharacter.value}[/user] was [b]temporarily banned[/b] from the channel by [user]${operator.value}[/user] for ${lengthMin} minute(s).`,
                eventName: "timedOutFromChannel",
                defaultRouting: {
                    "notme": "targetchannel"
                },
                targetCharacter: timedOutCharacter,
                targetChannel: channel,
                suppressPing: suppressPing
            });
            // ccvm.addSystemMessage(new Date(), 
            //     `[user]${timedOutCharacter.value}[/user] was [b]temporarily banned[/b] from the channel by [user]${operator.value}[/user] for ${lengthMin} minute(s).`,
            //     false, suppressPing);
        }
    }

    channelDescriptionChanged(channel: ChannelName, description: string): void {
        const ns = this.viewModel;
        const ccvm = ns.getOrCreateChannel(channel);
        if (ccvm) {
            ccvm.description = description;
        }
    }

    channelMessageReceived(channel: ChannelName, data: ChannelMessageData): void {
        const ns = this.viewModel;
        const ccvm = ns.getOrCreateChannel(channel);
        if (ccvm) {
            if (data.speakingCharacter == CharacterName.SYSTEM) {
                ccvm.addSystemMessage(data.asOf ?? new Date(), data.message);
            }
            else if (data.isAd) {
                ccvm.addAdMessage(data);
            }
            else {
                ccvm.addChatMessage(data);
            }
        }
    }

    channelRollReceived(channel: ChannelName, data: RollData): void {
        const ns = this.viewModel;
        const ccvm = ns.getOrCreateChannel(channel);
        if (ccvm) {
            ccvm.addRollMessage(data.asOf ?? new Date(), data)
        }
    }

    channelSpinReceived(channel: ChannelName, data: BottleSpinData): void {
        const ns = this.viewModel;
        const ccvm = ns.getOrCreateChannel(channel);
        if (ccvm) {
            ccvm.addSpinMessage(data);
        }
    }
    
    channelInviteReceived(channel: ChannelName, sender: CharacterName, title: string): void {
        const ns = this.viewModel;
        const msg = `[user]${sender}[/user] has invited you to join [session=${title}]${channel.value}[/session]`;

        this.sendSystemMessageMultiRouted({
            text: msg,
            eventName: "channelInviteReceived",
            defaultRouting: {
                "me": "console,targetchannel"
            },
            targetCharacter: ns.characterName
        });
        // this.sendSystemMessageToMulti({
        //     text: msg,
        //     channels: [ ns.console, ns.selectedChannel ]
        // });
    }

    channelClear(channel: ChannelName): void {
        const ns = this.viewModel;
        const ccvm = ns.getChannel(channel);
        if (ccvm) {
            ccvm.clearMessages();
        }
    }

    pmConvoMessageReceived(convoCharacter: CharacterName, data: ChannelMessageData): void {
        const ns = this.viewModel;

        if (!data.speakingCharacter.equals(CharacterName.SYSTEM) && ns.ignoredChars.has(data.speakingCharacter)) {
            ns.chatConnection.notifyIgnoredAsync(data.speakingCharacter);
        }
        else {
            const ccvm = ns.getOrCreatePmConvo(convoCharacter);
            if (ccvm) {
                if (data.speakingCharacter == CharacterName.SYSTEM) {
                    ccvm.addSystemMessage(data.asOf ?? new Date(), data.message);
                }
                else {
                    ccvm.addChatMessage(data);
                }
            }
        }
    }

    pmConvoRollReceived(convoCharacter: CharacterName, data: RollData): void {
        const ns = this.viewModel;
        const ccvm = ns.getOrCreatePmConvo(convoCharacter);
        if (ccvm) {
            ccvm.addRollMessage(data.asOf ?? new Date(), data);
        }
    }

    pmConvoClear(convoCharacter: CharacterName): void {
        const ns = this.viewModel;
        const ccvm = ns.getPmConvo(convoCharacter);
        if (ccvm) {
            ccvm.clearMessages();
        }
    }

    noteReceived(sender: CharacterName, subject: string, noteId: number): void {
        const ns = this.viewModel;
        const url = URLUtils.getNoteUrl(noteId); 

        this.sendSystemMessageMultiRouted({
            text: `New note received from [user]${sender.value}[/user]: [url=${url}]${subject}[/url]`, 
            eventName: "noteReceived",
            defaultRouting: {
                "": "console,pmconvo,currenttab"
            },
            targetCharacter: sender
        });
        // this.sendSystemMessageToMulti({
        //     text: `New note received from [user]${sender.value}[/user]: [url=${url}]${subject}[/url]`, 
        //     channels: [ ns.console, ns.selectedChannel ]
        // });
        // TODO: play notification sound
    }

    consoleClear(): void {
        const ns = this.viewModel;
        ns.console.clearMessages();
    }

    systemMessageReceived(channel: (ChannelName | null), message: string): void {
        const ns = this.viewModel;

        this.sendSystemMessageMultiRouted({
            text: message, 
            eventName: "systemMessageReceived",
            defaultRouting: {
                "": "console,currenttab,targetchannel"
            },
            targetChannel: channel ?? undefined
        });
        // this.sendSystemMessageToMulti({
        //     text: message, 
        //     channels: [ 
        //         ns.console,
        //         channel == null ? ns.selectedChannel : null,
        //         channel != null ? ns.getChannel(channel) : null
        //     ],
        //     importantChannels: []
        // });
    }

    markChannelReplaying(channelName: ChannelName): void {
        const ns = this.viewModel;
        const ch = ns.getOrCreateChannel(channelName);
        if (ch) {
            ch.populatedFromReplay = true;
        }
    }

    markPmConvoReplaying(characterName: CharacterName): void {
        const ns = this.viewModel;
        const ccvm = ns.getOrCreatePmConvo(characterName);
        if (ccvm) {
            ccvm.populatedFromReplay = true;
        }
    }
}