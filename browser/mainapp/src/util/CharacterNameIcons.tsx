import { CharacterName } from "../shared/CharacterName";
import { jsx, JsxVNodeChild, JsxVNodeChildren, VNode } from "../snabbdom/index.js";
import { ActiveLoginViewModel } from "../viewmodel/ActiveLoginViewModel";
import { ChannelViewModel } from "../viewmodel/ChannelViewModel";
import { ChatChannelViewModel } from "../viewmodel/ChatChannelViewModel";
import { asDisposable, IDisposable } from "./Disposable";
import { EL } from "./EL";

const ICON_SERVEROP = "\u{1F451}";  // crown emoji
const ICON_CHANOWNER = "\u{1F48E}";  // gem emoji
const ICON_CHANOP = "\u{1F396}\u{FE0F}";  // medal emoji
//const ICON_FRIEND = "\u{2764}\u{FE0F}";  // red heart emoji
const ICON_FRIEND = "\u{1F496}" // red sparkling heart emoji
const ICON_BOOKMARK = "\u{1F9E1}";  // orange heart emoji
const ICON_WATCHED = "\u{1F49B}";  // yellow heart emoji

const CLASS_NAMEWRAPPER = "char-wrapper";
const CLASS_ISSERVEROP = "char-is-serverop";
const CLASS_ISCHANOWNER = "char-is-chanowner";
const CLASS_ISCHANOP = "char-is-chanop";
const CLASS_ISFRIEND = "char-is-friend";
const CLASS_ISBOOKMARK = "char-is-bookmark";
const CLASS_ISWATCH = "char-is-watch";

interface EffectiveCharacterNameInfo {
    modType: "none" | "chanop" | "chanowner" | "serverop";
    watchType: "none" | "watch" | "bookmark" | "friend";

    isServerOp: boolean;
    isChanOwner: boolean;
    isChanOp: boolean;
    isFriend: boolean;
    isBookmark: boolean;
    isWatch: boolean;
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
        isWatch: false
    };

    const chatChannelVM = (vm instanceof ChatChannelViewModel) ? vm : null;
    const sessionVM = (vm instanceof ChannelViewModel) ? vm.parent
        : (vm instanceof ActiveLoginViewModel) ? vm
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

    return res;
}

export function getEffectiveCharacterNameVNodes(character: CharacterName, vm: ChannelViewModel | ActiveLoginViewModel): JsxVNodeChildren {
    const nodes: JsxVNodeChild[] = [];

    var ecni = getEffectiveCharacterNameInfo(character, vm);
    var wrapperClasses: { [any: string]: boolean } = {};
    wrapperClasses[CLASS_NAMEWRAPPER] = true;
    wrapperClasses[CLASS_ISSERVEROP] = ecni.isServerOp;
    wrapperClasses[CLASS_ISCHANOWNER] = ecni.isChanOwner;
    wrapperClasses[CLASS_ISCHANOP] = ecni.isChanOp;
    wrapperClasses[CLASS_ISFRIEND] = ecni.isFriend;
    wrapperClasses[CLASS_ISBOOKMARK] = ecni.isBookmark;
    wrapperClasses[CLASS_ISWATCH] = ecni.isWatch;

    switch (ecni.modType) {
        case "serverop":
            nodes.push(<span title='Server Op'>{ICON_SERVEROP}</span>);
            break;
        case "chanowner":
            nodes.push(<span title='Channel Owner'>{ICON_CHANOWNER}</span>);
            break;
        case "chanop":
            nodes.push(<span title='Channel Moderator'>{ICON_CHANOP}</span>);
            break;
        default:
            break;
    }
    switch (ecni.watchType) {
        case "friend":
            nodes.push(<span title='Friend'>{ICON_FRIEND}</span>);
            break;
        case "bookmark":
            nodes.push(<span title='Bookmark'>{ICON_BOOKMARK}</span>);
            break;
        case "watch":
            nodes.push(<span title='Watched'>{ICON_WATCHED}</span>);
            break;
        default:
            break;
    }
    if (nodes.length > 0) {
        nodes.push(` ${character.value}`);
    }
    else {
        nodes.push(character.value);
    }

    return <span class={wrapperClasses}>{nodes}</span>;
}

export function getEffectiveCharacterNameDocFragment(character: CharacterName, vm: ChannelViewModel | ActiveLoginViewModel): DocumentFragment {
    const result = new DocumentFragment();
    let hasIcon = false;

    const wrapperEl = EL("span");
    result.appendChild(wrapperEl);

    var ecni = getEffectiveCharacterNameInfo(character, vm);
    wrapperEl.classList.toggle(CLASS_NAMEWRAPPER, true);
    wrapperEl.classList.toggle(CLASS_ISSERVEROP, ecni.isServerOp);
    wrapperEl.classList.toggle(CLASS_ISCHANOWNER, ecni.isChanOwner);
    wrapperEl.classList.toggle(CLASS_ISCHANOP, ecni.isChanOp);
    wrapperEl.classList.toggle(CLASS_ISFRIEND, ecni.isFriend);
    wrapperEl.classList.toggle(CLASS_ISBOOKMARK, ecni.isBookmark);
    wrapperEl.classList.toggle(CLASS_ISWATCH, ecni.isWatch);

    switch (ecni.modType) {
        case "serverop":
            wrapperEl.appendChild(EL("span", { title: "Server Op" }, [ICON_SERVEROP]));
            hasIcon = true;
            break;
        case "chanowner":
            wrapperEl.appendChild(EL("span", { title: "Channel Owner" }, [ICON_CHANOWNER]));
            hasIcon = true;
            break;
        case "chanop":
            wrapperEl.appendChild(EL("span", { title: "Channel Moderator" }, [ICON_CHANOP]));
            hasIcon = true;
            break;
        default:
            break;
    }
    switch (ecni.watchType) {
        case "friend":
            wrapperEl.appendChild(EL("span", { title: "Friend" }, [ICON_FRIEND]));
            hasIcon = true;
            break;
        case "bookmark":
            wrapperEl.appendChild(EL("span", { title: "Bookmark" }, [ICON_BOOKMARK]));
            hasIcon = true;
            break;
        case "watch":
            wrapperEl.appendChild(EL("span", { title: "Watched" }, [ICON_WATCHED]));
            hasIcon = true;
            break;
        default:
            break;
    }

    if (hasIcon) {
        wrapperEl.appendChild(document.createTextNode(` ${character.value}`));
    }
    else {
        wrapperEl.appendChild(document.createTextNode(character.value));
    }

    return result;
}

export function getEffectiveCharacterName(character: CharacterName, vm: ChannelViewModel | ActiveLoginViewModel): string {
    const icons: string[] = [];

    const wrapperClasses: string[] = [];

    var ecni = getEffectiveCharacterNameInfo(character, vm);
    wrapperClasses.push(CLASS_NAMEWRAPPER);
    if (ecni.isServerOp) { wrapperClasses.push(CLASS_ISSERVEROP); }
    if (ecni.isChanOwner) { wrapperClasses.push(CLASS_ISCHANOWNER); }
    if (ecni.isChanOp) { wrapperClasses.push(CLASS_ISCHANOP); }
    if (ecni.isFriend) { wrapperClasses.push(CLASS_ISFRIEND); }
    if (ecni.isBookmark) { wrapperClasses.push(CLASS_ISBOOKMARK); }
    if (ecni.isWatch) { wrapperClasses.push(CLASS_ISWATCH); }

    switch (ecni.modType) {
        case "serverop":
            icons.push(`<span title='Server Op'>${ICON_SERVEROP}</span>`);
            wrapperClasses.push("is-serverop");
            break;
        case "chanowner":
            icons.push(`<span title='Channel Owner'>${ICON_CHANOWNER}</span>`);
            wrapperClasses.push("is-chanowner");
            break;
        case "chanop":
            icons.push(`<span title='Channel Moderator'>${ICON_CHANOP}</span>`);
            wrapperClasses.push("is-chanop");
            break;
        default:
            break;
    }
    switch (ecni.watchType) {
        case "friend":
            icons.push(`<span title='Friend'>${ICON_FRIEND}</span>`);
            wrapperClasses.push("is-friend");
            break;
        case "bookmark":
            icons.push(`<span title='Bookmark'>${ICON_BOOKMARK}</span>`);
            wrapperClasses.push("is-bookmark");
            break;
        case "watch":
            icons.push(`<span title='Watched'>${ICON_WATCHED}</span>`);
            wrapperClasses.push("is-watch");
            break;
        default:
            break;
    }

    if (icons.length > 0) {
        return `<span class="${wrapperClasses.join(' ')}">${icons.join('')} ${character.value}</span>`;
    }
    else {
        return `<span class="${wrapperClasses.join(' ')}">${character.value}</span>`;
    }
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