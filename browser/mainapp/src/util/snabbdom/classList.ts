import { VNode, VNodeData, Module } from "../../snabbdom/index.js";

export type Classes = Record<string, boolean>;

function getVNodeClasses(vnode: VNode): Classes {
    const result: Classes = {};

    const classList = vnode.data?.classList
    if (classList) {
        if (typeof classList == "string") {
          for (let xx of classList.split(' ')) {
            result[classList] = true;
          }
        }
        else if (classList instanceof Array) {
            for (let x of classList) {
                if (x && x != "") {
                    result[x] = true;
                }
            }
        }
        else if (typeof classList == "object") {
          for (let x of Object.getOwnPropertyNames(classList)) {
            if (!!classList[x]) {
              for (let xx of x.split(' ')) {
                result[xx] = true;
              }
            }
          }
        }
    }

    return result;
}

function updateClass(oldVnode: VNode, vnode: VNode): void {
  let cur: any;
  let name: string;
  const elm: Element = vnode.elm as Element;
  let oldClass = getVNodeClasses(oldVnode); // (oldVnode.data as VNodeData).class;
  let klass = getVNodeClasses(vnode); // (vnode.data as VNodeData).class;

  if (!oldClass && !klass) return;
  if (oldClass === klass) return;
  oldClass = oldClass || {};
  klass = klass || {};

  for (name in oldClass) {
    if (oldClass[name] && !Object.prototype.hasOwnProperty.call(klass, name)) {
      // was `true` and now not provided
      elm.classList.remove(name);
    }
  }
  for (name in klass) {
    cur = klass[name];
    if (cur !== oldClass[name]) {
      (elm.classList as any)[cur ? "add" : "remove"](name);
    }
  }
}

export const classListModule: Module = { 
    create: updateClass, 
    update: updateClass 
};