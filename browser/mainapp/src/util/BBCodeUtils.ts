import { AppViewModel } from "../viewmodel/AppViewModel";
import { EIconSearchDialogViewModel } from "../viewmodel/dialogs/EIconSearchDialogViewModel";
import { ChatBBCodeParser } from "./bbcode/BBCode";
import { KeyCodes } from "./KeyCodes";
import { TextEditShortcutsHelper } from "./TextEditShortcutsHelper";

const urlPattern = new RegExp(/(.*?)(http(s)?\:\/\/(\S+))/, "ig");

function tryHandleEditShortcutKey(textarea: HTMLTextAreaElement, ev: KeyboardEvent, options: AddEditingShortcutsOptions) {
    if (ev.ctrlKey) {
        const tesh = new TextEditShortcutsHelper();
        tesh.value = textarea.value;
        tesh.selectionAt = Math.min(textarea.selectionStart, textarea.selectionEnd)
        tesh.selectionLength = Math.abs(textarea.selectionEnd - textarea.selectionStart);

        let loadBack = false;

        switch (ev.keyCode) {
            case KeyCodes.KEY_B:
                tesh.bold();
                loadBack = true;
                break;
            case KeyCodes.KEY_E:
                // tesh.eicon();
                const avm = options.appViewModelGetter();
                if (avm) {
                    loadBack = true;
                    (async () => {
                        const pdialog = new EIconSearchDialogViewModel(avm);
                        const dlgResult = await avm.showDialogAsync(pdialog);
                        if (dlgResult) {
                            tesh.eicon(dlgResult);
                            textarea.value = tesh.value;
                            textarea.setSelectionRange(tesh.selectionAt, tesh.selectionAt + tesh.selectionLength);
                            options.onTextChanged(textarea.value);
                        }
                        textarea.focus();
                    })();
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
                tesh.superscript();
                loadBack = true;
                break;
            case KeyCodes.DOWN_ARROW:
                tesh.subscript();
                loadBack = true;
                break;
            case KeyCodes.KEY_K:
                tesh.spoiler();
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
    static autoWrapUrls(str: string): string {
        const tokens = ChatBBCodeParser.tokenize(str);

        let inUrlCount = 0;
        for (let tok of tokens) {
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
                if (inUrlCount == 0) {
                    const resultBuilder: string[] = [];
                    let charsConsumed = 0;
                    for (let m of [...tok.text!.matchAll(urlPattern)]) {
                        const allMatchText = m[0];
                        const beforeText = m[1];
                        let urlText = m[2];
                        let afterText = "";

                        charsConsumed += allMatchText.length;
                        if (urlText.endsWith(".") || urlText.endsWith("?") || urlText.endsWith("!") || urlText.endsWith(",")) {
                            afterText = urlText.charAt(urlText.length - 1);
                            urlText = urlText.substring(0, urlText.length - 1);
                        }
                        resultBuilder.push(beforeText);
                        resultBuilder.push("[url]");
                        resultBuilder.push(urlText);
                        resultBuilder.push("[/url]");
                        resultBuilder.push(afterText);
                    }
                    resultBuilder.push(tok.text!.substring(charsConsumed));
                    tok.text = resultBuilder.join("");
                }
            }
        }

        const finalResultBuilder: string[] = [];
        for (let tok of tokens) {
            if (tok.type == "text") {
                finalResultBuilder.push(tok.text!);
            }
            else {
                finalResultBuilder.push(tok.tagOrig!);
            }
        }
        return finalResultBuilder.join("");
    }

    static addEditingShortcuts(textarea: HTMLTextAreaElement, options: AddEditingShortcutsOptions) {
        if (!(options?.onKeyDownHandler)) {
            options.onKeyDownHandler = (ev, handleShortcuts) => {
                handleShortcuts(ev);
            }
        }
        else {
            textarea.addEventListener("keydown", (ev) => {
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
        }
        textarea.addEventListener("paste", (ev: ClipboardEvent) => {
            let pasteText = ev.clipboardData?.getData("text") ?? "";
            pasteText = BBCodeUtils.autoWrapUrls(pasteText);
            
            const selStart = textarea.selectionStart;
            const selEnd = textarea.selectionEnd;
            let v = textarea.value.substring(0, selStart) +
                pasteText +
                textarea.value.substring(selEnd);
            document.execCommand("insertText", false, pasteText);
            textarea.setSelectionRange(selStart + pasteText.length, selStart + pasteText.length, "forward");
            options.onTextChanged(textarea.value);

            ev.preventDefault();
        });
    }
}

interface AddEditingShortcutsOptions {
    appViewModelGetter: () => AppViewModel | null,
    onKeyDownHandler?: (ev: KeyboardEvent, handleShortcuts: (ev: KeyboardEvent) => boolean) => void;
    onTextChanged: (value: string) => void;
}

(window as any)["__bbcodeutils"] = BBCodeUtils;