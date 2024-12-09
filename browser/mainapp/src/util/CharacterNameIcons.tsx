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

interface EffectiveCharacterNameInfo {
    modType: "none" | "chanop" | "chanowner" | "serverop";
    watchType: "none" | "watch" | "bookmark" | "friend";
}

function getEffectiveCharacterNameInfo(character: CharacterName, vm: ChannelViewModel | ActiveLoginViewModel): EffectiveCharacterNameInfo {
    const res: EffectiveCharacterNameInfo = {
        modType: "none",
        watchType: "none"
    };

    const chatChannelVM = (vm instanceof ChatChannelViewModel) ? vm : null;
    const sessionVM = (vm instanceof ChannelViewModel) ? vm.parent
        : (vm instanceof ActiveLoginViewModel) ? vm
        : null;

    if (sessionVM && sessionVM.serverOps.has(character)) {
        res.modType = "serverop";
    }
    else if (chatChannelVM && CharacterName.equals(chatChannelVM.channelOwner, character)) {
        res.modType = "chanowner";
    }
    else if (chatChannelVM && chatChannelVM.channelOps.has(character)) {
        res.modType = "chanop";
    }

    if (sessionVM && sessionVM.friends.has(character)) {
        res.watchType = "friend";
    }
    else if (sessionVM && sessionVM.bookmarks.has(character)) {
        res.watchType = "bookmark";
    }
    else if (sessionVM && sessionVM.watchedChars.has(character)) {
        res.watchType = "watch";
    }

    return res;
}

export function getEffectiveCharacterNameVNodes(character: CharacterName, vm: ChannelViewModel | ActiveLoginViewModel): JsxVNodeChildren {
    const nodes: JsxVNodeChild[] = [];

    var ecni = getEffectiveCharacterNameInfo(character, vm);

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

    return nodes;
}

export function getEffectiveCharacterNameDocFragment(character: CharacterName, vm: ChannelViewModel | ActiveLoginViewModel): DocumentFragment {
    const result = new DocumentFragment();
    let hasIcon = false;

    var ecni = getEffectiveCharacterNameInfo(character, vm);
    switch (ecni.modType) {
        case "serverop":
            result.appendChild(EL("span", { title: "Server Op" }, [ICON_SERVEROP]));
            hasIcon = true;
            break;
        case "chanowner":
            result.appendChild(EL("span", { title: "Channel Owner" }, [ICON_CHANOWNER]));
            hasIcon = true;
            break;
        case "chanop":
            result.appendChild(EL("span", { title: "Channel Moderator" }, [ICON_CHANOP]));
            hasIcon = true;
            break;
        default:
            break;
    }
    switch (ecni.watchType) {
        case "friend":
            result.appendChild(EL("span", { title: "Friend" }, [ICON_FRIEND]));
            hasIcon = true;
            break;
        case "bookmark":
            result.appendChild(EL("span", { title: "Bookmark" }, [ICON_BOOKMARK]));
            hasIcon = true;
            break;
        case "watch":
            result.appendChild(EL("span", { title: "Watche" }, [ICON_WATCHED]));
            hasIcon = true;
            break;
        default:
            break;
    }

    if (hasIcon) {
        result.appendChild(document.createTextNode(` ${character.value}`));
    }
    else {
        result.appendChild(document.createTextNode(character.value));
    }

    return result;
}

export function getEffectiveCharacterName(character: CharacterName, vm: ChannelViewModel | ActiveLoginViewModel): string {
    const icons: string[] = [];

    var ecni = getEffectiveCharacterNameInfo(character, vm);
    switch (ecni.modType) {
        case "serverop":
            icons.push(`<span title='Server Op'>${ICON_SERVEROP}</span>`);
            break;
        case "chanowner":
            icons.push(`<span title='Channel Owner'>${ICON_CHANOWNER}</span>`);
            break;
        case "chanop":
            icons.push(`<span title='Channel Moderator'>${ICON_CHANOP}</span>`);
            break;
        default:
            break;
    }
    switch (ecni.watchType) {
        case "friend":
            icons.push(`<span title='Friend'>${ICON_FRIEND}</span>`);
            break;
        case "bookmark":
            icons.push(`<span title='Bookmark'>${ICON_BOOKMARK}</span>`);
            break;
        case "watch":
            icons.push(`<span title='Watched'>${ICON_WATCHED}</span>`);
            break;
        default:
            break;
    }

    if (icons.length > 0) {
        return `${icons.join('')} ${character.value}`;
    }
    else {
        return character.value;
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