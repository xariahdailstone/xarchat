import { HTMLUtils } from "../HTMLUtils";

function getElementSnapshot(sb: string[], el: Element) {
    sb.push("<");
    sb.push(el.tagName);
    if (el.attributes.length > 0) {
        for (let i = 0; i < el.attributes.length; i++) {
            const attr = el.attributes.item(i);
            if (attr) {
                sb.push(' ');
                sb.push(attr.name)
                if (attr.value) {
                    sb.push('="');
                    sb.push(HTMLUtils.escapeHTML(attr.value));
                    sb.push('"');
                }
            }
        }
    }
    sb.push(">");

    if ((el as any)._sroot) {
        sb.push("<#SROOT ");
        getNodeSnapshot(sb, (el as any)._sroot);
        sb.push("#>");
    }

    if (el.childNodes.length > 0) {
        for (let i = 0; i < el.childNodes.length; i++) {
            getNodeSnapshot(sb, el.childNodes[i]);
        }
    }
    sb.push("</");
    sb.push(el.tagName);
    sb.push(">");
}

function getCommentSnapshot(sb: string[], el: Node) {
    sb.push("<!--" + el.nodeValue + "-->");
}

function getTextSnapshot(sb: string[], el: Node) {
    sb.push(HTMLUtils.escapeHTML(el.nodeValue ?? ""));
}

function getDocumentFragmentSnapshot(sb: string[], el: DocumentFragment) {
    for (var i = 0; i < el.childNodes.length; i++) {
        getNodeSnapshot(sb, el.childNodes.item(i));
    }
}

function getNodeSnapshot(sb: string[], el: Node) {
    switch (el.nodeType) {
        case Node.ELEMENT_NODE:
            getElementSnapshot(sb, el as Element);
            break;
        case Node.COMMENT_NODE:
            getCommentSnapshot(sb, el);
            break;
        case Node.TEXT_NODE:
            getTextSnapshot(sb, el)
            break;
        case Node.DOCUMENT_FRAGMENT_NODE:
            getDocumentFragmentSnapshot(sb, el as DocumentFragment);
            break;
    }
}

export function registerDebuggingFunctions() {
    (window as any)["__debug"] = {
        getNodeSnapshot: getNodeSnapshot
    }
}