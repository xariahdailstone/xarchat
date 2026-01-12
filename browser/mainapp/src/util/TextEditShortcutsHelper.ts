import { ActiveLoginViewModel } from "../viewmodel/ActiveLoginViewModel";
import { ChannelViewModel } from "../viewmodel/ChannelViewModel";
import { MessagePreviewPopupViewModel } from "../viewmodel/popups/MessagePreviewPopupViewModel";
import { EventListenerUtil } from "./EventListenerUtil";

const CUR_POPUP_VM = Symbol();

export interface TextEditShortcutsHelperOptions {
    textarea: HTMLTextAreaElement;
    previewPopupElement?: HTMLElement;

    channelViewModelGetter?: () => ChannelViewModel | null;
    activeLoginViewModelGetter?: () => ActiveLoginViewModel | null;
};

export class TextEditShortcutsHelper {
    constructor(
        private readonly options: TextEditShortcutsHelperOptions) {
    }

    value: string = "";
    selectionAt: number = 0;
    selectionLength: number = 0;

    private getBeforeSelectionText() {
        return this.value.substr(0, this.selectionAt);
    }

    private getAfterSelectionText() {
        return this.value.substr(this.selectionAt + this.selectionLength);
    }

    private getSelectionText() {
        if (this.selectionLength == 0) {
            return "";
        }
        else if (this.selectionAt + this.selectionLength <= this.value.length) { 
            return this.value.substr(this.selectionAt, this.selectionLength);
        }
        else {
            return this.value.substr(this.selectionAt);
        }
    }

    bold() {
        this.handleContainingTags("[b]", "[/b]");
    }

    italic() {
        this.handleContainingTags("[i]", "[/i]");
    }

    underline() {
        this.handleContainingTags("[u]", "[/u]");
    }

    subscript() {
        this.handleContainingTags("[sub]", "[/sub]");
    }

    superscript() {
        this.handleContainingTags("[sup]", "[/sup]");
    }

    spoiler() {
        this.handleContainingTags("[spoiler]", "[/spoiler]");
    }

    strikethrough() {
        this.handleContainingTags("[s]", "[/s]");
    }

    user() {
        this.handleContainingTags("[user]", "[/user]");
    }

    icon() {
        this.handleContainingTags("[icon]", "[/icon]");
    }

    eicon(name?: string) {
        if (name) {
            this.writeToSelection(`[eicon]${name}[/eicon]`);
        }
        else {
            this.handleContainingTags("[eicon]", "[/eicon]");
        }
    }

    noparse() {
        this.handleContainingTags("[noparse]", "[/noparse]");
    }

    color(colorName?: string) {
        if (colorName) {
            this.handleContainingTags(`[color=${colorName}]`, "[/color]");
        }
        else {
            this.handleContainingTags(`[color=]`, "[/color]");
        }
    }

    url(href?: string) {
        if (href) {
            this.handleContainingTags(`[url=${href}]`, "[/url]");
        }
        else {
            this.handleContainingTags(`[url=]`, "[/url]");
        }
    }

    showPreview() {
        const textarea = this.options.textarea;
        const curPopup = (textarea as any)[CUR_POPUP_VM] as (MessagePreviewPopupViewModel | undefined);
        if (!curPopup) {
            const cvm = this.options.channelViewModelGetter ? this.options.channelViewModelGetter() : null;
            const alvm = cvm ? cvm.activeLoginViewModel : (this.options.activeLoginViewModelGetter ? this.options.activeLoginViewModelGetter() : null);
            if (alvm) {
                const pu = new MessagePreviewPopupViewModel(cvm, alvm, this.options.previewPopupElement ?? textarea);
                (textarea as any)[CUR_POPUP_VM] = pu;
                pu.rawText = textarea.value;
                alvm.appViewModel.popups.push(pu);
                const hinput = EventListenerUtil.addDisposableEventListener(textarea, "input", () => { pu.dismissed(); });
                const hblur = EventListenerUtil.addDisposableEventListener(textarea, "blur", () => { pu.dismissed(); });
                const hkeydown = EventListenerUtil.addDisposableEventListener(textarea, "keydown", () => { pu.dismissed(); });
                (async () => {
                    await pu.waitForDismissalAsync();
                    delete (textarea as any)[CUR_POPUP_VM];
                    hinput.dispose();
                    hblur.dispose();
                    hkeydown.dispose();
                })();
            }
        }
        else {
            curPopup.dismissed();
        }
    }

    private insensitiveStartsWith(haystack: string, needle: string) {
        return (haystack.toLowerCase().startsWith(needle.toLowerCase()));
    }

    private insensitiveEndsWith(haystack: string, needle: string) {
        return (haystack.toLowerCase().endsWith(needle.toLowerCase()));
    }

    private writeToSelection(text: string) {
        const beforeSelText = this.getBeforeSelectionText();
        const afterSelText = this.getAfterSelectionText();

        const newText = beforeSelText + text + afterSelText;

        this.value = newText;
        this.selectionAt = beforeSelText.length + text.length;
        this.selectionLength = 0;
    }

    private handleContainingTags(openTag: string, closeTag: string) {
        const beforeSelText = this.getBeforeSelectionText();
        const afterSelText = this.getAfterSelectionText();
        const oldSelText = this.getSelectionText();

        const oldSelAt = this.selectionAt;
        const oldSelLen = this.selectionLength;

        if (this.selectionLength == 0) {
            let newText: string;
            let newSelectionAt: number;
            if (this.insensitiveStartsWith(afterSelText, closeTag)) {
                if (this.insensitiveEndsWith(beforeSelText, openTag)) {
                    newText = beforeSelText.substr(0, beforeSelText.length - openTag.length) + afterSelText.substr(closeTag.length);
                    newSelectionAt = oldSelAt - openTag.length;
                }
                else {
                    newText = beforeSelText + afterSelText;
                    newSelectionAt = oldSelAt + closeTag.length;
                }
            }
            else if (this.insensitiveEndsWith(beforeSelText, openTag) && this.insensitiveStartsWith(afterSelText, closeTag)) {
                newText = beforeSelText.substr(0, beforeSelText.length - openTag.length) + afterSelText.substr(closeTag.length);
                newSelectionAt = oldSelAt - openTag.length;
            }
            else {
                newText = beforeSelText + openTag + closeTag + afterSelText;
                newSelectionAt = oldSelAt + openTag.length;
            }

            this.value = newText;
            this.selectionAt = newSelectionAt;
            this.selectionLength = 0;
        }
        else {
            let newText: string;
            let newSelectionAt: number;
            let newSelectionLength: number;

            if (this.insensitiveEndsWith(beforeSelText, openTag) && this.insensitiveStartsWith(afterSelText, closeTag)) {
                newText = beforeSelText.substr(0, beforeSelText.length - openTag.length) + oldSelText + afterSelText.substr(closeTag.length);
                newSelectionAt = oldSelAt - openTag.length;
                newSelectionLength = oldSelLen;
            }
            else if (this.insensitiveStartsWith(oldSelText, openTag) && this.insensitiveEndsWith(oldSelText, closeTag)) {
                newText = beforeSelText + oldSelText.substr(openTag.length, oldSelText.length - (openTag.length + closeTag.length)) + afterSelText;
                newSelectionAt = oldSelAt;
                newSelectionLength = oldSelLen - (openTag.length + closeTag.length);
            }
            else {
                newText = beforeSelText + openTag + oldSelText + closeTag + afterSelText;
                newSelectionAt = oldSelAt;
                newSelectionLength = oldSelLen + openTag.length + closeTag.length;
            }

            this.value = newText;
            this.selectionAt = newSelectionAt;
            this.selectionLength = newSelectionLength;
        }
    }
}