import { OnlineStatusConvert } from "../../shared/OnlineStatus";
import { ChatBBCodeParser } from "../../util/bbcode/BBCode";
import { BBCodeUtils } from "../../util/BBCodeUtils";
import { asDisposable } from "../../util/Disposable";
import { HTMLUtils } from "../../util/HTMLUtils";
import { KeyCodes } from "../../util/KeyCodes";
import { CharacterStatusEditDialogViewModel } from "../../viewmodel/dialogs/CharacterStatusEditDialogViewModel";
import { componentArea, componentElement } from "../ComponentBase";
import { DialogComponentBase, dialogViewFor } from "./DialogFrame";

@componentArea("dialogs")
@componentElement("x-characterstatuseditdialog")
@dialogViewFor(CharacterStatusEditDialogViewModel)
export class CharacterStatusEditDialog extends DialogComponentBase<CharacterStatusEditDialogViewModel> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <div class="online-status-container">
                <div class="online-status-label">Online Status:</div>
                <select class="online-status-select" id="elOnlineStatusSelect">
                    <option>Online</option>
                    <option>Looking</option>
                    <option>Busy</option>
                    <option>Away</option>
                    <option>DND</option>
                </select>
            </div>
            <div class="status-message-editor-container">
                <textarea class="status-message-editor" id="elTextarea" data-initial-focus="true"></textarea>
                <div class="status-message-editor-charcount"><span id="elCharsUsed">0</span>/255</div>
            </div>
            <div class="status-preview-container">
                <div class="status-preview-title">Preview:</div>
                <div class="status-preview" id="elPreview"></div>
            </div>
        `);

        const elOnlineStatusSelect = this.$("elOnlineStatusSelect") as HTMLSelectElement;
        const elTextarea = this.$("elTextarea") as HTMLTextAreaElement;
        const elCharsUsed = this.$("elCharsUsed") as HTMLSpanElement;
        const elPreview = this.$("elPreview") as HTMLDivElement;

        this.watchExpr(vm => vm.statusMessage, sm => {
            if (sm) {
                elTextarea.value = sm;
                elCharsUsed.innerText = sm.length.toString();

                const parseResult = ChatBBCodeParser.parse(sm, {
                    sink: this.viewModel?.activeLoginViewModel.bbcodeSink
                });
                elPreview.appendChild(parseResult.element);
                return asDisposable(() => {
                    HTMLUtils.clearChildren(parseResult.element);
                    parseResult.dispose();
                })
            }
            else {
                elTextarea.value = "";
                elCharsUsed.innerText = "0";
            }
        });
        this.watchExpr(vm => vm.onlineStatus, onlineStatus => {
            if (onlineStatus) {
                elOnlineStatusSelect.value = OnlineStatusConvert.toString(onlineStatus);    
            }
        });

        const textareaUpdate = () => {
            const tav = elTextarea.value;
            if (this.viewModel) {
                this.viewModel.statusMessage = tav;
            }
        };
        elTextarea.addEventListener("input", () => { textareaUpdate(); });
        elTextarea.addEventListener("change", () => { textareaUpdate(); });
        BBCodeUtils.addEditingShortcuts(elTextarea, {
            appViewModelGetter: () => this.viewModel?.activeLoginViewModel.appViewModel ?? null,
            activeLoginViewModelGetter: () => this.viewModel?.activeLoginViewModel ?? null,
            onTextChanged: (v) => { textareaUpdate(); },
            onKeyDownHandler: (ev, handleShortcuts) => {
                if (ev.keyCode == 13 && ev.shiftKey) {
                    ev.stopPropagation();
                }
                else if (handleShortcuts(ev)) {
                    ev.stopPropagation();
                }
            }
        })

        // elTextarea.addEventListener("focus", () => {
        //     this._textAreaHasFocus = true;
        // });
        // elTextarea.addEventListener("blur", () => {
        //     this._textAreaHasFocus = false;
        // });
        elTextarea.addEventListener("keydown", (ev: KeyboardEvent) => {
            if (ev.keyCode == KeyCodes.RETURN && ev.shiftKey) {
                //ev.preventDefault();
                ev.stopPropagation();
            }
        });

        elOnlineStatusSelect.addEventListener("change", () => {
            if (this.viewModel != null) {
                this.viewModel.onlineStatus = OnlineStatusConvert.toOnlineStatus(elOnlineStatusSelect.value)!;
            }
        });

        this.whenConnectedWithViewModel(() => {
            elTextarea.focus();
        });
    }

    // private _textAreaHasFocus: boolean = false;

    // override shouldPreventKeyboardDefault(ev: KeyboardEvent): boolean {
    //     if (this._textAreaHasFocus) {
    //         if (ev.keyCode == KeyCodes.RETURN && ev.shiftKey) {
    //             return true;
    //         }
    //     }
    //     return false;
    // }
}