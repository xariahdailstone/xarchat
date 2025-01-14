import { CharacterStatus } from "../shared/CharacterSet.js";
import { OnlineStatusConvert } from "../shared/OnlineStatus.js";
import { ChatBBCodeParser } from "../util/bbcode/BBCode.js";
import { asDisposable, IDisposable } from "../util/Disposable.js";
import { HTMLUtils } from "../util/HTMLUtils.js";
import { ResizeObserverNice } from "../util/ResizeObserverNice.js";
import { URLUtils } from "../util/URLUtils.js";
import { WhenChangeManager } from "../util/WhenChange.js";
import { ChannelViewModel } from "../viewmodel/ChannelViewModel.js";
import { ChatChannelMessageMode, ChatChannelViewModel } from "../viewmodel/ChatChannelViewModel.js";
import { ConsoleChannelViewModel } from "../viewmodel/ConsoleChannelViewModel.js";
import { PMConvoChannelViewModel } from "../viewmodel/PMConvoChannelViewModel.js";
import { ChannelDescriptionPopupViewModel } from "../viewmodel/popups/ChannelDescriptionPopupViewModel.js";
//import { ChannelHeaderFilter } from "./ChannelHeaderFilter.js";
import { ComponentBase, componentElement } from "./ComponentBase.js";
import { StatusDotLightweight } from "./StatusDot.js";

@componentElement("x-channelheader")
export class ChannelHeader extends ComponentBase<ChannelViewModel> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <x-iconimage id="elIcon" class="icon"></x-iconimage>
            <div id="elTitle" class="title">Channel Title</div>

            <div id="elOnlineStatusContainer" class="online-status-container"></div>

            <div id="elDescriptionArea" class="descriptionarea">
                <div id="elDescriptionContainer" class="descriptioncontainer">
                    <div id="elDescriptionText" class="descriptiontext"></div>
                    <div id="elDescriptionTextSizer" class="descriptiontextsizer"></div>
                </div>
                <button id="elDescriptionShowMore" class="descriptionshowmore" tabindex="-1">
                    Show Full Description...
                </button>
            </div>

            <!--
            <x-channelheaderfilter id="elFilter"></x-channelheaderfilter>
            -->

            <!--
            <div id="elFilter">
                <x-iconimage id="elFilterIcon" src="assets/ui/filter-icon.svg"></x-iconimage>
                <x-bindingselect id="elFilterDropdown" tabindex="-1" modelpath="filterMode2">
                    <option value="ads">Ads Only</option>
                    <option value="chat">Chat Only</option>
                    <option value="both">Both</option>
                </x-bindingselect>
            </div>
            -->

            <div id="elConfigIconContainer">
                <x-iconimage id="elConfigIcon" src="assets/ui/config-button.svg"></x-iconimage>
            </div>
        `);

        const elIcon = this.$("elIcon") as HTMLImageElement;
        const elTitle = this.$("elTitle") as HTMLDivElement;
        const elOnlineStatusContainer = this.$("elOnlineStatusContainer") as HTMLDivElement;
        //const elFilter = this.$("elFilter") as ChannelHeaderFilter;
        const elFilterDropdown = this.$("elFilterDropdown") as HTMLSelectElement;
        const elConfigIconContainer = this.$("elConfigIconContainer") as HTMLDivElement;
        const elDescriptionArea = this.$("elDescriptionArea") as HTMLDivElement;
        const elDescriptionText = this.$("elDescriptionText") as HTMLDivElement;
        const elDescriptionTextSizer = this.$("elDescriptionTextSizer") as HTMLDivElement;

        const elDescriptionShowMore = this.$("elDescriptionShowMore") as HTMLButtonElement;

        this.watch(".", v => {
            const elMain = this.elMain;
            elMain.classList.toggle("chatchannel", (v instanceof ChatChannelViewModel));
            elMain.classList.toggle("pmconvo", (v instanceof PMConvoChannelViewModel));
        });
        this.watch("iconUrl", v => {
            elIcon.src = v ? v : URLUtils.getEmptyImageUrl();
        });
        this.watch("title", v => {
            elTitle.innerText = v ? v : "(none)";
        });
        this.watch("messageMode", v => {
            let mode: string;
            switch (v) {
                case ChatChannelMessageMode.ADS_ONLY:
                    mode = "ads";
                    break;
                case ChatChannelMessageMode.CHAT_ONLY:
                    mode = "chat";
                    break;
                case ChatChannelMessageMode.BOTH:
                    mode = "both";
                    break;
                default:
                    mode = "none";
                    break;
            }
            //elFilter.setAttribute("data-messagemode", mode);
        });

        // this.watchExpr(vm => vm.filterOptions, fo => {
        //     elFilter.viewModel = fo ?? null;
        // });

        let pastDescription: IDisposable | null = null;
        const setDescription = (rawDescStr: string) => {
            if (pastDescription) {
                pastDescription.dispose();
                pastDescription = null;
            }
            const trimmedRawDescStr = rawDescStr.trim();
            const lfPos = trimmedRawDescStr.indexOf("\n");
            const strippedDescStr = lfPos != -1 ? trimmedRawDescStr.substring(0, lfPos) : trimmedRawDescStr;

            const strippedDescx = ChatBBCodeParser.parse(strippedDescStr, { 
                sink: this.viewModel!.activeLoginViewModel.bbcodeSink
            });
            while (elDescriptionText.firstElementChild) { elDescriptionText.firstElementChild.remove(); }
            elDescriptionText.appendChild(strippedDescx.element);

            const fullDescx = ChatBBCodeParser.parse(rawDescStr, {
                sink: this.viewModel!.activeLoginViewModel.bbcodeSink
            });
            while (elDescriptionTextSizer.firstElementChild) { elDescriptionTextSizer.firstElementChild.remove(); }
            elDescriptionTextSizer.appendChild(fullDescx.element);

            elDescriptionShowMore.setAttribute("data-expandto", rawDescStr);

            pastDescription = asDisposable(() => {
                elDescriptionShowMore.removeAttribute("data-expandto");
                strippedDescx.dispose();
                fullDescx.dispose();
            });
        };

        //const parsedBBCodeWCM = new WhenChangeManager();
        this.watchExpr(vm => (vm as any).description, v => {
            const rawDescStr = v ? v : "";
            setDescription(rawDescStr);
        });
        // this.watch("description", v => {
        //     const vm = this.viewModel;
        //     parsedBBCodeWCM.assign({ description: v, viewModel: vm }, () => {
        //         if (this.viewModel instanceof ChatChannelViewModel || this.viewModel instanceof ConsoleChannelViewModel) {
        //             const rawDescStr = v ? v : "";
        //             setDescription(rawDescStr);
        //         }
        //     });
        // });

        this.watch("character", v => {
            if (this.viewModel instanceof PMConvoChannelViewModel && v) {
                HTMLUtils.assignStaticHTMLFragment(elOnlineStatusContainer, `<div class="online-status-dot-container" id="elDotContainer"></div><div class="online-status-text" id="elStatusText"></div>`);
                const elDotContainer = this.$("elDotContainer") as HTMLDivElement;
                const elStatusText = this.$("elStatusText") as HTMLDivElement;

                const sdl = new StatusDotLightweight();
                elDotContainer.appendChild(sdl.element);

                const updateText = (cs: CharacterStatus) => {
                    setDescription(cs.statusMessage);
                    elStatusText.innerText = OnlineStatusConvert.toString(cs.status);
                    sdl.status = cs.status;
                };

                const characterWatch = this.viewModel.parent.characterSet.addStatusListenerDebug(
                    ["ChannelHeader.character.statusText", this.viewModel, v],
                    v, cs => {
                    updateText(cs);
                });
                updateText(this.viewModel.parent.characterSet.getCharacterStatus(v));

                this.elMain.classList.add("is-character");

                return asDisposable(sdl, characterWatch, () => { 
                    HTMLUtils.clearChildren(elOnlineStatusContainer);
                    this.elMain.classList.remove("is-character");
                });
            }
        });
        this.watchExpr(vm => vm.showConfigButton, (showConfigButton) => {
            elConfigIconContainer.classList.toggle("hidden", !showConfigButton);
        });

        // let assigningFilterMode = false;
        // this.watch("filterMode", v => {
        //     let selectIndex: number;
        //     switch (v) {
        //         case ChatChannelMessageMode.ADS_ONLY:
        //             selectIndex = 0;
        //             break;
        //         case ChatChannelMessageMode.CHAT_ONLY:
        //             selectIndex = 1;
        //             break;
        //         case ChatChannelMessageMode.BOTH:
        //             selectIndex = 2;
        //             break;
        //         default:
        //             selectIndex = 0;
        //             break;
        //     }
        //     assigningFilterMode = true;
        //     elFilterDropdown.selectedIndex = selectIndex;
        //     assigningFilterMode = false;
        // });

        // elFilterDropdown.addEventListener("change", () => {
        //     if (assigningFilterMode) { return; }

        //     const vm = this.viewModel;
        //     if (!vm) { return; }
        //     if (vm instanceof ChatChannelViewModel && vm.filterMode !== undefined) {
        //         let assignValue: ChatChannelMessageMode;
        //         switch (elFilterDropdown.selectedIndex) {
        //             case 0:
        //                 assignValue = ChatChannelMessageMode.ADS_ONLY;
        //                 break;
        //             case 1:
        //                 assignValue = ChatChannelMessageMode.CHAT_ONLY;
        //                 break;
        //             default:
        //             case 2:
        //                 assignValue = ChatChannelMessageMode.BOTH;
        //                 break;
        //         }
        //         vm.filterMode = assignValue;
        //     }
        // });

        this.whenConnected(() => {
            const rm = new ResizeObserverNice(() => {
                this.checkDescriptionSizeNow();
            });
            rm.observe(elDescriptionText);
            rm.observe(elDescriptionTextSizer);
            return asDisposable(() => {
                rm.disconnect();
            });
        });

        this.$("elDescriptionShowMore")!.addEventListener("click", () => {
            const vm = this.viewModel;
            if (vm) {
                if (elDescriptionShowMore.hasAttribute("data-expandto")) {
                    const popup = new ChannelDescriptionPopupViewModel(vm.appViewModel);
                    popup.description = elDescriptionShowMore.getAttribute("data-expandto")!;
                    popup.popFromElement = elDescriptionArea;
                    vm.appViewModel.popups.push(popup);
                }
            }
        });

        elConfigIconContainer.addEventListener("click", () => {
            if (this.viewModel) {
                this.viewModel.showSettingsDialogAsync();
            }
        });
    }

    private _checkDescSizeHandle: number | null = null;

    private checkDescriptionSize() {
        if (this._checkDescSizeHandle != null) { return; }

        this._checkDescSizeHandle = window.requestAnimationFrame(() => {
            this._checkDescSizeHandle = null;
            this.checkDescriptionSizeNow();
        });
    }

    private checkDescriptionSizeNow() {
        const elDescriptionText = this.$("elDescriptionText") as HTMLDivElement;
        const elDescriptionTextSizer = this.$("elDescriptionTextSizer") as HTMLDivElement;
        
        const needOverflow = (elDescriptionText.offsetWidth != elDescriptionTextSizer.offsetWidth ||
            elDescriptionText.offsetHeight != elDescriptionTextSizer.offsetHeight);

        this.$("elDescriptionShowMore")!.classList.toggle("shown", needOverflow);
    }
}
