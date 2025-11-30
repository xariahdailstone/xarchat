import { GetConfigSettingChannelViewModel } from "../../../viewmodel/AppViewModel";
import { SettingsDialogSectionViewModel, SettingsDialogItemViewModel, SettingsDialogTabViewModel, SettingsDialogViewModel, ISettingsDialogItemViewModel, ISettingsDialogSettingViewModel } from "../../../viewmodel/dialogs/SettingsDialogViewModel";
import { componentArea, componentElement } from "../../ComponentBase";
import { makeRenderingComponent, RenderArguments } from "../../RenderingComponentBase";
import { DialogBorderType, DialogComponentBase, dialogViewFor } from "../DialogFrame";
import { Fragment, jsx, VNode } from "../../../snabbdom/index.js";
import { IterableUtils } from "../../../util/IterableUtils";
import { EnableIfOptions, } from "../../../configuration/ConfigSchemaItem";
import { Collection } from "../../../util/ObservableCollection";
import { getSettingsRendererFor } from "./type-renderers/SettingsTypeRenderer";
import { ConvertibleToDisposable } from "../../../util/Disposable";

@componentArea("dialogs")
@componentElement("x-settingsdialog")
@dialogViewFor(SettingsDialogViewModel)
export class SettingsDialog extends DialogComponentBase<SettingsDialogViewModel> {
    constructor() {
        super();
        makeRenderingComponent(
            this, {
                render: (args) => this.render(args)
            }
        );
    }

    override get dialogBorderType() { return DialogBorderType.FULLPAGEWITHTITLEBAR; }
    
    render(args: RenderArguments): VNode {
        const vm = this.viewModel;
        if (vm == null) {
            return <div></div>;
        }
        else {
            return <div classList={["settings-container"]}>
                <div classList={["tabstrip"]}>
                    { IterableUtils.asQueryable(vm.tabs).select(x => this.renderTab(x)).toArray() ?? "" }
                </div>
                <div classList={[ "contentarea" ]}>
                    <div classList={[ "treeview" ]}>
                        { vm.selectedTab ? this.renderTreeViewPane(vm.selectedTab.settings) : "" }
                    </div>
                    <div classList={["tabpanel"]}>
                        { vm.selectedTab ? this.renderTabPane(vm, vm.selectedTab, d => args.addDisposable(d)) : "" }
                    </div>
                </div>
            </div>;
        }
    }

    private renderTreeViewPane(settings: Collection<ISettingsDialogSettingViewModel>): VNode {
        const items: VNode[] = [];

        for (let settingsItem of settings) {
            if (!settingsItem.isItem) {
                items.push(<div classList={[ "treeview-item", "treeview-item-group" ]}>
                    <div classList={[ "treeview-item-group-title"]} on={{
                        "click": () => {
                            this.scrollToSection(settingsItem.title);
                        }
                    }}>{settingsItem.title}</div>
                    { this.renderTreeViewPane(settingsItem.settings) }
                </div>);
            }
        }

        return <div classList={[ "treeview-item-group-items"]}>{items}</div>;
    }

    private scrollToSection(title: string) {
        const tabpane = this.elMain.querySelector(".tabpane");
        const el = this.elMain.querySelector(`*[data-sectiontitle='${title}']`);
        if (el) {
            el.scrollIntoView({ behavior: "smooth" });
        }
    }

    private renderTab(tab: SettingsDialogTabViewModel): VNode {
        return <div classList={{"tabstrip-tab": true, "selected": tab.parent.selectedTab == tab }}
                on={{ "click": () => { tab.select(); } }}>
            <div classList={["tabstrip-tab-title"]}>{tab.tabTitle}</div>
        </div>;
    }

    private renderTabPane(vm: SettingsDialogViewModel, tab: SettingsDialogTabViewModel, addDisposable: (d: ConvertibleToDisposable) => void): VNode {
        return <div classList={["tabpane", "tabpane-standard"]}>
            <div classList={["tabpane-description"]}>{ tab.tabInstructions }</div>
            { IterableUtils.asQueryable(tab.settings).select(x => this.renderSetting(vm, x, addDisposable)).toArray() }
        </div>;
    }

    private renderSetting(vm: SettingsDialogViewModel, setting: ISettingsDialogSettingViewModel, addDisposable: (d: ConvertibleToDisposable) => void): VNode {
        let inner: VNode;
        let actionButtonsNode: VNode | null = null;
        let settingClasses: string[] = ["setting"];

        if (setting instanceof SettingsDialogSectionViewModel) {
            settingClasses.push("setting-group");
            inner = <div classList={["setting-group-container"]}>{IterableUtils.asQueryable(setting.settings).select(x => this.renderSetting(vm, x, addDisposable)).toArray()}</div>;
        }
        else if (setting.isItem) {
            const itemSetting = setting as unknown as ISettingsDialogItemViewModel;
            settingClasses.push("setting-item");
            if (itemSetting.isReadOnly) {
                settingClasses.push("setting-item-readonly");
            }

            const typeRenderer = getSettingsRendererFor(itemSetting.schema.type);
            inner = typeRenderer.renderSetting({
                dialogViewModel: this.viewModel!,
                item: itemSetting,
                logger: this.logger,
                addDisposable: addDisposable
            });
            
            if (itemSetting.schema.actionButtons && itemSetting.schema.actionButtons.length > 0) {
                const buttonNodes: VNode[] = [];
                for (let ab of itemSetting.schema.actionButtons) {
                    const buttonNode = <button classList={[ "setting-actionbuttons-button", "themed" ]} on={{
                        "click": () => {
                            ab.onClick({
                               appViewModel: vm.parent 
                            });
                        }
                    }}>{ab.title}</button>;
                    buttonNodes.push(buttonNode);
                }
                actionButtonsNode = <div classList={[ "setting-actionbuttons" ]}>
                    { buttonNodes }
                </div>;
            }
        }
        else {
            inner = <div classList={["setting-entry"]}>Unknown Setting Type: {setting.constructor.name}</div>;
        }

        if (setting.isDisabled) {
            settingClasses.push("setting-is-disabled");
        }
        if (setting instanceof SettingsDialogItemViewModel && setting.schema.enableIf) {
            const eiFunc = setting.schema.enableIf;
            const eiOpts: EnableIfOptions = {
                myCharacterName: setting.scope.myCharacter,
                channelCategory: setting.scope.categoryName,
                channelName: setting.scope.targetChannel ?? undefined,
                interlocutorName: setting.scope.pmConvoCharacter,
                getConfigEntryById: (id: string) => {
                    let xx: GetConfigSettingChannelViewModel | undefined;
                    if (setting.scope.categoryName && setting.scope.targetChannel) {
                        xx = { channelCategory: setting.scope.categoryName, channelTitle: setting.scope.targetChannel };
                    }
                    else if (setting.scope.pmConvoCharacter) {
                        xx = { characterName: setting.scope.pmConvoCharacter };
                    }

                    return vm.parent.getConfigSettingById(id,
                        setting.scope.myCharacter ? { characterName: setting.scope.myCharacter } : null,
                        xx
                    );
                }
            };
            if (!eiFunc(eiOpts)) {
                settingClasses.push("setting-is-disabled");
            }
        }

        
        return <div classList={settingClasses} data-sectiontitle={setting.title} props={{ "inert": setting.isDisabled }}>
            <div classList={["setting-title"]}>{setting.title}</div>
            <div classList={["setting-description"]}>{setting.description}</div>
            { this.getInheritedInfoVNode(setting) }
            { inner }
            { actionButtonsNode }
        </div>;
    }

    private getInheritedInfoVNode(setting: ISettingsDialogSettingViewModel): VNode {
        if (setting.showInheritedInfo) {
            if (setting.useInheritedValue) {
                return <div classList={["setting-inheritprompt", "setting-using-inherited"]}>{setting.inheritedFromText}</div>
            }
            else {
                const ihText = setting.revertToText;
                const atatPos = ihText.indexOf("@@");
                if (atatPos == -1) {
                    return <div classList={["setting-inheritprompt", "setting-revert-to-inherited"]}>{ihText}</div>;
                }
                else {
                    const beforeText = ihText.substring(0, atatPos);
                    const afterText = ihText.substring(atatPos + 2);
                    return <div classList={["setting-inheritprompt", "setting-revert-to-inherited"]}><span>{beforeText}</span>
                            <span classList={["revert-link"]}
                                on={{ "click": (e) => { setting.revertToInherited() } }}>here</span> 
                        <span>{afterText}</span></div>
                }
            }
        }
        else {
            return <></>;
        }
    }
}