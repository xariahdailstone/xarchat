import { CharacterGenderConvert } from "../shared/CharacterGender";
import { CharacterName } from "../shared/CharacterName";
import { CharacterStatus } from "../shared/CharacterSet";
import { OnlineStatusConvert } from "../shared/OnlineStatus";
import { IDisposable, asDisposable } from "../util/Disposable";
import { EL } from "../util/EL";
import { MouseButton } from "../util/EventListenerUtil";
import { HTMLUtils } from "../util/HTMLUtils";
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
import { StatusDot, StatusDotLightweight } from "./StatusDot";

@componentElement("x-watchedlist")
export class WatchedList extends ComponentBase<ActiveLoginViewModel> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <div class="filter-button-container">
                <button class="filter-button" id="elFilterAll">All</button>
                <button class="filter-button" id="elFilterOnline">Online</button>
            </div>
            <div id="elSection" class="section">
                <div class="sectiontitle">
                    <div class="sectiontitle-text">Friends/Bookmarks (<span id="elCount">0</span>)</div>
                </div>

                <x-characterscollectionview modelpath="watchedChars" id="elCollectionView">
                    <div class="sectionitems pmconvo" id="elWatchedChars"></div>
                </x-characterscollectionview>
            </div>
        `);

        const elFilterAll = this.$("elFilterAll") as HTMLButtonElement;
        const elFilterOnline = this.$("elFilterOnline") as HTMLButtonElement;

        const elCount = this.$("elCount") as HTMLSpanElement;
        const elCollectionView = this.$("elCollectionView") as CharactersCollectionView;

        this.watch(".", v => {
            elCollectionView.activeLoginViewModel = v;
        });

        const updateCount = () => {
            const allSize = this.viewModel?.watchedChars.size ?? 0;
            const onlineSize = this.viewModel?.onlineWatchedChars.size ?? 0;
            let msg: string;
            if (this.viewModel?.showOnlineWatchedOnly) {
                msg = `${onlineSize} of ${allSize}`;
            }
            else {
                msg = allSize.toString();
            }
            elCount.innerText = msg;
        };

        this.watch("watchedChars.size", updateCount);
        this.watch("onlineWatchedChars.size", updateCount);
        this.watch("showOnlineWatchedOnly", v => {
            if (!!v) {
                elCollectionView.modelPath = "onlineWatchedChars";
                elFilterOnline.classList.add("selected");
                elFilterAll.classList.remove("selected");
            }
            else {
                elCollectionView.modelPath = "watchedChars";
                elFilterAll.classList.add("selected");
                elFilterOnline.classList.remove("selected");
            }
            updateCount();
        });

        elFilterAll.addEventListener("click", () => {
            if (this.viewModel) {
                this.viewModel.showOnlineWatchedOnly = false;
            }
        });
        elFilterOnline.addEventListener("click", () => {
            if (this.viewModel) {
                this.viewModel.showOnlineWatchedOnly = true;
            }
        });
    }

    protected override get requiredStylesheets() {
        return [ 
            ...this.coreRequiredStylesheets,
            `styles/components/ChatsList.css`,
            ...this.myRequiredStylesheets
        ];
    }
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