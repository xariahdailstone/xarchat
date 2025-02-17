import { CharacterName } from "../../../shared/CharacterName";
import { EL } from "../../EL";
import { EventListenerUtil } from "../../EventListenerUtil";
import { getContentText } from "../BBCode";
import { BBCodeTag } from "../BBCodeTag";

export const BBCodeTagIcon = new BBCodeTag("icon", true, false, 
    (context, arg, content) => {
        const contentText = getContentText(content);

        if (content.rawCloseTag == "") {
            return document.createTextNode(content.rawOpenTag + contentText);
        }
        
        const el = EL("span", { class: "bbcode-icon", href: `http://www.f-list.net/c/${encodeURIComponent(contentText)}` }, [
            EL("img", { 
                title: contentText, 
                src: `https://static.f-list.net/images/avatar/${encodeURIComponent(contentText.toLowerCase())}.png`,
                "data-copycontent": `${content.rawOpenTag}${contentText}${content.rawCloseTag}`
            })
        ]);

        if (context.parseOptions.sink?.userClick) {
            el.addEventListener("click", (ev) => {
                const rightClick = ev.button == 2;
                context.parseOptions.sink!.userClick.call(context.parseOptions.sink!, CharacterName.create(contentText), {
                    rightClick: rightClick,
                    channelContext: context.parseOptions.channelViewModel,
                    targetElement: el
                });
            });
        }

        return el;
    });