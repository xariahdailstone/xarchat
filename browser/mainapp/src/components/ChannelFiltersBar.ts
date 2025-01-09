import { HTMLUtils } from "../util/HTMLUtils";
import { ComponentBase, componentElement } from "./ComponentBase";

@componentElement("x-channelfiltersbar")
export class ChannelFiltersBar extends ComponentBase<object> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <div class="filtericon"><x-iconimage id="elFilterIcon" src="assets/ui/filter-icon.svg"></x-iconimage></div>
            <div class="filtertabscontainer">
                <div class="filtertab selected">All</div>
                <div class="filtertab">Chat</div>
                <div class="filtertab">Ads</div>
                <div class="filtertab">My Custom Filter</div>
            </div>
            <div class="editbutton">
                <div class="filtertab"><x-iconimage id="elEditIcon" src="assets/ui/edit.svg"></x-iconimage></div>
            </div>
        `);
    }
}