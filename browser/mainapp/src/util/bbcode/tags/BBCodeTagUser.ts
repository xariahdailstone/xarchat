import { CharacterGenderConvert } from "../../../shared/CharacterGender";
import { CharacterName } from "../../../shared/CharacterName";
import { EL } from "../../EL";
import { StringUtils } from "../../StringUtils";
import { getContentText } from "../BBCode";
import { BBCodeTag } from "../BBCodeTag";

export const BBCodeTagUser = new BBCodeTag("user", true, false, (context, arg, content) => {
    const contentText = getContentText(content);
    const x = EL("span", { 
        class: "bbcode-user", 
        "data-target": getContentText(content),
        "data-copycontent": `${content.rawOpenTag}${contentText}${content.rawCloseTag}`
    }, [ 
        EL("div", {
            class: "bbcode-user-icon",
            "data-copycontent": ""
        }),
        contentText 
    ]);
    if (context.parseOptions.appViewModel != null && context.parseOptions.activeLoginViewModel != null) {
        const avm = context.parseOptions.appViewModel;
        const shouldColorize = StringUtils.toBoolean(avm.configBlock.get("bbcode.colorizeUserLinksByGender")?.toString(), true);
        if (shouldColorize) {
            const lvm = context.parseOptions.activeLoginViewModel;
            const cs = lvm.characterSet.getCharacterStatus(CharacterName.create(contentText));
            const genderStr = CharacterGenderConvert.toString(cs.gender).toLowerCase();
            x.classList.add(`gender-${genderStr}`);
        }
    }
    if (context.parseOptions.sink?.userClick) {
        x.addEventListener("click", (ev) => {
            context.parseOptions.sink!.userClick.call(context.parseOptions.sink!, CharacterName.create(contentText), {
                rightClick: false,
                channelContext: context.parseOptions.channelViewModel,
                targetElement: x
            });
            ev.preventDefault();
            return false;
        });
        x.addEventListener("contextmenu", (ev) => {
            context.parseOptions.sink!.userClick.call(context.parseOptions.sink!, CharacterName.create(contentText), {
                rightClick: true,
                channelContext: context.parseOptions.channelViewModel,
                targetElement: x
            });
            ev.preventDefault();
            return false;
        });
    }
    return x;
});