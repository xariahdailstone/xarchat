import { asDisposable } from "../util/Disposable";
import { BBCodeParseResult } from "../util/bbcode/BBCode";
import { ComponentBase, componentElement } from "./ComponentBase";

@componentElement("x-bbcodedisplay")
export class BBCodeDisplay extends ComponentBase<BBCodeParseResult> {
    constructor() {
        super();

        this.whenConnectedWithViewModel((vm) => {
            this.elMain.appendChild(vm.element);
            return asDisposable(() => {
                this.elMain.removeChild(vm.element);
            })
        });
    }
}