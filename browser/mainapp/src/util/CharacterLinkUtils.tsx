import { CharacterGenderConvert } from "../shared/CharacterGender";
import { CharacterName } from "../shared/CharacterName";
import { CharacterStatus, CharacterStatusNoEquals, CharacterSubSet } from "../shared/CharacterSet";
import { h, jsx, VNode } from "../snabbdom/index";
import { ActiveLoginViewModel } from "../viewmodel/ActiveLoginViewModel";
import { AppViewModel } from "../viewmodel/AppViewModel";
import { ChannelViewModel, IChannelStreamViewModel } from "../viewmodel/ChannelViewModel";
import { ChatChannelViewModel } from "../viewmodel/ChatChannelViewModel";
import { CharacterDetailPopupViewModel } from "../viewmodel/popups/CharacterDetailPopupViewModel";
import { CallbackSet } from "./CallbackSet";
import { CharacterLinkIconType, EffectiveCharacterNameInfo, EffectiveCharacterNameInfoProvider, getEffectiveCharacterNameInfo, getEffectiveCharacterNameVNodes, getEffectiveCharacterNameVNodes2 } from "./CharacterNameIcons";
import { ConvertibleToDisposable, IDisposable, asDisposable } from "./Disposable";
import { EventListenerUtil } from "./EventListenerUtil";
import { ObjectUniqueId } from "./ObjectUniqueId";
import { Observable, PropertyChangeEvent, PropertyChangeEventListener } from "./Observable";

export interface CharacterLinkOptions {
    disallowLeftClick?: boolean;
    suppressIcons?: CharacterLinkIconType[];
}

export class CharacterLinkUtils {
    static createStaticCharacterLinkVNode(
        sess: ActiveLoginViewModel, char: CharacterName, csi: CharacterStatusNoEquals, channelContext?: IChannelStreamViewModel | null,
        options?: CharacterLinkOptions): VNode {

        const ecni = getEffectiveCharacterNameInfo(csi, channelContext ?? sess);
        return CharacterLinkUtils.createStaticCharacterLinkVNode2(sess, char, csi, channelContext ?? null, ecni, options);
    }

    static createStaticCharacterLinkVNode2(
        sess: ActiveLoginViewModel, char: CharacterName, csi: CharacterStatusNoEquals, channelContext: IChannelStreamViewModel | null,
        ecni: EffectiveCharacterNameInfo,
        options?: CharacterLinkOptions): VNode {

        const vnode = <span classList={[ "character-link", `gender-${CharacterGenderConvert.toString(csi.gender)}` ]}
            on={{
                "click": (ev: MouseEvent) => {
                    const disallowLeftClick = (options?.disallowLeftClick ?? false);
                    if (!ev.defaultPrevented && !disallowLeftClick) {
                        sess.bbcodeSink.userClick(char, { rightClick: false, channelContext: channelContext, targetElement: vnode.elm as HTMLElement });
                        ev.preventDefault();
                        return false;
                    }
                },
                "contextmenu": (ev: MouseEvent) => {
                    if (!ev.defaultPrevented) {
                        sess.bbcodeSink.userClick(char, { rightClick: true, channelContext: channelContext, targetElement: vnode.elm as HTMLElement });
                        ev.preventDefault();
                        return false;
                    }
                }
            }}>{getEffectiveCharacterNameVNodes2(char, ecni, options)}</span>;
        return vnode;
    }

    static createCharacterLinkVNode(sess: ActiveLoginViewModel, char: CharacterName, channelContext?: ChannelViewModel | null): VNode {
        const csi = sess.characterSet.getCharacterStatus(char);
        return CharacterLinkUtils.createStaticCharacterLinkVNode(sess, char, csi, channelContext);
    }

    static setupCharacterLink(el: HTMLElement, sess: ActiveLoginViewModel, char: CharacterName, channelContext: ChannelViewModel | null): IDisposable {
        el.classList.add("character-link");
        const clickListener = EventListenerUtil.addDisposableEventListener(el, "click", (ev: MouseEvent) => {
            if (!ev.defaultPrevented) {
                sess.bbcodeSink.userClick(char, { rightClick: false, channelContext: channelContext, targetElement: el });
                ev.preventDefault();
                return false;
            }
        });
        const contextMenuListener = EventListenerUtil.addDisposableEventListener(el, "contextmenu", (ev: MouseEvent) => {
            if (!ev.defaultPrevented) {
                sess.bbcodeSink.userClick(char, { rightClick: true, channelContext: channelContext, targetElement: el });
                ev.preventDefault();
                return false;
            }
        });

        return asDisposable(clickListener, contextMenuListener);
    }
}

export class MassCharacterLinkManager implements IDisposable, Observable {
    constructor(
        private readonly session: ActiveLoginViewModel,
        private readonly channel?: ChatChannelViewModel) {

        Observable.publishRead(this, "value", false);

        this._ccs = session.characterSet.createSubSet([]);
        this._ccs.addStatusUpdateListener(cs => {
            this.triggerUpdateFor(cs.characterName);
        });
        this._onDisposeActions.push(() => {
            this._ccs.dispose();
        });

        if (channel) {
            channel.addChannelOpsListener((chars) => {
                for (let char of chars) {
                    this.triggerUpdateFor(char);
                }
            });
        }
        this._onDisposeActions.push(
            session.serverOps.addCollectionObserver(entries => {
                for (let entry of entries) {
                    this.triggerUpdateFor(entry.item.key);
                }
            }));
        this._onDisposeActions.push(
            session.watchedChars.addCollectionObserver(entries => {
                for (let entry of entries) {
                    this.triggerUpdateFor(entry.item.key);
                }
            }));
        this._onDisposeActions.push(
            session.bookmarks.addCollectionObserver(entries => {
                for (let entry of entries) {
                    this.triggerUpdateFor(entry.item.key);
                }
            }));
        this._onDisposeActions.push(
            session.friends.addCollectionObserver(entries => {
                for (let entry of entries) {
                    this.triggerUpdateFor(entry.item.key);
                }
            }));
        this._onDisposeActions.push(
            session.ignoredChars.addCollectionObserver(entries => {
                for (let entry of entries) {
                    this.triggerUpdateFor(entry.item.key);
                }
            }));
        this._onDisposeActions.push(
            session.nicknameSet.addEventListener("propertychange", (e) => {
                this.triggerUpdateFor(CharacterName.create(e.propertyName));
            }));
    }

    private _onDisposeActions: ConvertibleToDisposable[] = [];
    private _isDisposed: boolean = false;

    get isDisposed(): boolean { return this._isDisposed; }

    dispose(): void {
        if (!this._isDisposed) {
            this._isDisposed = true;
            asDisposable(...this._onDisposeActions).dispose();
            this._onDisposeActions = [];
            this._chars.clear();
        }
    }

    [Symbol.dispose](): void {
        this.dispose();
    }

    private triggerUpdateFor(char: CharacterName) {
        if (!this._isDisposed && this._chars.has(char)) {
            this.dispose();
            this.raisePropertyChangeEvent("value", true);
        }
    }

    private readonly _ccs: CharacterSubSet;

    private _cbSet: CallbackSet<PropertyChangeEventListener> = new CallbackSet("MassCharacterLinkManager");

    addEventListener(eventName: "propertychange", handler: PropertyChangeEventListener): IDisposable {
        return this._cbSet.add(handler);
    }
    removeEventListener(eventName: "propertychange", handler: PropertyChangeEventListener): void {
        this._cbSet.delete(handler);
    }
    raisePropertyChangeEvent(propertyName: string, propValue: unknown): void {
        this._cbSet.invoke(new PropertyChangeEvent(propertyName, propValue));
    }

    private _chars: Set<CharacterName> = new Set();

    getCharacterLinkVNodes(cs: CharacterStatusNoEquals) {
        this._chars.add(cs.characterName);
        this._ccs.rawAddChar(cs.characterName);
        const result = CharacterLinkUtils.createStaticCharacterLinkVNode2(
            this.session, cs.characterName, cs, this.channel ?? null, getEffectiveCharacterNameInfo(cs, this.channel ?? this.session, true));
        return result;
    }
}