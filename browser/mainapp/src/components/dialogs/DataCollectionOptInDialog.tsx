import { jsx, Fragment, VNode } from "../../snabbdom/index";
import { VNodeUtils } from "../../util/VNodeUtils";
import { DataCollectionOptInDialogViewModel } from "../../viewmodel/dialogs/DataCollectionOptInDialogViewModel";
import { componentArea, componentElement } from "../ComponentBase";
import { makeRenderingComponent, RenderArguments } from "../RenderingComponentBase";
import { ThemeToggle } from "../ThemeToggle";
import { DialogComponentBase, dialogViewFor } from "./DialogFrame";

@componentArea("dialogs")
@componentElement("x-datacollectionoptindialog")
@dialogViewFor(DataCollectionOptInDialogViewModel)
export class DataCollectionOptInDialog extends DialogComponentBase<DataCollectionOptInDialogViewModel> {
    constructor() {
        super();

        makeRenderingComponent(this, {
            render: (e) => this.render(e)
        });
    }    

    render(args: RenderArguments): VNode {
        const vm = this.viewModel;
        if (!vm) { return VNodeUtils.createEmptyFragment(); }

        const result = <>
            <h1>Review New Settings</h1>
            <div classList={[ "dialog-description" ]}>
                <div classList={["dialog-description-p"]}>
                    New settings have been added in this version of XarChat that you should review. <b>These settings control sharing of
                    data with xariah.net to improve the eicon index and XarChat, so please look them over.</b> All new data sharing settings
                    are off by default.  You can turn them on below to help make eicon search and XarChat better for everyone.
                </div>
                <div classList={["dialog-description-p"]}>
                    These settings can be changed in the future by going into XarChat global settings.
                </div>
            </div>
            <div classList={[" reviewitems-bulk-buttons" ]}>
                <button classList={[ "themed", "disable-button" ]} on={{
                    "click": () => vm.disableAll()
                }}>Disable All</button>
                <button classList={[ "themed", "enable-button" ]} on={{
                    "click": () => vm.enableAll()
                }}>Enable All</button>
            </div>
            <div classList={[ "reviewitems-container" ]}>
                {vm.reviewItems.map(reviewItem => 
                    <div classList={[ "reviewitem" ]}>
                        <div classList={[ "reviewitem-title" ]}>{reviewItem.title}</div>
                        <div classList={[ "reviewitem-description" ]}>{reviewItem.description}</div>
                        <div classList={[ "reviewitem-moreinfo" ]}>{reviewItem.moreInfo}</div>

                        <div classList={[ "reviewitem-input" ]}>
                            <x-themetoggle props={{ "value": reviewItem.enabled }} on={{
                                "change": (e) => { reviewItem.enabled = (e.target as ThemeToggle).value; }
                            }}></x-themetoggle>
                        </div>
                    </div>
                )}
            </div>
        </>;

        return result;
    }
}