import { On, Props, VNode, VNodeData } from "../../snabbdom/index";
import { StringUtils } from "../StringUtils";

function ensureData(vnode: VNode): VNodeData {
    if (!vnode.data) {
        vnode.data = {};
    }
    return vnode.data;
}
function ensureOn(vnode: VNode): On {
    const data = ensureData(vnode);
    if (!data.on) {
        data.on = {};
    }
    return data.on;
}
function ensureProps(vnode: VNode): Props {
    const data = ensureData(vnode);
    if (!data.props) {
        data.props = {};
    }
    return data.props;
}

export class VNodeTextInputBinding {
    static bind(vnode: VNode, currentModelValue: string, assignFunc: (str: string) => void) {
        const vnodeOn = ensureOn(vnode);
        const vnodeProps = ensureProps(vnode);

        const onChange = (e: Event) => {
            const target = e.target as HTMLInputElement;
            const elValue = target.value;
            if (elValue != currentModelValue) {
                assignFunc(elValue);
            }
        };

        vnodeOn["input"] = onChange;
        vnodeOn["change"] = onChange;
        vnodeProps["value"] = currentModelValue;
    }
}

export class VNodeDateTimeInputBinding {
    static bind(vnode: VNode, currentModelValue: (Date | null), assignFunc: (v: (Date | null)) => void) {
        const vnodeOn = ensureOn(vnode);
        const vnodeProps = ensureProps(vnode);

        const onChange = (e: Event) => {
            const target = e.target as HTMLInputElement;
            const elValue = (target.value != null && target.value != "")
                ? new Date(Date.parse(target.value))
                : null;
            if (elValue != currentModelValue) {
                //console.log("SET dtStr", elValue, target.value);
                assignFunc(elValue);
            }
        };

        vnodeOn["input"] = onChange;
        vnodeOn["change"] = onChange;
        const dtStr = currentModelValue
            ? (currentModelValue.getFullYear().toString() + "-"
                + StringUtils.leftPad((currentModelValue.getMonth() + 1).toString(), "0", 2) + "-"
                + StringUtils.leftPad(currentModelValue.getDate().toString(), "0", 2) + "T"
                + StringUtils.leftPad(currentModelValue.getHours().toString(), "0", 2) + ":" 
                + StringUtils.leftPad(currentModelValue.getMinutes().toString(), "0", 2) + ":" 
                + StringUtils.leftPad(currentModelValue.getSeconds().toString(), "0", 2))
            : null;
        //console.log("dtStr", dtStr, currentModelValue);
        vnodeProps["value"] = dtStr;
    }
}