
// private val valueSyncHook: (VNodeProxy, VNodeProxy) => Unit = (_, node) => {
//     node.elm.foreach { elm =>
//       val input = elm.asInstanceOf[HTMLInputElement]
//       if (input.value != input.getAttribute("value")) {
//         input.value = input.getAttribute("value")
//       }
//     }
//   }

import { Module, VNode } from "../../snabbdom/index";

function createOrUpdateFunc(oldVNode: VNode, newVNode: VNode) {
    if (newVNode.elm) {
        if (newVNode.data && newVNode.data["value-sync"] && newVNode.elm instanceof HTMLInputElement) {
            if (newVNode.elm.value != newVNode.elm.getAttribute("value")) {
                newVNode.elm.value = newVNode.elm.getAttribute("value") ?? "";
            }
        }
    }
}

export const valueSyncModule: Module = {
    create: createOrUpdateFunc,
    update: createOrUpdateFunc,
}