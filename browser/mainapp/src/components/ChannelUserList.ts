import { CharacterGenderConvert } from "../shared/CharacterGender.js";
import { CharacterName } from "../shared/CharacterName.js";
import { CharacterStatus } from "../shared/CharacterSet.js";
import { OnlineStatusConvert } from "../shared/OnlineStatus.js";
import { CharacterLinkUtils } from "../util/CharacterLinkUtils.js";
import { getEffectiveCharacterName, getEffectiveCharacterNameWatcher } from "../util/CharacterNameIcons.js";
import { asDisposable, IDisposable } from "../util/Disposable.js";
import { HTMLUtils } from "../util/HTMLUtils.js";
import { CollectionChangeEvent, CollectionChangeType, ReadOnlyObservableCollection } from "../util/ObservableCollection.js";
import { DictionaryChangeEvent, DictionaryChangeType, ObservableOrderedDictionary } from "../util/ObservableKeyedLinkedList.js";
import { WhenChangeManager } from "../util/WhenChange.js";
import { KeyValuePair } from "../util/collections/KeyValuePair.js";
import { ChannelViewModel } from "../viewmodel/ChannelViewModel.js";
import { ChatChannelUserViewModel, ChatChannelViewModel } from "../viewmodel/ChatChannelViewModel.js";
import { CharacterStatusListener } from "./CharacterStatusListener.js";
import { CollectionViewLightweight } from "./CollectionViewLightweight.js";
import { ComponentBase, componentElement } from "./ComponentBase.js";
import { StatusDot } from "./StatusDot.js";

@componentElement("x-channeluserlist")
export class ChannelUserList extends ComponentBase<ChatChannelViewModel> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <div id="elUserCountContainer" class="usercount">
                <span id="elUserCount">0</span> in channel
            </div>
            <div id="elMods" class="section">
                <div class="sectiontitle">Moderators (<span id="elModCount">0</span>)</div>
                <x-channelusersublist modelpath="usersModerators">
                    <div class="sectionitems" id="elUsersModerators"></div>
                </x-channelusersublist>
            </div>
            <div id="elWatched" class="section">
                <div class="sectiontitle">Friends/Bookmarks (<span id="elWatchedCount">0</span>)</div>
                <x-channelusersublist modelpath="usersWatched">
                    <div class="sectionitems" id="elUsersWatched"></div>
                </x-channelusersublist>
            </div>
            <div id="elLooking" class="section">
                <div class="sectiontitle">Looking (<span id="elLookingCount">0</span>)</div>
                <x-channelusersublist modelpath="usersLooking">
                    <div class="sectionitems" id="elUsersLooking"></div>
                </x-channelusersublist>
            </div>
            <div id="elOthers" class="section">
                <div class="sectiontitle">Characters (<span id="elOthersCount">0</span>)</div>
                <x-channelusersublist modelpath="usersOther">
                    <div class="sectionitems" id="elUsersOthers"></div>
                </x-channelusersublist>
            </div>
        `);

        this.watch("usersModerators.size", v => {
            this.$("elModCount")!.innerText = v ? v.toLocaleString() : "0";
        });
        this.watch("usersWatched.size", v => {
            this.$("elWatchedCount")!.innerText = v ? v.toLocaleString() : "0";
        });
        this.watch("usersLooking.size", v => {
            this.$("elLookingCount")!.innerText = v ? v.toLocaleString() : "0";
        });
        this.watch("usersOther.size", v => {
            this.$("elOthersCount")!.innerText = v ? v.toLocaleString() : "0";
        });

        this.watchExpr(vm => vm.usersModerators.size + vm.usersLooking.size + vm.usersWatched.size + vm.usersOther.size, totalCount => {
            this.$("elUserCount")!.innerText = totalCount ? totalCount.toLocaleString() : "0";
        });
    }
}

class UserItemMetadata implements IDisposable {
    constructor(m: ChatChannelUserViewModel) {
        const el = document.createElement("div");
        el.classList.add("useritem");
        CharacterLinkUtils.setupCharacterLink(el, m.parent.activeLoginViewModel, m.character, m.parent);

        const elStatusDot = document.createElement("div");
        elStatusDot.classList.add("statusdot");
        elStatusDot.appendChild(document.createTextNode("\u2B24"));
        el.appendChild(elStatusDot);

        const elName = document.createElement("div");
        elName.classList.add("name");
        el.appendChild(elName);

        this.element = el;

        this._effectiveNameWatcher = getEffectiveCharacterNameWatcher(m.character, m.parent, (nameDocFrag) => {
            while (elName.firstChild) {
                elName.firstChild.remove();
            }
            elName.appendChild(nameDocFrag);
        });

        const update = (cs: CharacterStatus) => {
            //if (cs.characterName.value == "Ciriously") { debugger; }
            this._wcm.assign({ status: cs.status, gender: cs.gender, ignored: cs.ignored }, () => {
                const sclass = "onlinestatus-" + OnlineStatusConvert.toString(cs.status).toLowerCase();
                const gclass = "gender-" + CharacterGenderConvert.toString(cs.gender).toLowerCase();
                const isIgnored = cs.ignored;

                elStatusDot.classList.add(sclass);
                elStatusDot.title = OnlineStatusConvert.toString(cs.status);
                elName.classList.add(gclass);
                el.classList.toggle("ignored", isIgnored);

                return asDisposable(() => {
                    elStatusDot.classList.remove(sclass);
                    elName.classList.remove(gclass);
                    if (isIgnored) {
                        el.classList.remove("ignored");
                    }
                });
            });
        };

        this._statusListener = m.characterSet.addStatusListenerDebug(
            ["ChannelUserList.UserItemMetadata", m.character],
            m.character, update);
        update(m.characterSet.getCharacterStatus(m.character));
    }

    readonly element: HTMLDivElement;
    private readonly _statusListener: IDisposable;
    private readonly _effectiveNameWatcher: IDisposable;

    private readonly _wcm: WhenChangeManager = new WhenChangeManager();

    private _disposed: boolean = false;
    dispose() {
        if (!this._disposed) {
            this._disposed = true;
            this._effectiveNameWatcher.dispose();
            this._statusListener.dispose();
            this._wcm.dispose();
        }
    }

    [Symbol.dispose]() { this.dispose(); }

    get isDisposed() { return this._disposed; }
}

@componentElement("x-channelusersublist")
class ChannelUserSubList extends CollectionViewLightweight<KeyValuePair<any, ChatChannelUserViewModel>> {
    constructor() {
        super();
    }

    createUserElement(kvm: KeyValuePair<any, ChatChannelUserViewModel>): [HTMLElement, IDisposable] {
        const vm = kvm.value;
        const uim = new UserItemMetadata(vm);
        return [uim.element, uim];
    }

    destroyUserElement(kvm: KeyValuePair<any, ChatChannelUserViewModel>, el: HTMLElement): void {
    }
}
