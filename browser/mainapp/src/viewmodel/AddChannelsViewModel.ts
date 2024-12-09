import { ChannelMetadata } from "../fchat/ChatConnection";
import { ChannelName } from "../shared/ChannelName";
import { CatchUtils } from "../util/CatchUtils";
import { ObservableBase, observableProperty } from "../util/ObservableBase";
import { ObservableOrderedDictionaryImpl, ObservableOrderedSetImpl } from "../util/ObservableKeyedLinkedList";
import { StringUtils } from "../util/StringUtils";
import { StdObservableFilteredView, StdObservableSortedList } from "../util/collections/StdObservableView";
import { ActiveLoginViewModel, SelectableTabViewModel } from "./ActiveLoginViewModel";

export class AddChannelsViewModel extends ObservableBase implements SelectableTabViewModel {
    constructor(
        public readonly parent: ActiveLoginViewModel) {

        super();

        this.publicChannels = new ObservableOrderedSetImpl<string, AddChannelsItemViewModel>(cwt => cwt.sortableTitle)
        this.privateChannels = new ObservableOrderedSetImpl<string, AddChannelsItemViewModel>(cwt => cwt.sortableTitle)

        this.updatePublicChannelSort();
        this.updatePrivateChannelSort();
        
        this.refresh(false);
    }

    @observableProperty
    isTabActive: boolean = false;

    private _channelFilter: string = "";
    @observableProperty
    get channelFilter(): string { return this._channelFilter; }
    set channelFilter(value: string) {
        if (value != this._channelFilter) {
            this._channelFilter = value;
            this.updateFilterViews();
        }
    }

    private updateFilterViews() {
        this.refilterPublicChannels();
        this.refilterPrivateChannels();
    }

    get activeLoginViewModel() { return this.parent; }

    @observableProperty
    loadingPublicChannels: boolean = false;

    @observableProperty
    loadingPrivateChannels: boolean = false;

    @observableProperty
    failureMessage: string | null = null;

    @observableProperty
    readonly publicChannels: ObservableOrderedSetImpl<string, AddChannelsItemViewModel>;

    @observableProperty
    publicChannelsSorted!: StdObservableSortedList<AddChannelsItemViewModel, AddChannelsItemViewModel>;

    @observableProperty
    publicChannelsSortedView!: StdObservableFilteredView<AddChannelsItemViewModel>;

    private _publicChannelSortField: ("title" | "count") = "title";
    @observableProperty
    get publicChannelSortField() { return this._publicChannelSortField; }
    set publicChannelSortField(value) {
        if (value != this._publicChannelSortField) {
            this._publicChannelSortField = value;
            this.updatePublicChannelSort();
        }
    }

    private _publicChannelSortDescending: boolean = false;
    @observableProperty
    get publicChannelSortDescending() { return this._publicChannelSortDescending; }
    set publicChannelSortDescending(value) {
        if (value != this._publicChannelSortDescending) {
            this._publicChannelSortDescending = value;
            this.updatePublicChannelSort();
        }
    }

    private updatePublicChannelSort() {
        let sortFunc: (a: AddChannelsItemViewModel, b: AddChannelsItemViewModel) => number;
        if (this._publicChannelSortField == "title") {
            sortFunc = (a, b) => a.title < b.title ? -1 : a.title > b.title ? 1 : 0;
        }
        else {
            sortFunc = (a, b) => a.count - b.count;
        }

        if (this._publicChannelSortDescending) {
            const innerSortFunc = sortFunc;
            sortFunc = (a, b) => 0 - (innerSortFunc(a, b));
        }

        const newView = new StdObservableSortedList<AddChannelsItemViewModel, AddChannelsItemViewModel>(item => item, sortFunc);
        for (let item of this.publicChannels.iterateValues()) {
            newView.add(item);
        }

        this.publicChannelsSorted = newView;
        this.refilterPublicChannels();
    }

    private createFilterFunc() {
        const cf = this.channelFilter.toLowerCase();
        return (x: AddChannelsItemViewModel) => x.lowercaseTitle.indexOf(cf) != -1;
    }

    private refilterPublicChannels() {
        const newView = new StdObservableFilteredView<AddChannelsItemViewModel>(this.publicChannels, this.createFilterFunc());
        this.publicChannelsSortedView = newView;
    }

    private refilterPrivateChannels() {
        const newView = new StdObservableFilteredView<AddChannelsItemViewModel>(this.privateChannels, this.createFilterFunc());
        this.privateChannelsSortedView = newView;
    }

    @observableProperty
    readonly privateChannels: ObservableOrderedSetImpl<string, AddChannelsItemViewModel>;

    @observableProperty
    privateChannelsSorted!: StdObservableSortedList<AddChannelsItemViewModel, AddChannelsItemViewModel>;

    @observableProperty
    privateChannelsSortedView!: StdObservableFilteredView<AddChannelsItemViewModel>;

    private _privateChannelSortField: ("title" | "count") = "title";
    @observableProperty
    get privateChannelSortField() { return this._privateChannelSortField; }
    set privateChannelSortField(value) {
        if (value != this._privateChannelSortField) {
            this._privateChannelSortField = value;
            this.updatePrivateChannelSort();
        }
    }

    private _privateChannelSortDescending: boolean = false;
    @observableProperty
    get privateChannelSortDescending() { return this._privateChannelSortDescending; }
    set privateChannelSortDescending(value) {
        if (value != this._privateChannelSortDescending) {
            this._privateChannelSortDescending = value;
            this.updatePrivateChannelSort();
        }
    }

    private updatePrivateChannelSort() {
        let sortFunc: (a: AddChannelsItemViewModel, b: AddChannelsItemViewModel) => number;
        if (this._privateChannelSortField == "title") {
            sortFunc = (a, b) => a.title < b.title ? -1 : a.title > b.title ? 1 : 0;
        }
        else {
            sortFunc = (a, b) => a.count - b.count;
        }

        if (this._privateChannelSortDescending) {
            const innerSortFunc = sortFunc;
            sortFunc = (a, b) => 0 - (innerSortFunc(a, b));
        }

        const newView = new StdObservableSortedList<AddChannelsItemViewModel, AddChannelsItemViewModel>(item => item, sortFunc);
        for (let item of this.privateChannels.iterateValues()) {
            newView.add(item);
        }

        this.privateChannelsSorted = newView;
        this.refilterPrivateChannels();
    }

    async refresh(bypassCache: boolean) {
        if (!this.loadingPublicChannels && !this.loadingPrivateChannels) {
            try {
                this.loadingPublicChannels = true;
                this.loadingPrivateChannels = true;
                this.failureMessage = null;

                this.publicChannels.clear();
                this.privateChannels.clear();

                {
                    let pubChList: ChannelMetadata[];
                    if (bypassCache || this.activeLoginViewModel.cachedPublicChannelListExpiresAt == null ||
                        this.activeLoginViewModel.cachedPublicChannelListExpiresAt < new Date() ||
                        this.activeLoginViewModel.cachedPublicChannelList == null)
                    {
                        pubChList = await this.activeLoginViewModel.chatConnection.getPublicChannelsAsync();
                        this.activeLoginViewModel.cachedPublicChannelList = pubChList;
                        this.activeLoginViewModel.cachedPublicChannelListExpiresAt = new Date(new Date().getTime() + 1000 * 60 * 1);
                    }
                    else {
                        pubChList = this.activeLoginViewModel.cachedPublicChannelList;
                    }

                    for (let cdata of pubChList) {
                        const item = new AddChannelsItemViewModel(this, cdata.name, cdata.title, cdata.count);
                        this.publicChannels.add(item);
                    }
                    this.updatePublicChannelSort();
                    this.loadingPublicChannels = false;
                }

                {
                    let privChList: ChannelMetadata[];
                    if (bypassCache || this.activeLoginViewModel.cachedPrivateChannelListExpiresAt == null ||
                        this.activeLoginViewModel.cachedPrivateChannelListExpiresAt < new Date() ||
                        this.activeLoginViewModel.cachedPrivateChannelList == null)
                    {
                        privChList = await this.activeLoginViewModel.chatConnection.getPrivateChannelsAsync();
                        this.activeLoginViewModel.cachedPrivateChannelList = privChList;
                        this.activeLoginViewModel.cachedPrivateChannelListExpiresAt = new Date(new Date().getTime() + 1000 * 60 * 1);
                    }
                    else {
                        privChList = this.activeLoginViewModel.cachedPrivateChannelList;
                    }

                    for (let cdata of privChList) {
                        const item = new AddChannelsItemViewModel(this, cdata.name, cdata.title, cdata.count);
                        this.privateChannels.add(item);
                    }
                    this.updatePrivateChannelSort();
                    this.loadingPrivateChannels = false;
                }
            }
            catch (e) {
                this.publicChannels.clear();
                this.privateChannels.clear();
                this.updatePublicChannelSort();
                this.updatePrivateChannelSort();
                this.loadingPublicChannels = false;
                this.loadingPrivateChannels = false;
                this.failureMessage = CatchUtils.getMessage(e);
            }
        }
    }

    private extractSortableChannelTitle(rawTitle: string): string {
        const canonicalizedTitle = StringUtils.canonicalizeConfusables(rawTitle)!;
        const result = canonicalizedTitle.replace(/ /g, "").replace(/[^A-Za-z0-9]/g, "").toLowerCase();
        return result;
    }
}

export class AddChannelsItemViewModel {
    constructor(
        public readonly parent: AddChannelsViewModel,
        public readonly name: ChannelName,
        public readonly title: string,
        public readonly count: number) {

        const canonicalizedTitle = StringUtils.canonicalizeConfusables(title)!;
        this.sortableTitle = canonicalizedTitle.replace(/ /g, "").replace(/[^A-Za-z0-9]/g, "").toLowerCase();
        this.lowercaseTitle = title.toLowerCase();
    }

    readonly sortableTitle: string;
    readonly lowercaseTitle: string;
}
