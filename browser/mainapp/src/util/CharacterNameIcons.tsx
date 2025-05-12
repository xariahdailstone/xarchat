import { CharacterName } from "../shared/CharacterName";
import { jsx, JsxVNodeChild, JsxVNodeChildren, VNode } from "../snabbdom/index.js";
import { ActiveLoginViewModel } from "../viewmodel/ActiveLoginViewModel";
import { ChannelViewModel } from "../viewmodel/ChannelViewModel";
import { ChatChannelViewModel } from "../viewmodel/ChatChannelViewModel";
import { asDisposable, IDisposable } from "./Disposable";
import { EL } from "./EL";
import { HTMLUtils } from "./HTMLUtils";
import { StringUtils } from "./StringUtils";

const ICON_SERVEROP = "\u{1F451}";  // crown emoji
const ICON_CHANOWNER = "\u{1F48E}";  // gem emoji
const ICON_CHANOP = "\u{1F396}\u{FE0F}";  // medal emoji
//const ICON_FRIEND = "\u{2764}\u{FE0F}";  // red heart emoji
const ICON_FRIEND = "\u{1F496}" // red sparkling heart emoji
const ICON_BOOKMARK = "\u{1F9E1}";  // orange heart emoji
const ICON_WATCHED = "\u{1F49B}";  // yellow heart emoji
const ICON_IGNORED = "\u{1F507}";  // muted speaker emoji

const CLASS_NAMEWRAPPER = "char-wrapper";
const CLASS_ISSERVEROP = "char-is-serverop";
const CLASS_ISCHANOWNER = "char-is-chanowner";
const CLASS_ISCHANOP = "char-is-chanop";
const CLASS_ISFRIEND = "char-is-friend";
const CLASS_ISBOOKMARK = "char-is-bookmark";
const CLASS_ISWATCH = "char-is-watch";
const CLASS_IGNORED = "char-is-ignored";

interface EffectiveCharacterNameInfo {
    modType: "none" | "chanop" | "chanowner" | "serverop";
    watchType: "none" | "watch" | "bookmark" | "friend";

    isServerOp: boolean;
    isChanOwner: boolean;
    isChanOp: boolean;
    isFriend: boolean;
    isBookmark: boolean;
    isWatch: boolean;
    isIgnored: boolean;

    wrapperClasses: { [any: string]: boolean };
    additionalWrapperClasses: string[];
    displayIcons: { title: string, iconText: string }[];

    nickname: string | null;
}

function getEffectiveCharacterNameInfo(character: CharacterName, vm: ChannelViewModel | ActiveLoginViewModel): EffectiveCharacterNameInfo {
    const res: EffectiveCharacterNameInfo = {
        modType: "none",
        watchType: "none",
        isServerOp: false,
        isChanOwner: false,
        isChanOp: false,
        isFriend: false,
        isBookmark: false,
        isWatch: false,
        isIgnored: false,
        wrapperClasses: {},
        additionalWrapperClasses: [],
        displayIcons: [],
        nickname: null
    };

    const chatChannelVM = (vm instanceof ChatChannelViewModel) ? vm : null;
    const sessionVM = (vm instanceof ChannelViewModel) ? vm.parent
        : (ActiveLoginViewModel.isInstance(vm)) ? vm
        : null;

    if (chatChannelVM && chatChannelVM.channelOps.has(character)) {
        res.modType = "chanop";
        res.isChanOp = true;
    }
    if (chatChannelVM && CharacterName.equals(chatChannelVM.channelOwner, character)) {
        res.modType = "chanowner";
        res.isChanOwner = true;
    }
    if (sessionVM && sessionVM.serverOps.has(character)) {
        res.modType = "serverop";
        res.isServerOp = true;
    }

    if (sessionVM && sessionVM.watchedChars.has(character)) {
        res.watchType = "watch";
        res.isWatch = true;
    }
    if (sessionVM && sessionVM.bookmarks.has(character)) {
        res.watchType = "bookmark";
        res.isBookmark = true;
    }
    if (sessionVM && sessionVM.friends.has(character)) {
        res.watchType = "friend";
        res.isFriend = true;
    }

    if (sessionVM && sessionVM.ignoredChars.has(character)) {
        res.isIgnored = true;
    }

    var wrapperClasses: { [any: string]: boolean } = {};
    wrapperClasses[CLASS_NAMEWRAPPER] = true;
    wrapperClasses[CLASS_ISSERVEROP] = res.isServerOp;
    wrapperClasses[CLASS_ISCHANOWNER] = res.isChanOwner;
    wrapperClasses[CLASS_ISCHANOP] = res.isChanOp;
    wrapperClasses[CLASS_ISFRIEND] = res.isFriend;
    wrapperClasses[CLASS_ISBOOKMARK] = res.isBookmark;
    wrapperClasses[CLASS_ISWATCH] = res.isWatch;
    wrapperClasses[CLASS_IGNORED] = res.isIgnored;
    res.wrapperClasses = wrapperClasses;

    switch (res.modType) {
        case "serverop":
            res.displayIcons.push({ title: "Server Op", iconText: ICON_SERVEROP });
            res.additionalWrapperClasses.push("is-serverop");
            break;
        case "chanowner":
            res.displayIcons.push({ title: "Channel Owner", iconText: ICON_CHANOWNER });
            res.additionalWrapperClasses.push("is-chanowner");
            break;
        case "chanop":
            res.displayIcons.push({ title: "Channel Moderator", iconText: ICON_CHANOP });
            res.additionalWrapperClasses.push("is-chanop");
            break;
        default:
            break;
    }
    switch (res.watchType) {
        case "friend":
            res.displayIcons.push({ title: "Friend", iconText: ICON_FRIEND });
            res.additionalWrapperClasses.push("is-friend");
            break;
        case "bookmark":
            res.displayIcons.push({ title: "Bookmark", iconText: ICON_BOOKMARK });
            res.additionalWrapperClasses.push("is-bookmark");
            break;
        case "watch":
            res.displayIcons.push({ title: "Watched", iconText: ICON_WATCHED });
            res.additionalWrapperClasses.push("is-watch");
            break;
        default:
            break;
    }
    if (res.isIgnored) {
        res.displayIcons.push({ title: "Ignored", iconText: ICON_IGNORED });
        res.additionalWrapperClasses.push("is-ignored");
    }

    if (sessionVM) {
        const nnsetting = sessionVM.getConfigSettingById("nickname", { characterName: character }) as (string | null | undefined);
        if (!StringUtils.isNullOrWhiteSpace(nnsetting)) {
            res.nickname = nnsetting;
        }
    }

    return res;
}

export function getEffectiveCharacterNameVNodes(character: CharacterName, vm: ChannelViewModel | ActiveLoginViewModel): JsxVNodeChildren {
    const nodes: JsxVNodeChild[] = [];

    var ecni = getEffectiveCharacterNameInfo(character, vm);

    const wrapperClasses = ecni.wrapperClasses;

    for (let icon of ecni.displayIcons) {
        nodes.push(<span title={icon.title}>{icon.iconText}</span>);
    }

    if (nodes.length > 0) {
        nodes.push(` ${character.value}`);
    }
    else {
        nodes.push(character.value);
    }

    if (ecni.nickname) {
        nodes.push(" ");
        nodes.push(<span classList={["nickname"]}>({ecni.nickname})</span>);
    }

    return <span class={wrapperClasses}>{nodes}</span>;
}

export function getEffectiveCharacterNameDocFragment(character: CharacterName, vm: ChannelViewModel | ActiveLoginViewModel): DocumentFragment {
    const result = new DocumentFragment();
    let hasIcon = false;

    const wrapperEl = EL("span");
    result.appendChild(wrapperEl);

    var ecni = getEffectiveCharacterNameInfo(character, vm);
    for (let x of Object.getOwnPropertyNames(ecni.wrapperClasses)) {
        wrapperEl.classList.toggle(x, ecni.wrapperClasses[x]);
    }

    for (let icon of ecni.displayIcons) {
        wrapperEl.appendChild(EL("SPAN", { title: icon.title }, [icon.iconText]));
        hasIcon = true;
    }

    if (hasIcon) {
        wrapperEl.appendChild(document.createTextNode(` ${character.value}`));
    }
    else {
        wrapperEl.appendChild(document.createTextNode(character.value));
    }

    if (ecni.nickname) {
        wrapperEl.appendChild(document.createTextNode(" "));
        wrapperEl.appendChild(EL("SPAN", { class: "nickname" }, [ `(${ecni.nickname})` ]));
    }

    return result;
}

export function getEffectiveCharacterName(character: CharacterName, vm: ChannelViewModel | ActiveLoginViewModel): string {
    const icons: string[] = [];

    const wrapperClasses: string[] = [];

    var ecni = getEffectiveCharacterNameInfo(character, vm);
    for (let x of Object.getOwnPropertyNames(ecni.wrapperClasses)) {
        if (ecni.wrapperClasses[x]) {
            wrapperClasses.push(x);
        }
    }

    for (let icon of ecni.displayIcons) {
        icons.push(`<span title='${icon.title}'>${icon.iconText}</span>`);
    }

    for (let addtlClass of ecni.additionalWrapperClasses) {
        wrapperClasses.push(addtlClass);
    }

    const nameStr = (icons.length > 0) ? ` ${character.value}` : character.value;
    let nnStr = "";
    if (ecni.nickname) {
        nnStr = ` <span class="nickname">(${HTMLUtils.escapeHTML(ecni.nickname)})</span>`;
    }

    return `<span class="${wrapperClasses.join(' ')}">${icons.join('')}${nameStr}${nnStr}</span>`;
}

export function getEffectiveCharacterNameWatcher(character: CharacterName, vm: ChannelViewModel | ActiveLoginViewModel, callback: (name: DocumentFragment) => void): IDisposable {
    
    let lastExposedName = "";
    const refresh = () => {
        const name = getEffectiveCharacterName(character, vm);
        if (name != lastExposedName) {
            lastExposedName = name;
            callback(getEffectiveCharacterNameDocFragment(character, vm));
        }
    };

    const disposables: IDisposable[] = [];

    const refreshOnName = (name: CharacterName) => {
        if (CharacterName.equals(name, character)) {
            refresh();
        }
    };
    const refreshOnNames = (names: CharacterName[]) => {
        for (let name of names) {
            if (CharacterName.equals(name, character)) {
                refresh();
            }
        }
    };

    if (vm instanceof ChatChannelViewModel) {
        const channelOpsListener = vm.addChannelOpsListener(refreshOnNames);
        disposables.push(channelOpsListener);

        const ownerChangeHandler = vm.addEventListener("propertychange", (pcev) => {
            if (pcev.propertyName == "channelOwner") {
                refresh();
            }
        });
        disposables.push(ownerChangeHandler);
    }
    if (vm instanceof ChannelViewModel) {
        const serverOpsListener = vm.parent.serverOps.addEventListener("dictionarychange", (dce) => { refreshOnName(dce.item); });
        disposables.push(serverOpsListener);

        const watchedCharsHandler = vm.parent.watchedChars.addEventListener("dictionarychange", (dce) => { refreshOnName(dce.item); });
        disposables.push(watchedCharsHandler);
    }
    else {
        const watchedCharsHandler = vm.watchedChars.addEventListener("dictionarychange", (dce) => { refreshOnName(dce.item); });
        disposables.push(watchedCharsHandler);
    }

    refresh();

    let disposed = false;
    return asDisposable(() => {
        if (!disposed) {
            disposed = true;
            for (let d of disposables) {
                try { d.dispose(); }
                catch { }
            }
        }
    });
}