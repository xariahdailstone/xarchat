import { HTMLUtils } from "../util/HTMLUtils";
import { ComponentBase, componentElement } from "./ComponentBase";

@componentElement("x-lastseenindicator")
class LastSeenIndicator extends ComponentBase<any> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <div class="sep-line"></div>
            <div class="new-text">NEW</div>
        `);

        this.whenConnected(() => {

        });
    }
}