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
    static pasteWithAutoUrlization(origText: string, selStart: number, selEnd: number, pasteText: string) {
        if (BBCodeUtils.isPastedUrl(pasteText)) {
            if (BBCodeUtils.isCursorAtAutoUrlLocation(origText, selStart)) {
                pasteText = `[url]${pasteText}[/url]`;
            }
        }
    
        const resText = origText.substring(0, selStart) + pasteText + origText.substring(selEnd);
        return { newText: resText, newSelStart: selStart + pasteText.length, newSelEnd: selStart + pasteText.length };
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
            const avm = options.appViewModelGetter();
            if (!!(avm?.getConfigSettingById("autoUrlPaste"))) {
               let pasteText = ev.clipboardData?.getData("text") ?? "";
                if (pasteText != "") {
                    const selStart = textarea.selectionStart;
                    const selEnd = textarea.selectionEnd;

                    const res = BBCodeUtils.pasteWithAutoUrlization(textarea.value, selStart, selEnd, pasteText);
                    textarea.setSelectionRange(0, textarea.value.length, "forward");
                    document.execCommand("insertText", false, res.newText);
                    textarea.setSelectionRange(res.newSelStart, res.newSelEnd, "forward");
                    options.onTextChanged(textarea.value);
                    ev.preventDefault();
                }
            }
        });
    }
}

interface AddEditingShortcutsOptions {
    appViewModelGetter: () => AppViewModel | null,
    onKeyDownHandler?: (ev: KeyboardEvent, handleShortcuts: (ev: KeyboardEvent) => boolean) => void;
    onTextChanged: (value: string) => void;
}

(window as any)["__bbcodeutils"] = BBCodeUtils;