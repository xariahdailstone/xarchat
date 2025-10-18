import { CharacterName } from "../shared/CharacterName";
import { CancellationTokenSource } from "../util/CancellationTokenSource";
import { KeyValuePair } from "../util/collections/KeyValuePair";
import { HostInterop } from "../util/HostInterop";
import { DateAnchor, LogSearchKind, LogSearchResult } from "../util/HostInteropLogSearch";
import { Mutex } from "../util/Mutex";
import { ObservableValue } from "../util/Observable";
import { ObservableBase, observableProperty } from "../util/ObservableBase";
import { ActiveLoginViewModel } from "./ActiveLoginViewModel";
import { ChannelMessageViewModel, ChannelViewModel, TransientChannelStreamViewModel } from "./ChannelViewModel";

export class RecentConversationsViewModel extends ObservableBase {
    constructor(public readonly session: ActiveLoginViewModel) {
        super();
    }

    private _lastRefreshCTS: CancellationTokenSource = new CancellationTokenSource();

    private _lastSelectedCharacterName: CharacterName | null = null;

    clear() {
        this._lastRefreshCTS.cancel();

        this._recentConversations.value = [];
        this.selectedConversation = null;
    }

    async refreshAsync() {
        const cts = new CancellationTokenSource();
        try {
            this._lastRefreshCTS.cancel();
            this._lastRefreshCTS = cts;

            this._loading.value = true;
            try {
                const previouslySelectedInterlocutor = this._lastSelectedCharacterName;
                this.selectedConversation = null;
                this._recentConversations.value = [];

                const results = await HostInterop.logSearch.getRecentConversationsAsync(this.session.characterName, 100, cts.token);
                this._recentConversations.value = results.map(r => {
                    return {
                        interlocutor: CharacterName.create(r.interlocutorName),
                        lastMessageAt: new Date(r.lastMessageAt)
                    };
                });

                if (previouslySelectedInterlocutor) {
                    const newSel = this._recentConversations.value.filter(rc => CharacterName.equals(rc.interlocutor, previouslySelectedInterlocutor));
                    if (newSel && newSel.length > 0) {
                        this.selectedConversation = newSel[0];
                    }
                    else {
                        this.selectedConversation = null;
                    }
                }
            }
            finally {
                this._loading.value = false;
            }
        }
        catch (e) {
            if (cts.isCancellationRequested) { return; }
            throw e;
        }
    }

    private _recentConversations: ObservableValue<RecentConversationInfo[]> = new ObservableValue([]);
    private _loading: ObservableValue<boolean> = new ObservableValue(false);

    private _selectedConversation: ObservableValue<RecentConversationInfo | null> = new ObservableValue(null);
    private _loadingSelectedConversationItems: ObservableValue<number> = new ObservableValue(0);
    private _selectedConversationItems: ObservableValue<TransientChannelStreamViewModel | null> = new ObservableValue(null);

    get isLoading() { return this._loading.value; }
    get recentConversations() { return this._recentConversations.value; }

    get selectedConversation() { return this._selectedConversation.value; }
    set selectedConversation(value: RecentConversationInfo | null) { 
        if (value !== this._selectedConversation.value) {
            this._selectedConversation.value = value; 
            if (value) {
                this._lastSelectedCharacterName = value.interlocutor;
            }
            this.loadSelectedConversation();
        }
    }

    get isLoadingSelectedConversationItems() { return this._loadingSelectedConversationItems.value > 0; }

    get selectedConversationItems() { return this._selectedConversationItems.value; }
    set selectedConversationItems(value: TransientChannelStreamViewModel | null) {
        if (value !== this._selectedConversation.value) {
            const oldValue = this._selectedConversationItems.value;
            this._selectedConversationItems.value = value;
            if (oldValue) {
                oldValue.dispose();
            }
        }
    }

    private _loadSelectedConversationCTS: CancellationTokenSource = new CancellationTokenSource();
    private _loadSelectedConversationMutex: Mutex = new Mutex();
    private async loadSelectedConversation() {
        const selectedConversation = this._selectedConversation.value;

        const cts = new CancellationTokenSource();
        this._loadSelectedConversationCTS.cancel();
        this._loadSelectedConversationCTS = cts;

        using heldMutex = await this._loadSelectedConversationMutex.acquireAsync(cts.token);

        if (selectedConversation == null) {
            this.selectedConversationItems = null;
        }
        else {
            this._loadingSelectedConversationItems.value = this._loadingSelectedConversationItems.value + 1;
            try {
                const searchResults = await HostInterop.logSearch.performSearchAsync(this.session.characterName,
                    LogSearchKind.PrivateMessages, selectedConversation.interlocutor.value, DateAnchor.Before, new Date(), 200, cts.token);
                
                var csvm = new TransientChannelStreamViewModel(this.session, selectedConversation!.interlocutor.value);
                for (let lm of searchResults) {
                    const lcm = HostInterop.convertFromApiPMConvoLoggedMessage(lm);
                    const mvm = ChannelViewModel.convertFromLoggedMessage(csvm, this.session, this.session.appViewModel, lcm);
                    if (mvm) {
                        csvm.messages.unshift(new KeyValuePair(mvm, mvm));
                    }
                }
                this.selectedConversationItems = csvm;
            }
            catch (e) {
                this.selectedConversationItems = null;
                if (!cts.isCancellationRequested) { throw e; }
            }
            finally {
                this._loadingSelectedConversationItems.value = this._loadingSelectedConversationItems.value - 1;
            }
        }
    }

    openPMTab() {
        if (this.selectedConversation) {
            const interlocutor = this.selectedConversation.interlocutor;
            this.session.selectedChannel = this.session.getOrCreatePmConvo(interlocutor);
        }
    }
}

export interface RecentConversationInfo {
    interlocutor: CharacterName;
    lastMessageAt: Date;
}