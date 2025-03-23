import { SavedChatStateAutoAdSettingsEntry } from "../settings/AppSettings";
import { ChannelName } from "../shared/ChannelName";
import { OnlineStatus } from "../shared/OnlineStatus";
import { ActiveLoginViewModel, ChatConnectionState } from "../viewmodel/ActiveLoginViewModel";
import { ChatChannelMessageMode, ChatChannelViewModel } from "../viewmodel/ChatChannelViewModel";
import { asDisposable, IDisposable } from "./Disposable";
import { Logger, Logging } from "./Logger";
import { ObjectUniqueId } from "./ObjectUniqueId";
import { ObservableExpression } from "./ObservableExpression";
import { StringUtils } from "./StringUtils";
import { TaskUtils } from "./TaskUtils";

export class AutoAdManager implements IDisposable {
    constructor(private readonly session: ActiveLoginViewModel) {
        this._logger = Logging.createLogger(`AutoAdManager#${session.characterName.canonicalValue}#${ObjectUniqueId.get(this)}`);
        this.scheduleNextTick();
    }

    private readonly _logger: Logger;

    private _tickCleanups: IDisposable[] = [];

    isDisposed: boolean = false;

    dispose(): void {
        if (!this.isDisposed) {
            this.isDisposed = true;
            this.cleanupForTick();
        }
    }
    
    [Symbol.dispose](): void { this.dispose(); }

    private async tick(): Promise<void> {
        this._logger.logDebug("start tick");

        this.cleanupForTick();
        if (this.isDisposed || !this.session.appViewModel.logins.contains(this.session)) { 
            this._logger.logWarn("disposing during tick due to invalid state");
            this.dispose();
            return;
        }

        try {
            const n = Math.floor((new Date()).getTime() / (1000 * 60 * 10));

            const sendableAds = this.checkForSendableAds();
            if (sendableAds) {
                this._logger.logDebug(`There are ${sendableAds.size} channels with sendable ads`);
                for (let kvp of sendableAds) {
                    const chan = kvp[0];
                    const entries = kvp[1];
                    const useEntry = entries[n % entries.length];

                    this._logger.logDebug(`Auto-sending ad to ${chan.title}`);
                    try { await chan.sendAdAsync("[b=::XarChatAutoAdPost][/b]" + useEntry.adText); }
                    catch { }

                    await TaskUtils.delay(1000);
                }
            }
        }
        catch (e) {
            this._logger.logError("Unexpected error during tick", e);
        }

        this._logger.logDebug("end tick");
        this.scheduleNextTick();
    }

    private cleanupForTick() {
        for (let c of this._tickCleanups) {
            try { c.dispose(); }
            catch { }
        }
        this._tickCleanups = [];
    }

    private scheduleNextTick() {
        this.cleanupForTick();
        if (this.isDisposed) { return; }
        if (!this.session.appViewModel.logins.contains(this.session)) { return; }

        this._logger.logDebug("scheduling next tick...");

        const h = window.setTimeout(() => { this.tick(); }, (1000 * 10)); // TODO: optimize this
        this._tickCleanups.push(asDisposable(() => {
            window.clearTimeout(h);
        }));
    }

    private checkForSendableAds(): (Map<ChatChannelViewModel, SavedChatStateAutoAdSettingsEntry[]> | undefined) {
        const cfg = this.session.savedChatState.autoAdSettings;

        if (!cfg.enabled) { return; }

        if (this.session.connectionState != ChatConnectionState.CONNECTED) { return; }

        const myOnlineStatus = this.session.characterSet.getCharacterStatus(this.session.characterName).status;
        const validEntries = cfg.entries.filter(e => e.enabled 
                && !StringUtils.isNullOrWhiteSpace(e.adText)
                && (e.targetOnlineStatuses.contains(myOnlineStatus) || (myOnlineStatus == OnlineStatus.CROWN && e.targetOnlineStatuses.contains(OnlineStatus.ONLINE)))
            );

        const sendableAdsByChannel = new Map<ChatChannelViewModel, SavedChatStateAutoAdSettingsEntry[]>();

        for (let ch of this.session.openChannels) {
            if (!ch.actuallyInChannel) { continue; }
            if (ch.adSendWaitRemainingSec != null) { continue; }
            if (ch.messageMode == ChatChannelMessageMode.CHAT_ONLY) { continue; }

            const tlist: SavedChatStateAutoAdSettingsEntry[] = [];

            for (let entry of validEntries) {
                let gotMatchingChannel = entry.targetChannels.contains(ch.name);
                if (!gotMatchingChannel) { continue; }

                tlist.push(entry);
            }

            if (tlist.length > 0) {
                sendableAdsByChannel.set(ch, tlist);
            }
        }
        
        return sendableAdsByChannel;
    }
}