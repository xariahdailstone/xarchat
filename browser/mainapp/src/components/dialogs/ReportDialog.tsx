import { jsx, Fragment, VNode } from "../../snabbdom/index";
import { asDisposable, EmptyDisposable, IDisposable } from "../../util/Disposable";
import { VNodeUtils } from "../../util/VNodeUtils";
import { ReportSource, ReportViewModel } from "../../viewmodel/dialogs/ReportViewModel";
import { PMConvoChannelViewModel } from "../../viewmodel/PMConvoChannelViewModel";
import { componentArea, componentElement } from "../ComponentBase";
import { makeRenderingComponent } from "../RenderingComponentBase";
import { DialogComponentBase, dialogViewFor } from "./DialogFrame";

@componentElement("x-reportdialog")
@componentArea("dialogs")
@dialogViewFor(ReportViewModel)
export class ReportDialog extends DialogComponentBase<ReportViewModel> {
    constructor() {
        super();

        makeRenderingComponent(this, {
            render: () => this.render()
        });
    }

    private render(): [VNode, IDisposable] {
        const disposables: IDisposable[] = [];
        const vm = this.viewModel;
        if (!vm) {
            return [VNodeUtils.createEmptyFragment(), EmptyDisposable];
        }

        const addDisposable = (d: IDisposable) => disposables.push(d);

        let reportInfoText: VNode;
        if (vm.targetChannel && vm.targetCharacter) {
            if (vm.targetChannel instanceof PMConvoChannelViewModel) {
                reportInfoText = <>
                    <div classList={[ "info-text" ]}>
                        You are filing a report on the character <b>{vm.targetCharacter.value}</b>. 
                    </div>
                    <div classList={[ "info-text-okay" ]}>
                        The messages that are currently visible in the <b>{vm.targetChannel.title}</b> private messages tab will be included in the report.
                    </div>
                </>;
            }
            else {
                reportInfoText = <>
                    <div classList={[ "info-text" ]}>
                        You are filing a report on the character <b>{vm.targetCharacter.value}</b>. 
                    </div>
                    <div classList={[ "info-text-okay" ]}>
                        The messages that are currently visible in the <b>{vm.targetChannel.title}</b> channel tab will be included in the report.
                    </div>
                </>;
            }
        }
        else if (vm.targetChannel) {
            reportInfoText = <>
                <div classList={[ "info-text" ]}>
                    You are filing a report for the channel <b>{vm.targetChannel.title}</b>; but not for any specific character.
                </div>
                <div classList={[ "info-text-okay" ]}>
                    The messages that are currently visible in the channel tab will be included in the report.
                </div>
            </>;
        }
        else if (vm.targetCharacter) {
            let reportWhat = "a general report for the character";
            // if (vm.reportSource == ReportSource.PROFILE_DIALOG) {
            //     reportWhat = "a report about the profile of the character";
            // }

            reportInfoText = <>
                <div classList={[ "info-text" ]}>
                    You are filing {reportWhat} <b>{vm.targetCharacter.value}</b>.  
                </div>
                <div classList={[ "info-text-warning" ]}>
                    No chat logs will be included in this report. If you need to include some message logs from this
                    character with your report, you should instead submit the report from the channel tab that contains
                    the messages you want to report by right-clicking the character's name and choosing 'Report' from
                    the character popup.
                </div>
            </>;
        }
        else {
            reportInfoText = <>
                <div classList={[ "info-text" ]}>
                    You are filing a general report.
                </div>
                <div classList={[ "info-text-warning" ]}>
                    No chat logs will be included in this report. If you need to include some message logs from a
                    character or channel with your report, you should instead submit the report from the tab that contains
                    the messages you want to report by right-clicking the character's name or channel name and choosing
                    'Report' from the popup.
                </div>
            </>;
        }

        const reportTextChange = (e: Event) => {
            const target = e.target as HTMLTextAreaElement;
            const elValue = target.value;
            if (elValue != vm.reportText) {
                vm.reportText = elValue;
            }
        };

        const r = <div class={{ "report-container": true, "is-submitting": vm.submitting }}>
            <div classList={[ "report-info" ]}>{reportInfoText}</div>
            <div classList={[ "report-text-container" ]}>
                <div classList={[ "report-text-container-title" ]}>Why are you filing this report?</div>
                <textarea classList={[ "report-text-container-textarea" ]} props={{ "value": vm.reportText }} on={{
                    "input": reportTextChange,
                    "change": reportTextChange
                }}></textarea>
            </div>
        </div>

        return [r, asDisposable(...disposables)];
    }
}