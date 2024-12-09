import { CharacterName } from "../shared/CharacterName";
import { ActiveLoginViewModel } from "../viewmodel/ActiveLoginViewModel";
import { AppViewModel } from "../viewmodel/AppViewModel";
import { ChannelViewModel } from "../viewmodel/ChannelViewModel";
import { CharacterDetailPopupViewModel } from "../viewmodel/popups/CharacterDetailPopupViewModel";
import { IDisposable, asDisposable } from "./Disposable";
import { EventListenerUtil } from "./EventListenerUtil";

export class CharacterLinkUtils {
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