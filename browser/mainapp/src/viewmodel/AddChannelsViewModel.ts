import { ChannelMetadata } from "../fchat/ChatConnection";
import { ChannelName } from "../shared/ChannelName";
import { CatchUtils } from "../util/CatchUtils";
import { ObjectUniqueId } from "../util/ObjectUniqueId";
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

    private makeSortFunc<T>(sortProps: ((item: T) => any)[]) {
        let sortFunc: ((a: T, b: T) => number) = () => 0;
        for (let i = sortProps.length - 1; i >= 0; i--) {
            let sortPropGetter = sortProps[i];
            let prevSortFunc = sortFunc;
            sortFunc = (a, b) => sortPropGetter(a) < sortPropGetter(b) ? -1 : sortPropGetter(a) > sortPropGetter(b) ? 1 : prevSortFunc(a, b);
        }
        return sortFunc;
    }

    private updatePublicChannelSort() {
        let sortFunc: (a: AddChannelsItemViewModel, b: AddChannelsItemViewModel) => number;
        if (this._publicChannelSortField == "title") {
            // sortFunc = (a, b) => a.sortableTitle < b.sortableTitle ? -1 : a.sortableTitle > b.sortableTitle ? 1 : 0;
            sortFunc = this.makeSortFunc<AddChannelsItemViewModel>([
                (x) => x.sortableTitle,
                (x) => x.title
            ]);
        }
        else {
            //sortFunc = (a, b) => a.count - b.count;
            sortFunc = this.makeSortFunc<AddChannelsItemViewModel>([
                (x) => x.count,
                (x) => x.sortableTitle,
                (x) => x.title
            ]);
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
        const newView = new StdObservableFilteredView<AddChannelsItemViewModel>(this.publicChannelsSorted, this.createFilterFunc());
        this.publicChannelsSortedView = newView;
    }

    private refilterPrivateChannels() {
        const newView = new StdObservableFilteredView<AddChannelsItemViewModel>(this.privateChannelsSorted, this.createFilterFunc());
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

    publicChannelSortSet(field: ("title" | "count"), descending: boolean) {
        if (field != this._publicChannelSortField || descending != this._publicChannelSortDescending) {
            this._publicChannelSortField = field;
            this._publicChannelSortDescending = descending;
            this.updatePublicChannelSort();
        }
    }

    privateChannelSortSet(field: ("title" | "count"), descending: boolean) {
        if (field != this._privateChannelSortField || descending != this._privateChannelSortDescending) {
            this._privateChannelSortField = field;
            this._privateChannelSortDescending = descending;
            this.updatePrivateChannelSort();
        }
    }

    private updatePrivateChannelSort() {
        let sortFunc: (a: AddChannelsItemViewModel, b: AddChannelsItemViewModel) => number;
        if (this._privateChannelSortField == "title") {
            // sortFunc = (a, b) => a.sortableTitle < b.sortableTitle ? -1 : a.sortableTitle > b.sortableTitle ? 1 : 0;
            sortFunc = this.makeSortFunc<AddChannelsItemViewModel>([
                (x) => x.sortableTitle,
                (x) => x.title
            ]);
        }
        else {
            //sortFunc = (a, b) => a.count - b.count;
            sortFunc = this.makeSortFunc<AddChannelsItemViewModel>([
                (x) => x.count,
                (x) => x.sortableTitle,
                (x) => x.title
            ]);
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
        const result = StringUtils.channelTitleAsSortableString(rawTitle);
        return result;
        // const canonicalizedTitle = StringUtils.canonicalizeConfusables(rawTitle)!;
        // const result = canonicalizedTitle.replace(/ /g, "").replace(/[^A-Za-z0-9]/g, "").toLowerCase();
        // return result;
    }

    async createChannelAsync(): Promise<void> {
        const newChannelTitle = await this.activeLoginViewModel.appViewModel.promptForStringAsync({ 
            title: "Create New Channel",
            message: "Enter the title of the channel you wish to create.",
            confirmButtonTitle: "Create Channel"
        });
        if (!StringUtils.isNullOrWhiteSpace(newChannelTitle)) {
            // TODO:
            try {
                const chname = await this.activeLoginViewModel.chatConnection.createChannelAsync(newChannelTitle);
                const ch = this.activeLoginViewModel.getChannel(chname);
                this.activeLoginViewModel.selectedChannel = ch;
            }
            catch (err) {
                this.activeLoginViewModel.appViewModel.alertAsync(CatchUtils.getMessage(err), "Failed to Create Channel");
            }
        }
    }
}

export class AddChannelsItemViewModel {
    constructor(
        public readonly parent: AddChannelsViewModel,
        public readonly name: ChannelName,
        public readonly title: string,
        public readonly count: number) {

        const uniqueId = ObjectUniqueId.get(this);

        const canonicalizedTitle = StringUtils.canonicalizeConfusables(title)!;
        this.sortableTitle = canonicalizedTitle.replace(/ /g, "").replace(/[^A-Za-z0-9]/g, "").toLowerCase() + "!!!!!!" + uniqueId.toString();
        this.lowercaseTitle = title.toLowerCase();
    }

    readonly sortableTitle: string;
    readonly lowercaseTitle: string;
}
