import { InlineInfo } from "../../fchat/api/FListApi";
import { ChannelName } from "../../shared/ChannelName";
import { CharacterName } from "../../shared/CharacterName";
import { h } from "../../snabbdom/h";
import { VNode } from "../../snabbdom/vnode";
import { ActiveLoginViewModel } from "../../viewmodel/ActiveLoginViewModel";
import { AppViewModel } from "../../viewmodel/AppViewModel";
import { ChannelViewModel } from "../../viewmodel/ChannelViewModel";
import { ImagePreviewPopupViewModel } from "../../viewmodel/popups/ImagePreviewPopupViewModel";
import { CancellationTokenSource } from "../CancellationTokenSource";
import { IDisposable } from "../Disposable";
import { EL } from "../EL";
import { EventListenerUtil } from "../EventListenerUtil";
import { getRoot } from "../GetRoot";
import { HostInterop } from "../HostInterop";
import { BBCodeTag } from "./BBCodeTag";
import { BBCodeTagB } from "./tags/BBCodeTagB";
import { BBCodeTagBig } from "./tags/BBCodeTagBig";
import { BBCodeTagCenter } from "./tags/BBCodeTagCenter";
import { BBCodeTagCollapse } from "./tags/BBCodeTagCollapse";
import { BBCodeTagColor } from "./tags/BBCodeTagColor";
import { BBCodeTagEIcon } from "./tags/BBCodeTagEIcon";
import { BBCodeTagHR } from "./tags/BBCodeTagHR";
import { BBCodeTagHeading } from "./tags/BBCodeTagHeading";
import { BBCodeTagI } from "./tags/BBCodeTagI";
import { BBCodeTagIcon } from "./tags/BBCodeTagIcon";
import { BBCodeTagImg } from "./tags/BBCodeTagImg";
import { BBCodeTagIndent } from "./tags/BBCodeTagIndent";
import { BBCodeTagJustify } from "./tags/BBCodeTagJustify";
import { BBCodeTagLeft } from "./tags/BBCodeTagLeft";
import { BBCodeTagNoParse } from "./tags/BBCodeTagNoParse";
import { BBCodeTagQuote } from "./tags/BBCodeTagQuote";
import { BBCodeTagRight } from "./tags/BBCodeTagRight";
import { BBCodeTagS } from "./tags/BBCodeTagS";
import { BBCodeTagSession } from "./tags/BBCodeTagSession";
import { BBCodeTagSmall } from "./tags/BBCodeTagSmall";
import { BBCodeTagSpoiler } from "./tags/BBCodeTagSpoiler";
import { BBCodeTagSub } from "./tags/BBCodeTagSub";
import { BBCodeTagSup } from "./tags/BBCodeTagSup";
import { BBCodeTagU } from "./tags/BBCodeTagU";
import { BBCodeTagUrl } from "./tags/BBCodeTagUrl";
import { BBCodeTagUser } from "./tags/BBCodeTagUser";

interface SerStackEntry {
    tag?: BBCodeTag;
    openToken?: Token;
    contentBuilder: Node[];
    rawTextContentBuilder: string[];
}

export interface BBCodeParseSink {
    userClick(name: CharacterName, context: BBCodeClickContext): void;
    sessionClick(target: string, titleHint: string, context: BBCodeClickContext): void;
    webpageClick(url: string, forceExternal: boolean, context: BBCodeClickContext): void;
}

export interface BBCodeClickContext {
    readonly rightClick: boolean;
    readonly channelContext: (ChannelViewModel | null | undefined);
    readonly targetElement: (HTMLElement | null | undefined);
}

export interface BBCodeParseOptions {
    appViewModel?: AppViewModel;
    activeLoginViewModel?: ActiveLoginViewModel;
    channelViewModel?: ChannelViewModel;
    sink?: BBCodeParseSink;
    addUrlDomains: boolean;
    syncGifs: boolean;
    imagePreviewPopups: boolean;
    inlineImageData?: { [id: string]: InlineInfo };
    parseAsStatus?: boolean;
    eiconsUniqueLoadTag?: string;
}

export interface BBCodeParseContext {
    parseOptions: BBCodeParseOptions;
    disposables: IDisposable[];
}

export interface BBCodeTagContent {
    nodes: Node[];
    rawText: string[];

    rawOpenTag: string;
    rawCloseTag: string;
}

export interface BBCodeParseResult extends IDisposable {
    element: HTMLSpanElement;

    asVNode(): VNode;
}

export interface BBCodeParserSetupOptions {
    enableHRProcessing?: boolean;
}

export class BBCodeParser {
    constructor(options?: BBCodeParserSetupOptions) {
        this._parserOptions = options ?? {};
    }

    readonly _parserOptions: BBCodeParserSetupOptions;

    tags: BBCodeTag[] = [];

    parse(raw: string, options?: Partial<BBCodeParseOptions>): BBCodeParseResult {
        const tokens = this.tokenize(raw);

        const xoptions: BBCodeParseOptions = { 
            sink: { userClick() {}, sessionClick() {}, webpageClick() {} }, 
            addUrlDomains: true, 
            syncGifs: true,
            imagePreviewPopups: true, 
            ...options 
        };
        xoptions.sink = options?.sink ?? { userClick: ()=>{}, sessionClick: ()=>{}, webpageClick: ()=>{} };

        const parseContext: BBCodeParseContext = {
            parseOptions: xoptions,
            disposables: []
        };

        const serStack: SerStackEntry[] = [];
        serStack.push({
            contentBuilder: [],
            rawTextContentBuilder: []
        });
        const tail = () => serStack[serStack.length - 1];

        for (let tok of tokens) {
            switch (tok.type) {
                case "text":
                    tail().contentBuilder.push(...this.toTextNodes(tok.text!));
                    tail().rawTextContentBuilder.push(tok.text!);
                    break;
                case "tag":
                    {
                        let gotIt = false;
                        for (let potentialTag of this.tags.filter(x => x.tagName.toLowerCase() == tok.tagName!.toLowerCase())) {
                            if (potentialTag.isValidStart(tok)) {
                                if (potentialTag.hasClosingTag) {
                                    serStack.push({
                                        tag: potentialTag,
                                        openToken: tok,
                                        contentBuilder: [],
                                        rawTextContentBuilder: []
                                    });
                                }
                                else {
                                    const converted = potentialTag.convert(parseContext, tok.tagArgument, { 
                                        nodes: [], 
                                        rawText: [],
                                        rawOpenTag: tok.tagOrig!,
                                        rawCloseTag: ""
                                    });
                                    if (converted instanceof Array) {
                                        tail().contentBuilder.push(...converted);
                                    }
                                    else {
                                        tail().contentBuilder.push(converted);
                                    }
                                    tail().rawTextContentBuilder.push(tok.tagOrig!);
                                }
                                gotIt = true;
                                break;
                            }
                        }
                        if (!gotIt) {
                            tail().contentBuilder.push(...this.toTextNodes(tok.tagOrig!));
                            tail().rawTextContentBuilder.push(tok.tagOrig!);
                        }
                    }
                    break;
                case "closingtag":
                    {
                        if (tok.tagName!.toLowerCase() == tail().tag?.tagName.toLowerCase()) {
                            const content = tail().contentBuilder;
                            const contentText = tail().rawTextContentBuilder;
                            const converted = tail().tag?.convert(parseContext, tail().openToken!.tagArgument, { 
                                nodes: content,
                                rawText: contentText,
                                rawOpenTag: tail().openToken!.tagOrig!,
                                rawCloseTag: tok.tagOrig!
                            });
                            const popped = serStack.pop();
                            if (converted instanceof Node) {
                                tail().contentBuilder.push(converted);
                            }
                            else if (converted instanceof Array) {
                                tail().contentBuilder.push(...converted);
                            }
                            tail().rawTextContentBuilder.push(popped?.openToken?.tagOrig!);
                            tail().rawTextContentBuilder.push(...contentText);
                            tail().rawTextContentBuilder.push(tok.tagOrig!);
                        }
                        else {
                            tail().contentBuilder.push(...this.toTextNodes(tok.tagOrig!));
                            tail().rawTextContentBuilder.push(tok.tagOrig!);
                        }
                    }
                    break;
            }
        }

        while (serStack.length > 1) {
            const content = tail().contentBuilder;
            const contentText = tail().rawTextContentBuilder;
            const converted = tail().tag?.convert(parseContext, tail().openToken!.tagArgument, {
                nodes: content, 
                rawText: contentText,
                rawOpenTag: tail().openToken!.tagOrig!,
                rawCloseTag: ""
            });
            serStack.pop();
            if (converted instanceof Node) {
                tail().contentBuilder.push(converted);
            }
            else if (converted instanceof Array) {
                tail().contentBuilder.push(...converted);
            }
        }

        const resFragment = document.createElement("span");
        resFragment.classList.add("bbcode-parsed");
        if (parseContext.parseOptions.parseAsStatus ?? false) {
            resFragment.classList.add("bbcode-status");
        }
        //resFragment.setAttribute("data-bbcoderaw", raw);
        resFragment.append(...serStack[0].contentBuilder);

        const fixupDisposables: IDisposable[] = [];
        this.fixupRawTextUrls(resFragment, parseContext.parseOptions, fixupDisposables);
        parseContext.disposables.push(...fixupDisposables);

        if (this._parserOptions.enableHRProcessing) {
            this.fixupHRs(resFragment);
        }

        const result: BBCodeParseResult = {
            element: resFragment,
            asVNode(): VNode {
                let child = h('span', {hook: {
                    insert(vnode: VNode) {
                        (vnode.elm as HTMLElement).replaceWith(resFragment)
                        //vnode.elm = resFragment;
                    }
                }});
                child.elm = resFragment;
                return child;
            },
            dispose: () => {
                for (let x of parseContext.disposables) {
                    try { x.dispose(); }
                    catch { }
                }
            },
            [Symbol.dispose]() {
                this.dispose();
            }
        };
        return result;
    }

    private fixupHRs(node: Node) {
        if (!node) return;

        if (node.nodeType == Node.TEXT_NODE) {
            if (node.textContent != null && node.textContent.indexOf("[hr]") != -1) {
                const textParts = node.textContent.split("[hr]");
                const myFrag = new DocumentFragment();
                for (let i = 0; i < textParts.length; i++) {
                    if (i > 0) {
                        const elHR = EL("hr", { class: "bbcode-hr", "data-copycontent": "[hr]" });
                        myFrag.appendChild(elHR);
                    }
                    const thisTextPart = textParts[i];
                    if (thisTextPart != "") {
                        myFrag.appendChild(document.createTextNode(thisTextPart));
                    }
                }
                node.parentNode?.replaceChild(myFrag, node);
            }
        }
        else if (node.nodeType == Node.ELEMENT_NODE) {
            const childNodes = (node as Element).childNodes;
            for (let i = 0; i < childNodes.length; i++) {
                const tchildNode = childNodes.item(i);
                this.fixupHRs(tchildNode);
            }
        }
    }

    private fixupRawTextUrls(node: Node, options: BBCodeParseOptions, subdisposables: IDisposable[]) {
        if (!node) return;
        
        if (node.nodeType == Node.TEXT_NODE) {
            const ssds: IDisposable[] = [];
            const replacementNode = this.convertRawTextUrlsInTextNode(node, options, ssds);
            if (node != replacementNode) {
                node.parentNode?.replaceChild(replacementNode, node);
                subdisposables.push(...ssds);
            }
        }
        else if (node.nodeType == Node.ELEMENT_NODE) {
            if (!BBCodeParser.isExcludedFromAutoUrlization(node as HTMLElement)) {
                const childNodes = (node as Element).childNodes;
                for (let i = 0; i < childNodes.length; i++) {
                    const tchildNode = childNodes.item(i);
                    this.fixupRawTextUrls(tchildNode, options, subdisposables);
                }
            }
        }
    }

    static SYM_NOAUTOURLIZATION = Symbol();
    static markElementAsExcludedFromAutoUrlization(el: HTMLElement) {
        (el as any)[BBCodeParser.SYM_NOAUTOURLIZATION] = true;
    }
    static isExcludedFromAutoUrlization(el: HTMLElement) {
        return !!(el as any)[BBCodeParser.SYM_NOAUTOURLIZATION];
    }

    private convertRawTextUrlsInTextNode(textNode: Node, options: BBCodeParseOptions, subdisposables: IDisposable[]): Node {
        let txt = textNode.textContent ?? "";

        let hasChange = false;
        const re = /https?\:\/\/(\S+)/g;
        const matches: RegExpExecArray[] = [];
        let m;
        while (m = re.exec(txt)) {
            matches.push(m);
        }
        for (let mi = matches.length - 1; mi >= 0; mi--) {
            hasChange = true;
            const tmatch = matches[mi];
            const beforeStr = txt.substr(0, tmatch.index);
            const afterStr = txt.substr(tmatch.index + tmatch[0].length);
            txt = beforeStr + "[url]" + tmatch[0] + "[/url]" + afterStr;
        }
        
        if (hasChange) {
            const pr = this.parse(txt, options);
            subdisposables.push(pr);
            return pr.element;
        }
        else {
            return textNode;
        }
    }

    private escapeHTML(raw: string ): string;
    private escapeHTML(raw: string | null | undefined): string | undefined;
    private escapeHTML(raw: string | null | undefined): string | undefined {
        if (raw == null) return undefined;

        return raw
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&gt;")
            .replaceAll(">", "&lt;")
            .replaceAll("\"", "&quot;")
            .replaceAll("'", "&apos;")
            .replaceAll("\n", "<br />");
    }

    private toTextNodes(text: string): Node[] {
        const result = [];
        const parts = text.split('\n');
        let isFirst = true;
        for (let p of parts) {
            if (!isFirst) {
                result.push(document.createElement("br"));
            }
            if (p != "") {
                result.push(document.createTextNode(p));
            }
            isFirst = false;
        }
        return result;
    }

    tokenize(raw: string): Token[] {
        const result: Token[] = [];

        let replaceHRBack = (s: string | undefined) => s;
        if (this._parserOptions.enableHRProcessing) {
            raw = raw.replaceAll("[hr]", "@@@@@HR@@@@@");
            replaceHRBack = (s) => {
                if (s === undefined) return undefined;
                return s.replaceAll("@@@@@HR@@@@@", "[hr]");
            };
        }

        let endedAt = 0;
        for (let m of raw.matchAll(/(?<pretext>.*?)(?<tagorig>\[(?<closingslash>\/)?(?<tagname>[A-Za-z]+)(\=(?<arg>[^\]]+))?\])(?<posttext>[^\[]*)?/sg)) {
            const pretext = replaceHRBack(m.groups!.pretext);
            const isClosingTag = (m.groups!.closingslash == "/");
            const tagName = m.groups!.tagname;
            const arg = replaceHRBack(m.groups!.arg);
            const tagOrig = replaceHRBack(m.groups!.tagorig);
            const postText = replaceHRBack(m.groups!.posttext);

            if (pretext && pretext.length > 0) {
                result.push({ type: "text", text: pretext });
            }

            result.push({
                type: isClosingTag ? "closingtag": "tag",
                tagName: tagName,
                tagArgument: arg,
                tagOrig: tagOrig
            });
            
            if (postText && postText.length > 0) {
                result.push({
                    type: "text",
                    text: postText
                });
            }
        }
        if (result.length == 0) {
            result.push({
                type: "text",
                text: raw
            });
        }

        return result;
    }

    static performCopy(e: ClipboardEvent) {
        const root = getRoot(e.target as Node);
        if (!root) return;
        
        const sel = (root as Document).getSelection();
        if (sel?.type != "Range") return;

        const range = sel.getRangeAt(0);
        const frag = range.cloneContents();
        const copyBuilder: string[] = [];
        for (let i = 0; i < frag.childNodes.length; i++) {
            this.performCopyInternal(frag.childNodes.item(i), copyBuilder);
        }

        const r = copyBuilder.join("").trim();
        e.clipboardData?.setData("text/plain", r);
        e.preventDefault();
    }

    private static performCopyInternal(n: Node, copyBuilder: string[]) {
        if (n.nodeType == Node.TEXT_NODE) {
            copyBuilder.push(n.textContent ?? "");
        }
        else if (n instanceof Element) {
            if (n.hasAttribute("data-copycontent")) {
                copyBuilder.push(n.getAttribute("data-copycontent")!);
            }
            else {
                if (n.hasAttribute("data-copyprefix")) {
                    copyBuilder.push(n.getAttribute("data-copyprefix")!);
                }
                for (let i = 0; i < n.childNodes.length; i++) {
                    this.performCopyInternal(n.childNodes.item(i), copyBuilder);
                }
                if (n.hasAttribute("data-copysuffix")) {
                    copyBuilder.push(n.getAttribute("data-copysuffix")!);
                }
                if (!n.hasAttribute("data-copyinline") && (n.tagName == "DIV" || n.tagName == "BR")) {
                    copyBuilder.push("\n");
                }
            }
        }
    }
}

export interface Token {
    type: "text" | "tag" | "closingtag";
    text?: string;
    tagName?: string;
    tagArgument?: string;
    tagOrig?: string;
}

export function getContentText(content: BBCodeTagContent) {
    // const result = [];
    // for (let n of content) {
    //     if (n instanceof Node) {
    //         result.push(n.textContent);
    //     }
    // }
    // return result.join("");
    return content.rawText.join("");
}

const chatTags: BBCodeTag[] = [
    BBCodeTagSpoiler,
    BBCodeTagB,
    BBCodeTagI,
    BBCodeTagU,
    BBCodeTagS,
    BBCodeTagEIcon,
    BBCodeTagIcon,
    BBCodeTagSub,
    BBCodeTagSup,
    BBCodeTagUrl,
    BBCodeTagColor,
    BBCodeTagSession,
    BBCodeTagUser,
    BBCodeTagNoParse
];

const profileTags: BBCodeTag[] = [
    ...chatTags,
    BBCodeTagHeading,
    BBCodeTagIndent,
    //BBCodeTagHR,
    BBCodeTagCollapse,
    BBCodeTagCenter,
    BBCodeTagLeft,
    BBCodeTagRight,
    BBCodeTagJustify,
    BBCodeTagBig,
    BBCodeTagSmall,
    BBCodeTagImg,
    BBCodeTagQuote
]

const profileMinusInlinesTags: BBCodeTag[] = [
    ...chatTags,
    BBCodeTagHeading,
    BBCodeTagIndent,
    //BBCodeTagHR,
    BBCodeTagCollapse,
    BBCodeTagCenter,
    BBCodeTagLeft,
    BBCodeTagRight,
    BBCodeTagJustify,
    BBCodeTagBig,
    BBCodeTagSmall,
    BBCodeTagQuote
]

const chatParser = new BBCodeParser();
chatParser.tags.push(...chatTags);

const profileParser = new BBCodeParser({ enableHRProcessing: true });
profileParser.tags.push(...profileTags);

const profileMinusInlinesParser = new BBCodeParser({ enableHRProcessing: true });
profileMinusInlinesParser.tags.push(...profileMinusInlinesTags);

export const ChatBBCodeParser: BBCodeParser = chatParser;
export const ProfileBBCodeParser: BBCodeParser = profileParser;
export const ProfileNoInlinesBBCodeParser: BBCodeParser = profileMinusInlinesParser;

export const RegisteredBBCodeParsers: { [key: string]: BBCodeParser | undefined } = {
    "chat": chatParser,
    "profile": profileParser,
    "profilenoimg": profileMinusInlinesParser
}