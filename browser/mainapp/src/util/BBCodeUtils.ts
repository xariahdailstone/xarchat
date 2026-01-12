import { MessagePreviewPopup } from "../components/popups/MessagePreviewPopup";
import { VNode } from "../snabbdom/vnode";
import { ActiveLoginViewModel } from "../viewmodel/ActiveLoginViewModel";
import { AppViewModel } from "../viewmodel/AppViewModel";
import { ChannelViewModel } from "../viewmodel/ChannelViewModel";
import { EIconSearchDialogViewModel } from "../viewmodel/dialogs/EIconSearchDialogViewModel";
import { MessagePreviewPopupViewModel } from "../viewmodel/popups/MessagePreviewPopupViewModel";
import { ChatBBCodeParser } from "./bbcode/BBCode";
import { EventListenerUtil } from "./EventListenerUtil";
import { KeyCodes } from "./KeyCodes";
import { PlatformUtils } from "./PlatformUtils";
import { TextEditShortcutsHelper } from "./TextEditShortcutsHelper";

const urlPattern = new RegExp(/(.*?)(http(s)?\:\/\/(\S+))/, "ig");

const CUR_POPUP_VM = Symbol();

function tryHandleEditShortcutKey(textarea: HTMLTextAreaElement, ev: KeyboardEvent, options: AddEditingShortcutsOptions) {
    if (PlatformUtils.isShortcutKey(ev)) {
        const tesh = new TextEditShortcutsHelper({
            textarea: textarea,
            previewPopupElement: options.previewPopupElement,
            channelViewModelGetter: options.channelViewModelGetter,
            activeLoginViewModelGetter: options.activeLoginViewModelGetter
        });
        tesh.value = textarea.value;
        tesh.selectionAt = Math.min(textarea.selectionStart, textarea.selectionEnd)
        tesh.selectionLength = Math.abs(textarea.selectionEnd - textarea.selectionStart);

        let loadBack = false;

        switch (ev.keyCode) {
            case KeyCodes.KEY_P:
                tesh.showPreview();
                break;
            case KeyCodes.KEY_B:
                tesh.bold();
                loadBack = true;
                break;
            case KeyCodes.KEY_E:
                {
                    let avm: AppViewModel | null = null;
                    const getAvm = () => { avm = avm ?? options.appViewModelGetter() ?? null; return avm; };

                    let doWhat: ("nothing"|"search"|"tag") = "nothing";
                    if (ev.altKey) {
                        doWhat = "search";
                    }
                    else {
                        const avm = getAvm();
                        if (avm) {
                            if (avm.getConfigSettingById("eiconSearch.enabled")) {
                                doWhat = "search";
                            }
                            else {
                                doWhat = "tag";
                            }
                        }
                    }

                    if (doWhat == "search" && getAvm() == null) {
                        doWhat = "tag";
                    }

                    switch (doWhat) {
                        case "search":
                            loadBack = true;
                            (async () => {
                                const avm = getAvm()!;
                                const sess = options.activeLoginViewModelGetter ? options.activeLoginViewModelGetter() ?? null : null;
                                const pdialog = new EIconSearchDialogViewModel(avm, sess);
                                const dlgResult = await avm.showDialogAsync(pdialog);
                                if (dlgResult) {
                                    tesh.eicon(dlgResult);
                                    textarea.value = tesh.value;
                                    textarea.setSelectionRange(tesh.selectionAt, tesh.selectionAt + tesh.selectionLength);
                                    options.onTextChanged(textarea.value);
                                }
                                textarea.focus();
                            })();
                            break;
                        case "tag":
                            tesh.eicon();
                            loadBack = true;
                    }
                }
                break;
            case KeyCodes.KEY_I:
                tesh.italic();
                loadBack = true;
                break;
            case KeyCodes.KEY_U:
                tesh.underline();
                loadBack = true;
                break;
            case KeyCodes.UP_ARROW:
            case KeyCodes.KEY_Y:
                tesh.superscript();
                loadBack = true;
                break;
            case KeyCodes.DOWN_ARROW:
            case KeyCodes.KEY_H:
                tesh.subscript();
                loadBack = true;
                break;
            case KeyCodes.KEY_K:
                tesh.spoiler();
                loadBack = true;
                break;
            case KeyCodes.KEY_L:
                tesh.url();
                loadBack = true;
                break;                
            case KeyCodes.KEY_N:
                tesh.noparse();
                loadBack = true;
                break;
            case KeyCodes.KEY_O:
                tesh.icon();
                loadBack = true;
                break;
            case KeyCodes.KEY_R:
                tesh.user();
                loadBack = true;
                break;
            case KeyCodes.KEY_S:
                tesh.strikethrough();
                loadBack = true;
                break;
            case KeyCodes.KEY_D:
                tesh.color();
                loadBack = true;
                break;
        }

        if (loadBack) {
            textarea.value = tesh.value;
            textarea.setSelectionRange(tesh.selectionAt, tesh.selectionAt + tesh.selectionLength);
            options.onTextChanged(textarea.value);
            return true;
        }
    }

    return false;
}

export class BBCodeUtils {
    static pasteWithAutoUrlization(origText: string, selStart: number, selEnd: number, pasteText: string): (null | [string, number | null, number | null]) {
        if (BBCodeUtils.isPastedUrl(pasteText)) {
            if (selEnd == selStart) {
                if (BBCodeUtils.isCursorAtAutoUrlLocation(origText, selStart)) {
                    const firstPart = `[url=${pasteText}]`;
                    const secondPart = "[/url]";
                    return [firstPart + secondPart, firstPart.length, null];
                }
            }
            else {
                if (BBCodeUtils.isCursorAtAutoUrlLocation(origText, selStart)) {
                    const selContent = BBCodeUtils.isSelectionAlreadyUrlTag(origText, selStart, selEnd, pasteText)
                    if (selContent != null) {
                        return [selContent, 0, selContent.length];
                    }
                    else {
                        const innerPart = origText.substring(selStart, selEnd);
                        const innerLT = this.getLeadingTrailingWhitespace(innerPart);

                        const firstPart = `[url=${pasteText}]`;
                        const thirdPart = "[/url]";
                        const totalStr = innerLT[0] + firstPart + innerLT[1] + thirdPart + innerLT[2];
                        return [totalStr, 0, totalStr.length];
                    }
                }
            }
        }
        return [pasteText, null, null];
    }

    private static getLeadingTrailingWhitespace(str: string): [string, string, string] {
        const strTrimStart = str.trimStart();
        const strTrimEnd = str.trimEnd();
        const strTrim = str.trim();

        let leadingWhitespace = "";
        if (str != strTrimStart) {
            leadingWhitespace = str.substring(0, str.length - strTrimStart.length);
        }

        let trailingWhitespace = "";
        if (str != strTrimEnd) {
            trailingWhitespace = str.substring(strTrimEnd.length);
        }

        return [leadingWhitespace, strTrim, trailingWhitespace];
    }

    private static isSelectionAlreadyUrlTag(origText: string, selStart: number, selEnd: number, pasteText: string): string | null {
        const prefix = `[url=${pasteText}]`;
        const suffix = "[/url]";

        const selStr = origText.substring(selStart, selEnd);
        const selLT = this.getLeadingTrailingWhitespace(selStr);

        const selStrTrimmed = selLT[1];

        if (selStrTrimmed.toLowerCase().startsWith(prefix.toLowerCase()) && selStrTrimmed.toLowerCase().endsWith(suffix.toLowerCase())) {
            return selLT[0] +  selStrTrimmed.substring(prefix.length, selStrTrimmed.length - suffix.length) + selLT[2];
        }
        return null;
    }

    private static isPastedUrl(pasteText: string) {
        return (pasteText.startsWith("http://") || pasteText.startsWith("https://")) && (pasteText.match(/\s/) == null);
    }

    private static isCursorAtAutoUrlLocation(str: string, cursorPosition: number): boolean {
        const tokens = ChatBBCodeParser.tokenize(str);

        let consumedLength = 0;
        let inUrlCount = 0;
        for (let tok of tokens) {
            const tokenContainsCursor = (tok.type != "text") ?
                 ((cursorPosition >= consumedLength) && (cursorPosition < (consumedLength + tok.sourceText.length)))
                 : ((cursorPosition >= consumedLength) && (cursorPosition <= (consumedLength + tok.sourceText.length)));

            if (tok.type == "tag") {
                if (tok.tagName?.toUpperCase() == "URL") {
                    inUrlCount++;
                }
            }
            else if (tok.type == "closingtag") {
                if (tok.tagName?.toUpperCase() == "URL") {
                    inUrlCount = Math.max(0, inUrlCount - 1);
                }
            }
            else if (tok.type == "text") {
                if (tokenContainsCursor) {
                    const beforeText = tok.text!.substring(0, cursorPosition - consumedLength);
                    const isWritingTag = beforeText.endsWith("[url=") || beforeText.endsWith("[URL=");

                    return (!isWritingTag) && (inUrlCount == 0);
                }
            }
            consumedLength += tok.sourceText.length;
            if (consumedLength > cursorPosition) {
                return false;
            }
        }
        return (inUrlCount == 0);
    }

    static addEditingShortcutsAbstract(addEventListener: (eventName: keyof HTMLElementEventMap, handler: (e: Event) => void) => void, options: AddEditingShortcutsOptions) {
        if (!(options?.onKeyDownHandler)) {
            options.onKeyDownHandler = (ev, handleShortcuts) => {
                handleShortcuts(ev);
            }
        }
        //else {
            addEventListener("keydown", (ev: KeyboardEvent) => {
                const textarea = ev.target as HTMLTextAreaElement;
                options.onKeyDownHandler!(ev, (ev) => {
                    if (tryHandleEditShortcutKey(textarea, ev, options)) {
                        ev.preventDefault();
                        return true;
                    }
                    else {
                        return false;
                    }
                });
            });
        //}
        addEventListener("paste", (ev: ClipboardEvent) => {
            const textarea = ev.target as HTMLTextAreaElement;
            const avm = options.appViewModelGetter();
            if (!!(avm?.getConfigSettingById("autoUrlPaste"))) {
               let pasteText = ev.clipboardData?.getData("text") ?? "";
                if (pasteText != "") {
                    const selStart = Math.min(textarea.selectionStart, textarea.selectionEnd);
                    const selEnd = Math.max(textarea.selectionStart, textarea.selectionEnd);

                    const effectivePaste = BBCodeUtils.pasteWithAutoUrlization(textarea.value, selStart, selEnd, pasteText);
                    //textarea.setSelectionRange(0, textarea.value.length, "forward");
                    if (effectivePaste) {
                        document.execCommand("insertText", false, effectivePaste[0]);
                        if (effectivePaste[1] != null) {
                            if (effectivePaste[2] == null) {
                                textarea.setSelectionRange(selStart + effectivePaste[1], selStart + effectivePaste[1], "forward");
                            }
                            else {
                                textarea.setSelectionRange(selStart + effectivePaste[1], selStart +  effectivePaste[1] + effectivePaste[2], "forward");
                            }
                        }
                        options.onTextChanged(textarea.value);
                    }
                    ev.preventDefault();
                }
            }
        });
    }

    static addEditingShortcutsVNode(textareaVNode: VNode, options: AddEditingShortcutsOptions) {
        this.addEditingShortcutsAbstract(
            (eventName, handler) => {
                textareaVNode.data ??= {};
                textareaVNode.data.on ??= {};
                const non = (textareaVNode.data.on as any);
                if (non[eventName]) {
                    const existing = non[eventName];
                    non[eventName] = (e: Event) => {
                        try { existing(e); }
                        catch { }
                        handler(e);
                    };
                }
                else {
                    non[eventName] = handler;
                }
            },
            options
        );
    }

    static addEditingShortcuts(textarea: HTMLTextAreaElement, options: AddEditingShortcutsOptions) {
        this.addEditingShortcutsAbstract(
            (eventName, handler) => {
                textarea.addEventListener(eventName, handler);
            },
            options
        );
    }
}

interface AddEditingShortcutsOptions {
    appViewModelGetter: () => AppViewModel | null,
    activeLoginViewModelGetter?: () => ActiveLoginViewModel | null,
    channelViewModelGetter?: () => ChannelViewModel | null,
    onKeyDownHandler?: (ev: KeyboardEvent, handleShortcuts: (ev: KeyboardEvent) => boolean) => void;
    onTextChanged: (value: string) => void;
    previewPopupElement?: HTMLElement;
}

(window as any)["__bbcodeutils"] = BBCodeUtils;