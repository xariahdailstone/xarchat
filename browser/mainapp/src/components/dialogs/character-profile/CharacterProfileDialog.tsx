import { KinkList, KinkListGroupListItem, MappingList, ProfileFieldsInfoList, ProfileFieldsSectionListItem, ProfileInfo } from "../../../fchat/api/FListApi";
import { CharacterName } from "../../../shared/CharacterName";
import { BBCodeParser, ChatBBCodeParser } from "../../../util/bbcode/BBCode";
import { CancellationToken } from "../../../util/CancellationTokenSource";
import { CompatibilityCalculator } from "../../../util/CompatibilityCalculator";
//import { CompatibilityCalculator, Profile, RichKinkList } from "../../../util/CompatibilityCalculator";
import { IDisposable } from "../../../util/Disposable";
import { EL } from "../../../util/EL";
import { Optional } from "../../../util/Optional";
import { Profile } from "../../../util/profile/Profile";
import { RichInfoTagDefListImpl } from "../../../util/profile/RichInfoTagDefList";
import { RichKinkList } from "../../../util/profile/RichKinkList";
import { RichMappingDefImpl } from "../../../util/profile/RichMappingDef";
import { CharacterProfileDialogViewModel } from "..././../viewmodel/dialogs/character-profile/CharacterProfileDialogViewModel";
import { EditMemoViewModel } from "../../../viewmodel/dialogs/EditMemoViewModel";
import { CollectionViewLightweight } from "../../CollectionViewLightweight";
import { componentArea, componentElement } from "../../ComponentBase";
import { IconImage } from "../../IconImage";
import { DialogBorderType, DialogComponentBase, DialogFrame, dialogViewFor } from "../DialogFrame";
import { Fragment, init, styleModule, toVNode, propsModule, eventListenersModule } from "../../../snabbdom/index.js";
import { observableProperty } from "../../../util/ObservableBase";
import { getEffectiveCharacterName } from "../../../util/CharacterNameIcons";
import { HTMLUtils } from "../../../util/HTMLUtils";

@componentArea("dialogs/character-profile")
@componentElement("x-characterprofiledialog")
@dialogViewFor(CharacterProfileDialogViewModel)
export class CharacterProfileDialog extends DialogComponentBase<CharacterProfileDialogViewModel> {
    constructor() {
        super();
        HTMLUtils.assignStaticHTMLFragment(this.elMain, '<x-characterprofiledialoginner></x-characterprofiledialoginner>');
    }

    override get dialogBorderType(): DialogBorderType { return DialogBorderType.RIGHTPANE; }
}

