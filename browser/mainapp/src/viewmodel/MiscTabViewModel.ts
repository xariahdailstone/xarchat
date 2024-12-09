import { ObservableBase, observableProperty } from "../util/ObservableBase";
import { ActiveLoginViewModel, SelectableTab } from "./ActiveLoginViewModel";
import { ConsoleChannelViewModel } from "./ConsoleChannelViewModel";

export class MiscTabViewModel extends ObservableBase {
    constructor(
        public readonly activeLoginViewModel: ActiveLoginViewModel,
        title: string,
        private readonly channel: SelectableTab) {

        super();
        this.title = title;
    }

    @observableProperty
    get isSelected(): boolean {
        return (this.activeLoginViewModel.selectedTab == this.channel);
    }

    @observableProperty
    title: string = "";

    select() {
        this.activeLoginViewModel.selectedTab = this.channel;
    }
}
