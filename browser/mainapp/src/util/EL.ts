
export function EL<K extends keyof HTMLElementTagNameMap>(name: K, attributes?: object, children?: (Node | string)[]): HTMLElementTagNameMap[K]
export function EL(name: string, attributes?: object, children?: (Node | string)[]): HTMLElement
export function EL(name: string, attributes?: object, children?: (Node | string)[]): HTMLElement {
    const result = document.createElement(name);
    if (attributes) {
        for (let n of Object.getOwnPropertyNames(attributes)) {
            const attrValue = (attributes as any)[n];
            if (typeof attrValue == "function") {
                result.addEventListener(n, attrValue);
            }
            else {
                result.setAttribute(n, attrValue?.toString() ?? "");
            }
        }
    }
    if (children) {
        for (let c of children) {
            if (c instanceof Node) {
                result.appendChild(c);
            }
            else if (typeof c == "string") {
                result.appendChild(document.createTextNode(c));
            }
        }
    }
    return result;
}