import { VNode, VNodeData, Module } from "../../snabbdom/index.js";

function updateId(oldVnode: VNode, vnode: VNode): void {
  let cur: any;
  let name: string;
  const elm: Element = vnode.elm as Element;
  let oldId = oldVnode.data?.id;
  let newId = vnode.data?.id;

  if (!oldId && !newId) return;
  if (oldId === newId) return;

  if (newId != null && newId != "") {
    elm.setAttribute("id", newId);
  }
  else {
    elm.removeAttribute("id");
  }
}

export const idModule: Module = { 
    create: updateId, 
    update: updateId 
};