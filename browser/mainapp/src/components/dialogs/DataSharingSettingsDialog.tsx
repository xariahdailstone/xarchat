import { jsx, Fragment, VNode } from "../../snabbdom/index";
import { DataSharingSettingsViewModel } from "../../viewmodel/dialogs/DataSharingSettingsViewModel";
import { componentArea, componentElement } from "../ComponentBase";
import { DialogComponentBase, DialogFrame, dialogViewFor } from "./DialogFrame";
import { makeRenderingComponent } from "../RenderingComponentBase";
import { EmptyDisposable, IDisposable } from "../../util/Disposable";

@componentArea("dialogs")
@componentElement("x-datasharingsettings")
@dialogViewFor(DataSharingSettingsViewModel)
export class DataSharingSettingsDialog extends DialogComponentBase<DataSharingSettingsViewModel> {
    constructor() {
        super();
        
        makeRenderingComponent(this, {
            render: () => this.render()
        });
    }

    render(): [VNode, IDisposable] {
        const vm = this.viewModel;
        if (!vm) { return [<></>, EmptyDisposable] }

        const descriptionNode: VNode = vm.showingOnLogin 
            ? <div classList={[ "top-description" ]}>
                New data sharing options are available in this version of XarChat that you have not yet reviewed.  You're
                in control of your data; so please review the options below and decide whether you would like to enable
                data sharing.  You can always change your decisions later in the Settings panel.
              </div>
            : <div classList={[ "top-description" ]}>You can review and change your data sharing settings below.</div>;

        const vnode = <>
                <h1>Data Sharing Settings</h1>
                {descriptionNode}
                <div classList={[ "option-section" ]}>
                    <h2>EIcon Data Sharing</h2>
                    <p>XarChat can watch chat for eicons being used and submit information about those eicons to xariah.net
                    to improve the eicon search tool.  This data sharing includes the following information:</p>
                    <ul>
                        <li>The names of eicons seen used in chat.</li>
                        <li>Basic information about the eicon image.
                            <ul>
                                <li>
                                    The above information is used by xariah.net to determine whether an eicon should be
                                    added to, removed from, or updated in the eicon search index.
                                </li>
                            </ul>
                        </li>
                    </ul>
                    <p>The following information is explicitly <b>not</b> included in this data sharing:</p>
                    <ul>
                        <li>Any information about your F-List account.</li>
                        <li>Any information about who used the eicon.</li>
                        <li>Any information about the channel or private message conversation where the eicon was used.</li>
                        <li>Any information about the content of chat beyond the names of eicons.</li>
                    </ul>
                    {this.renderOptInOutNodes(vm.originalEiconDataSharing, vm.eiconDataSharing, (v) => { vm.eiconDataSharing = v; })};
                </div>
            </>;

        return [vnode, EmptyDisposable];
    }

    renderOptInOutNodes(originalValue: (boolean | null), currentValue: boolean, assignFunc: (newValue: boolean) => void): VNode {
        let desc: VNode;

        if (originalValue == null) {
            desc = <>
                Please choose whether you want to <b>opt in</b> or <b>opt out</b> of this data sharing below. (If you do not make
                a choice, you will be opted out by default.)</>;
        }
        else if (originalValue == true) {
            desc = <>
                You have previously <b>opted in</b> to this data sharing.  If you would like to change your decision, you can do so below.</>;
        }
        else {
            desc = <>
                You have previously <b>opted out</b> of this data sharing.  If you would like to change your decision, you can do so below.</>;
        }

        return <div classList={[ "optinout-container" ]}>
            <div classList={[ "optinout-description" ]}>{desc}</div>
            <div classList={[ "optinout-buttons" ]}>
                <button class={{
                    "optinout-button-optin": true,
                    "selected": (currentValue == true)
                }}>Opt In to this Data Sharing</button>
                <button class={{
                    "optinout-button-optout": true,
                    "selected": (currentValue == false)
                }}>Opt Out of this Data Sharing</button>
            </div>
        </div>;
    }
}