import { CharacterGenderConvert } from "../shared/CharacterGender";
import { CharacterName } from "../shared/CharacterName";
import { CharacterStatus } from "../shared/CharacterSet";
import { OnlineStatusConvert } from "../shared/OnlineStatus";
import { jsx, Fragment, VNode } from "../snabbdom/index";
import { IDisposable, asDisposable } from "../util/Disposable";
import { EL } from "../util/EL";
import { MouseButton } from "../util/EventListenerUtil";
import { HTMLUtils } from "../util/HTMLUtils";
import { ObservableValue } from "../util/Observable";
import { ObservableExpression } from "../util/ObservableExpression";
import { URLUtils } from "../util/URLUtils";
import { WhenChangeManager } from "../util/WhenChange";
import { ChatBBCodeParser } from "../util/bbcode/BBCode";
import { KeyValuePair } from "../util/collections/KeyValuePair";
import { ActiveLoginViewModel } from "../viewmodel/ActiveLoginViewModel";
import { PMConvoChannelViewModel } from "../viewmodel/PMConvoChannelViewModel";
import { CharacterDetailPopupViewModel } from "../viewmodel/popups/CharacterDetailPopupViewModel";
import { CollectionViewLightweight } from "./CollectionViewLightweight";
import { ComponentBase, componentElement } from "./ComponentBase";
import { RenderingComponentBase } from "./RenderingComponentBase";
import { StatusDot, StatusDotLightweight } from "./StatusDot";

@componentElement("x-watchedlist")
export class WatchedList extends RenderingComponentBase<ActiveLoginViewModel> {
    render(): (VNode | [VNode, IDisposable]) {
        const vm = this.viewModel;
        if (vm) {

            const hdrText = this.showType == WatchedListShowType.ALL ? "Friends/Bookmarks"
                : this.showType == WatchedListShowType.FRIENDS ? "Friends"
                : "Bookmarks";

            const listModel = this.showType == WatchedListShowType.ALL ? vm.watchedChars
                : this.showType == WatchedListShowType.FRIENDS ? vm.friends
                : vm.bookmarks;
            const onlineListModel = this.showType == WatchedListShowType.ALL ? vm.onlineWatchedChars
                : this.showType == WatchedListShowType.FRIENDS ? vm.onlineFriends
                : vm.onlineBookmarks;

            const countText = (vm.showOnlineWatchedOnly ? `${onlineListModel.length} of ${listModel.length}` : listModel.length)
            const boundList = (vm.showOnlineWatchedOnly ? onlineListModel : listModel);

            return <>
                <div classList={["filter-button-container"]}>
                    <button classList={["filter-button", (!vm.showOnlineWatchedOnly ? "selected" : "not-selected") ]} id="elFilterAll" on={{
                        "click": () => { vm.showOnlineWatchedOnly = false; }
                    }}>All</button>
                    <button classList={["filter-button", (vm.showOnlineWatchedOnly ? "selected" : "not-selected") ]} id="elFilterOnline" on={{
                        "click": () => { vm.showOnlineWatchedOnly = true; }
                    }}>Online</button>
                </div>
                <div id="elSection" classList={["section"]}>
                    <div classList={["sectiontitle"]}>
                        <div classList={["sectiontitle-text"]}>{hdrText} (<span id="elCount">{countText}</span>)</div>
                    </div>

                    <x-characterscollectionview props={{ "activeLoginViewModel": vm, "viewModel": boundList }} id="elCollectionView">
                        <div classList={["sectionitems", "pmconvo"]} id="elWatchedChars"></div>
                    </x-characterscollectionview>
                </div>
            </>;
        }
        else {
            return <></>;
        }
    }

    protected override get requiredStylesheets() {
        return [ 
            ...this.coreRequiredStylesheets,
            `styles/components/ChatsList.css`,
            ...this.myRequiredStylesheets
        ];
    }

    private readonly _showType: ObservableValue<WatchedListShowType> = new ObservableValue(WatchedListShowType.ALL);
    get showType() { return this._showType.value; }
    set showType(value: WatchedListShowType) {
        this._showType.value = value;
    }
}

export enum WatchedListShowType {
    ALL,
    FRIENDS,
    BOOKMARKS
}

@componentElement("x-characterscollectionview")
export class CharactersCollectionView extends CollectionViewLightweight<KeyValuePair<any, CharacterName>> {
    constructor() {
        super();
    }

    private _activeLoginViewModel: (ActiveLoginViewModel | null) = null;
    get activeLoginViewModel() { return this._activeLoginViewModel; }
    set activeLoginViewModel(value) {
        if (value != this._activeLoginViewModel) {
            this._activeLoginViewModel = value;
            this.repopulate();
        }
    }

    private showCharacterDetailPopup(character: CharacterName, targetEl: HTMLElement) {
        if (this.activeLoginViewModel) {
            const popupVm = new CharacterDetailPopupViewModel(this.activeLoginViewModel.appViewModel, this.activeLoginViewModel, character, null, targetEl);
            this.activeLoginViewModel.appViewModel.popups.push(popupVm);
        }
    }

    createUserElement(kvm: KeyValuePair<any, CharacterName>): [HTMLElement, IDisposable] {
        const vm = kvm.value;
        const disposables: IDisposable[] = [];

        const elIconImage = EL("img", { class: "sectionitems-item-icon", src: URLUtils.getAvatarImageUrl(vm), loading: "lazy" });
        
        const cStatusDot = new StatusDotLightweight();
        cStatusDot.element.classList.add("sectionitems-item-icondot");
        const elStatusDot = cStatusDot.element;
        disposables.push(cStatusDot);

        const elName = EL("div", { class: "sectionitems-item-name" }, [ vm.value ]);
        const elSubText = EL("div", { class: "sectionitems-item-subtext" }, [ "" ]);

        const el = EL("div", { class: "watchedchar" }, [
            EL("div", { class: "sectionitems-item-icon-container" }, [
                elIconImage,
                elStatusDot
            ]),
            elName,
            elSubText
        ]);
        el.addEventListener("click", (e) => {
            if (this.activeLoginViewModel) {
                try {
                    switch (e.button) {
                        case MouseButton.LEFT:
                            const pmconvo = this.activeLoginViewModel.getOrCreatePmConvo(vm, true);
                            this.activeLoginViewModel.selectedChannel = pmconvo;
                            break;
                        case MouseButton.RIGHT:
                            this.showCharacterDetailPopup(vm, el);
                            e.preventDefault();
                            return false;
                    }
                }
                catch { }
            }
        });
        el.addEventListener("contextmenu", (e) => {
            this.showCharacterDetailPopup(vm, el);
            e.preventDefault();
            return false;
        });

        if (this.activeLoginViewModel) {
            const wcm = new WhenChangeManager();
            const updateDisplay = (cs: CharacterStatus) => {
                wcm.assign({ cs }, () => {
                    cStatusDot.status = cs.status;
                    elName.innerText = cs.characterName.value;
                    const className = `gender-${CharacterGenderConvert.toString(cs.gender).toLowerCase()}`;
                    elName.classList.add(className);
                    elName.classList.toggle("char-is-bookmark", this.activeLoginViewModel!.bookmarks.has(cs.characterName));
                    elName.classList.toggle("char-is-friend", this.activeLoginViewModel!.friends.has(cs.characterName));

                    let subText = OnlineStatusConvert.toString(cs.status);
                    if (cs.statusMessage != "") {
                        const strippedMessage = cs.statusMessage.split('\n')[0];
                        subText = subText + " | " + strippedMessage;
                    }

                    const parseResult = ChatBBCodeParser.parse(subText, {
                        activeLoginViewModel: this.activeLoginViewModel!,
                        addUrlDomains: false,
                        appViewModel: this.activeLoginViewModel!.appViewModel,
                        imagePreviewPopups: false,
                        syncGifs: true,
                        parseAsStatus: true,
                        sink: this.activeLoginViewModel!.bbcodeSink
                    });
                    elSubText.innerText = "";
                    elSubText.appendChild(parseResult.element);

                    return asDisposable(() => {
                        parseResult.dispose();
                        elName.classList.remove(className);
                    });
                });
            };
            disposables.push(wcm);

            const initCs = this.activeLoginViewModel.characterSet.getCharacterStatus(vm);
            updateDisplay(initCs);

            const d = this.activeLoginViewModel.characterSet.addStatusListenerDebug(
                [ "WatchedList.CharactersCollectionView.userElement", vm ], 
                vm, updateDisplay);
            disposables.push(d);

            const updateSelectedClass = () => {
                const selectedChannel = this.activeLoginViewModel?.selectedTab;
                if (selectedChannel instanceof PMConvoChannelViewModel && selectedChannel.character.equals(vm)) {
                    el.classList.toggle("selected", true);
                }
                else {
                    el.classList.toggle("selected", false);
                }
            };

            const sel = new ObservableExpression(() => this.activeLoginViewModel!.selectedTab, (selectedChannel) => {
                updateSelectedClass();
            });
            disposables.push(sel);
            updateSelectedClass();
        }

        return [el, asDisposable(...disposables)];
    }

    destroyUserElement(kvm: KeyValuePair<any, CharacterName>, el: HTMLElement): void {
    }
}