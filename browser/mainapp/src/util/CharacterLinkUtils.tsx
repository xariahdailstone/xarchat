import { CharacterGenderConvert } from "../shared/CharacterGender";
import { CharacterName } from "../shared/CharacterName";
import { CharacterStatus } from "../shared/CharacterSet";
import { jsx, VNode } from "../snabbdom/index";
import { ActiveLoginViewModel } from "../viewmodel/ActiveLoginViewModel";
import { AppViewModel } from "../viewmodel/AppViewModel";
import { ChannelViewModel } from "../viewmodel/ChannelViewModel";
import { CharacterDetailPopupViewModel } from "../viewmodel/popups/CharacterDetailPopupViewModel";
import { getEffectiveCharacterNameVNodes } from "./CharacterNameIcons";
import { IDisposable, asDisposable } from "./Disposable";
import { EventListenerUtil } from "./EventListenerUtil";

export class CharacterLinkUtils {
    static createStaticCharacterLinkVNode(sess: ActiveLoginViewModel, char: CharacterName, csi: CharacterStatus, channelContext?: ChannelViewModel | null): VNode {
        const vnode = <span classList={[ "character-link", `gender-${CharacterGenderConvert.toString(csi.gender)}` ]}
            on={{
                "click": (ev: MouseEvent) => {
                    if (!ev.defaultPrevented) {
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
            }}>{getEffectiveCharacterNameVNodes(char, sess)}</span>;
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