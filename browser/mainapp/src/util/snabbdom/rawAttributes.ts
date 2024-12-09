import { VNode, VNodeData, Module } from "../../snabbdom/index.js";

export type Attrs = Record<string, string | number | boolean>;

const xlinkNS = "http://www.w3.org/1999/xlink";
const xmlNS = "http://www.w3.org/XML/1998/namespace";
const colonChar = 58;
const xChar = 120;

const grabDataPropsAsAttrs = new Set<string>([
  "id",
  "src",
  "title"
]);

function getVNodeElementAttrs(vnode: VNode): Attrs {
    const result: Attrs = {};

    if ((vnode.data as VNodeData).attrs) {
      const vnda = (vnode.data as VNodeData).attrs as Attrs;
      for (let k of Object.getOwnPropertyNames(vnda)) {
        result[k] = vnda[k];
      }
    }

    if (vnode.data) {
        for (let keyName of Object.getOwnPropertyNames(vnode.data)) {
            if (keyName.startsWith("attr-")) {
              if (!vnode.data.attrs) { vnode.data.attrs = {}; }
              result[keyName.substring(5)] = vnode.data[keyName];
            }
            else if (keyName.startsWith("data-")) {
              result[keyName] = vnode.data[keyName];
            }
            else if (grabDataPropsAsAttrs.has(keyName)) {
              result[keyName] = vnode.data[keyName];
            }
        }
    }

    return result;
}

const PreviousAssignedAttrsSym = Symbol("previous assigned vnode attrs");

function updateAttrs(oldVnode: VNode, vnode: VNode): void {
  let key: string;
  const elm: Element = vnode.elm as Element;
  let oldAttrs: Attrs = (elm as any)[PreviousAssignedAttrsSym] ?? {};
  //let oldAttrs = getVNodeElementAttrs(oldVnode);   // (oldVnode.data as VNodeData).attrs;
  let attrs = getVNodeElementAttrs(vnode);  // (vnode.data as VNodeData).attrs;

  if (!oldAttrs && !attrs) return;
  if (oldAttrs === attrs) return;
  oldAttrs = oldAttrs || {};
  attrs = attrs || {};

  (elm as any)[PreviousAssignedAttrsSym] = attrs;

  // update modified attributes, add new attributes
  for (key in attrs) {
    const cur = attrs[key];
    const old = oldAttrs[key];
    if (old !== cur) {
      if (cur === true) {
        elm.setAttribute(key, "");
      } else if (cur === false) {
        elm.removeAttribute(key);
      } else {
        if (key.charCodeAt(0) !== xChar) {
          elm.setAttribute(key, cur as any);
        } else if (key.charCodeAt(3) === colonChar) {
          // Assume xml namespace
          elm.setAttributeNS(xmlNS, key, cur as any);
        } else if (key.charCodeAt(5) === colonChar) {
          // Assume xlink namespace
          elm.setAttributeNS(xlinkNS, key, cur as any);
        } else {
          elm.setAttribute(key, cur as any);
        }
      }
    }
  }
  // remove removed attributes
  // use `in` operator since the previous `for` iteration uses it (.i.e. add even attributes with undefined value)
  // the other option is to remove all attributes with value == undefined
  for (key in oldAttrs) {
    if (!(key in attrs)) {
      elm.removeAttribute(key);
    }
  }
}

export const rawAttributesModule: Module = {
    create: updateAttrs,
    update: updateAttrs
};