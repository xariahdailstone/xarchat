
let htmlSignatureKey: string | null = null;
function getHtmlSignature(): string {
    if (htmlSignatureKey == null) {
        let builder: string[] = [];
        for (let i = 0; i < 60; i++) {
            const cc = Math.floor(Math.random() * 26)
            builder.push(String.fromCharCode(cc + 65));
        }
        htmlSignatureKey = builder.join("");
    }
    return htmlSignatureKey;
}

export class HTMLUtils {

    //private static _cloners: Map<string, SmartCloner> = new Map();
    private static _fragments: Map<string, DocumentFragment> = new Map();

    static escapeHTML(raw: string): string {
        return raw.replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll("\"", "&quot;");
    }

    static unescapeHTML(escaped: string): string {
        const doc = new DOMParser().parseFromString(escaped, "text/html");
        return doc.documentElement.textContent ?? "";
    }

    static clearChildren(el: HTMLElement | ShadowRoot) {
        let x: ChildNode | null = null;
        while (x = el.firstChild) {
            x.remove();
        }
    }

    static assignStaticHTMLFragment(el: HTMLElement | ShadowRoot, html: string) {
        //el.innerHTML = html;

        let frag = this._fragments.get(html);
        if (frag == null) {
            frag = this.htmlToFragment(html);
            this._fragments.set(html, frag);
        }

        this.clearChildren(el);
        const newFrag = frag.cloneNode(true);
        el.append(newFrag);
        customElements.upgrade(el);

        // let cloner = this._cloners.get(html);
        // if (cloner == null) {
        //     cloner = this.htmlToSmartCloner(html);
        //     this._cloners.set(html, cloner);
        // }

        // this.clearChildren(el);
        // cloner(el);
    }

    static htmlToFragment(html: string): DocumentFragment {
        const templ = document.createElement("template");
        templ.innerHTML = html;
        return templ.content;
    }

    // private static htmlToSmartCloner(html: string): SmartCloner {
    //     const templ = document.createElement("template") as HTMLTemplateElement;
    //     templ.innerHTML = html;

    //     const frag = templ.content;
    //     return (parent: ParentNode) => {
    //         this.smartCloneChildren(parent, frag);
    //     } 
    // }

    // private static smartCloneChildren(parent: ParentNode, frag: Node) {
    //     frag.childNodes.forEach(cn => {
    //         const ccn = this.smartClone(cn);
    //         parent.append(ccn);
    //     });
    // }

    // private static smartClone(node: Node): Node {
    //     if (node.nodeType == Node.ELEMENT_NODE) {
    //         const el = node as Element;
    //         const cel = document.createElement(el.tagName);
    //         for (let attrName of el.getAttributeNames()) {
    //             cel.setAttribute(attrName, el.getAttribute(attrName)!);
    //         }
    //         this.smartCloneChildren(cel, el);
    //         return cel;
    //     }
    //     else if (node.nodeType == Node.TEXT_NODE) {
    //         return document.createTextNode(node.nodeValue!);
    //     }
    //     else if (node.nodeType == Node.DOCUMENT_FRAGMENT_NODE) {
    //         const frag = new DocumentFragment();
    //         this.smartCloneChildren(frag, node);
    //         return frag;
    //     }
    //     else if (node.nodeType == Node.COMMENT_NODE) {
    //         return node.cloneNode(true);
    //     }
    //     else {
    //         this.logging.logError("don't know how to smartclone this", node);
    //         return node.cloneNode(true);
    //     }
    // }

    private static generateHtmlBBCodeTagSignature(html: string): string {
        const cyrb53 = (str: string, seed = 0) => {
            let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
            for(let i = 0, ch; i < str.length; i++) {
                ch = str.charCodeAt(i);
                h1 = Math.imul(h1 ^ ch, 2654435761);
                h2 = Math.imul(h2 ^ ch, 1597334677);
            }
            h1  = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
            h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
            h2  = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
            h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
          
            return 4294967296 * (2097151 & h2) + (h1 >>> 0);
        };

        const seed = cyrb53(getHtmlSignature(), 0);
        const sig = cyrb53(html, seed);
        return sig.toString();
    }

    static getHtmlBBCodeTag(rawHtml: string): string {
        const sig = this.generateHtmlBBCodeTagSignature(rawHtml);
        return `[html=${sig}]${rawHtml}[/html]`;
    }

    static verifyHtmlBBCodeTagSignature(signature: string, content: string): boolean {
        const expectedSig = this.generateHtmlBBCodeTagSignature(content);
        return (expectedSig == signature);
    }
}

type SmartCloner = (into: ParentNode) => void;