
import { jsx, VNode, Fragment, Attrs, On, VNodeData } from "../snabbdom/index"

export class VNodeUtils {
    static createEmptyFragment(): VNode {
        // XXX: Pending fix for https://github.com/snabbdom/snabbdom/issues/1135
        //return <></>;
        return <x-emptyfragment style={{ "display": "none" }}></x-emptyfragment>
    }

    static clone(origNode: VNode): VNode {
        const result = {...origNode};
        if (result.children) {
            for (let i = 0; i < result.children?.length; i++) {
                const titem = result.children[i];
                if (typeof titem != "string") {
                    result.children[i] = this.clone(titem);
                }
            }
        }
        return result;
    }

    static fromHTML(htmlStr: string): VNode {
        const tmpl = document.createElement("template");
        tmpl.innerHTML = htmlStr;
        
        const nodeToVNode = (n: Node) => {
            switch (n.nodeType) {
                case Node.TEXT_NODE:
                    return n.textContent;
                case Node.ELEMENT_NODE:
                    return elementToVNode(n as Element);
                default:
                    return null;
            }
        };
        const elementToVNode = (n: Element) => {
            const data: VNodeData = {};
            const attrs: Attrs = {};
            data.attrs = attrs;
            const ons: On = {};
            data.ons = ons;
            for (let attrName of n.getAttributeNames()) {
                if (attrName.startsWith("on")) {
                    const evtName = attrName.substring(2);
                    const evtBody = n.getAttribute(attrName) ?? "";
                    ons[evtName] = (event) => {
                        return eval(evtBody);
                    };
                }
                else {
                    attrs[attrName] = n.getAttribute(attrName) ?? true;
                }
            }
            const result = jsx(n.tagName, attrs, childNodesToVNodes(n));
            return result;
        };
        const childNodesToVNodes = (n: Node) => {
            const results: (VNode | string | null)[] = [];
            for (let i = 0; i < n.childNodes.length; i++) {
                const cnode = n.childNodes.item(i);
                results.push(nodeToVNode(cnode));
            }
            return results;
        }

        return <>
            {childNodesToVNodes(tmpl.content)}
        </>;
    }
}