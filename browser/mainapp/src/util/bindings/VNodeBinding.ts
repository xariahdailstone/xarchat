import { VNode } from "../../snabbdom/index";

export class VNodeTextInputBinding {
    static bind(vnode: VNode, currentModelValue: string, assignFunc: (str: string) => void) {
        if (!vnode.data) {
            vnode.data = {};
        }
        if (!vnode.data.on) {
            vnode.data.on = {};
        }
        if (!vnode.data.props) {
            vnode.data.props = {};
        }

        const onChange = (e: Event) => {
            const target = e.target as HTMLInputElement;
            const elValue = target.value;
            if (elValue != currentModelValue) {
                assignFunc(elValue);
            }
        };

        vnode.data.on["input"] = onChange;
        vnode.data.on["change"] = onChange;
        vnode.data.props["value"] = currentModelValue;
    }
}