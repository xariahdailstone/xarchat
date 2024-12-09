import { VNode, VNodeData, Module } from "../../snabbdom/index.js";

export type Classes = Record<string, boolean>;

function loadFromClassString(hasClasses: Classes, classes: string, setValue: boolean) {
  if (classes == null) return;
  for (let xy of classes.split(' ')) {
    const xx = xy.trim();
    if (xx != "") {
      hasClasses[xx] = setValue || (!!hasClasses[xx]);
    }
  }
}

function loadFromClassListArg(hasClasses: Classes, classList: any) {
  if (classList) {
      if (typeof classList == "string") {
        loadFromClassString(hasClasses, classList, true);
      }
      else if (classList instanceof Array) {
          for (let x of classList) {
              loadFromClassString(hasClasses, x, true);
          }
      }
      else if (typeof classList == "object") {
        for (let x of Object.getOwnPropertyNames(classList)) {
          loadFromClassString(hasClasses, x, !!classList[x]);
        }
      }
  }
}

function loadFromClassArg(hasClasses: Classes, classArg?: Classes) {
  if (classArg != null) {
    for (let xx of Object.getOwnPropertyNames(classArg)) {
      hasClasses[xx] = classArg[xx] || (!!hasClasses[xx]);
    }
  }
}

function loadFromClassDatas(hasClasses: Classes, data?: VNodeData) {
  if (data != null) {
    for (let rxx of Object.getOwnPropertyNames(data)) {
      if (rxx.startsWith("class-")) {
        const xx = rxx.substring(6);
        hasClasses[xx] = !!data[rxx] || (!!hasClasses[xx]);
      }
    }
  }
}

function getVNodeClasses(vnode: VNode): Classes {
    const hasClasses: Classes = {};

    loadFromClassArg(hasClasses, vnode.data?.class);
    loadFromClassListArg(hasClasses, vnode.data?.classList);
    loadFromClassDatas(hasClasses, vnode.data);

    return hasClasses;
}

const PreviousAssignedAttrsSym = Symbol("previous assigned vnode classes");

function updateClass(oldVnode: VNode, vnode: VNode): void {
  let cur: any;
  let name: string;
  const elm: Element = vnode.elm as Element;
  //let oldClass = getVNodeClasses(oldVnode); // (oldVnode.data as VNodeData).class;
  let oldClass: Classes = (elm as any)[PreviousAssignedAttrsSym] ?? {};
  let klass = getVNodeClasses(vnode); // (vnode.data as VNodeData).class;

  if (!oldClass && !klass) return;
  if (oldClass === klass) return;
  oldClass = oldClass || {};
  klass = klass || {};

  (elm as any)[PreviousAssignedAttrsSym] = klass;

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

export const classListNewModule: Module = { 
    create: updateClass, 
    update: updateClass 
};