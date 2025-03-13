import { FastEventSource } from "../../util/FastEventSource";
import { HTMLUtils } from "../../util/HTMLUtils";
import { setStylesheetAdoption } from "../../util/StyleSheetPolyfill";
import { AppViewModel } from "../../viewmodel/AppViewModel";
import { LogSearchDate, SearchDate } from "../../viewmodel/LogSearchViewModel";
//import { LogSearchDateSelectionPopupViewModel } from "../viewmodel/popups/LogSearchDateSelectionPopupViewModel";
import { StyleLoader, componentArea, componentElement } from "../ComponentBase";

const dtfWithDate = new Intl.DateTimeFormat(undefined, { dateStyle: "long", timeStyle: "long" });

@componentArea("newlogsearch")
@componentElement("x-logsearchdateinput")
export class LogSearchDateInput extends HTMLElement {

    constructor() {
        super();

        const sroot = this.attachShadow({ mode: 'closed' });
        this._sroot = sroot
        HTMLUtils.assignStaticHTMLFragment(sroot, `
            <button style="display: none;" class="theme-button nowtext" id="elButton">
                <span id="elNowText">Now</span>
                <span id="elDateText">00/00/0000 00:00:00 AM</span>
            </button>
        `);

        (async () => {
            const css = await StyleLoader.loadAsync("styles/components/newlogsearch/LogSearchDateInput.css");
            //(sroot as any).adoptedStyleSheets = [ css ];
            setStylesheetAdoption(sroot, [ css ]);
            this.elButton.style.removeProperty("display");
        })();

        this.elDateText.innerText = this.dateToString(new Date());
        this.elButton.addEventListener("click", async () => {
            this.elButton.classList.toggle("popupshown", true);
            try {
                // const newValue = await this.showSelectionPopupAsync(this.value);
                // if (newValue != null) {
                //     this.value = newValue;
                // }
            }
            finally {
                this.elButton.classList.toggle("popupshown", false);
            }
        });

        this._fastEventSource = new FastEventSource([ "valuechanged" ], this);
    }

    private readonly _fastEventSource: FastEventSource;

    private readonly _sroot: ShadowRoot;

    private _appViewModel: (AppViewModel | null) = null;
    private _value: LogSearchDate = SearchDate.Now;

    private get elButton(): HTMLButtonElement { return this._sroot.getElementById("elButton") as HTMLButtonElement; }
    private get elNowText(): HTMLSpanElement { return this._sroot.getElementById("elNowText") as HTMLSpanElement; }
    private get elDateText(): HTMLSpanElement { return this._sroot.getElementById("elDateText") as HTMLSpanElement; }

    get appViewModel(): AppViewModel | null { return this._appViewModel; }
    set appViewModel(value: AppViewModel | null) { this._appViewModel = value; }

    get value(): LogSearchDate { return this._value; }

    set value(v: LogSearchDate) { 
        if (v != this._value) {
            this._value = v;
            this.onValueChanged(v);
        }
    }

    private onValueChanged(v: LogSearchDate) {
        const elButton = this.elButton;
        const vIsDate = v instanceof Date;

        elButton.classList.toggle("nowtext", (v === SearchDate.Now));
        elButton.classList.toggle("datetext", vIsDate);
        if (vIsDate) {
            this.elDateText.innerText = this.dateToString(v);
        }

        this.dispatchEvent(new Event("valuechanged"));
    }

    private dateToString(dt: Date) {
        const result = dtfWithDate.format(dt);
        return result;
    }

    // disconnectedFromDocument() {
    //     if (this._selectionPopup) {
    //         this._selectionPopup.dismissed();
    //     }
    // }

    // private _selectionPopup: LogSearchDateSelectionPopupViewModel | null = null;
    // async showSelectionPopupAsync(curValue: LogSearchDate): Promise<LogSearchDate | null> {
    //     if (this._appViewModel && !this._selectionPopup) {
    //         const popupVm = new LogSearchDateSelectionPopupViewModel(this._appViewModel, this, curValue);
    //         this._selectionPopup = popupVm;
    //         try {
    //             this._appViewModel.popups.push(popupVm);
    //             await popupVm.waitForDismissalAsync();
    //             return popupVm.value;
    //         }
    //         finally {
    //             this._selectionPopup = null;
    //         }
    //     }
    //     else {
    //         return null;
    //     }
    // }
}