
export function getRoot(el: Node | null): (ShadowRoot | Document | null) {
    while (el) {
        if (el instanceof ShadowRoot) {
            return el;
        }
        else if (el instanceof Document) {
            return el;
        }
        el = el.parentNode;
    }
    return null;
}