import { CharacterGenderConvert } from "../../../shared/CharacterGender";
import { CharacterName } from "../../../shared/CharacterName";
import { ContextMenuUtils } from "../../ContextMenuUtils";
import { EL } from "../../EL";
import { StringUtils } from "../../StringUtils";
import { getContentText } from "../BBCode";
import { BBCodeTag } from "../BBCodeTag";

export const BBCodeTagUser = new BBCodeTag("user", true, false, (context, arg, content) => {
    const origContentText = getContentText(content);
    let contentText = origContentText.trim();
    
    if (content.rawCloseTag == "") {
        return document.createTextNode(content.rawOpenTag + contentText);
    }

    let nickname: (string | null) = null;
    if (context.parseOptions.activeLoginViewModel && CharacterName.isValidCharacterName(contentText.trim())) {
        const alvm = context.parseOptions.activeLoginViewModel;
        const xnn = alvm.getConfigSettingById("nickname", { characterName: CharacterName.create(contentText.trim())}) as (string | null | undefined);
        if (xnn) {
            contentText = contentText.trim();
            nickname = xnn;
        }
    }

    const x = EL("span", { 
        class: "bbcode-user", 
        "data-target": contentText,
        "data-copycontent": `${content.rawOpenTag}${origContentText}${content.rawCloseTag}`
    }, [ 
        EL("div", {
            class: "bbcode-user-icon",
            "data-copycontent": ""
        }),
        origContentText,
        nickname ? " " : null,
        nickname ? EL("span", { class: "nickname" }, [ `(${nickname})` ]) : null
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
            ContextMenuUtils.preventDefault(ev);
            return false;
        });
    }
    return x;
});