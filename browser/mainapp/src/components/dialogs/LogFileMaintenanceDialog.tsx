import { Attrs } from "../../../node_modules/snabbdom/build/index";
import { jsx, Fragment, VNode, On } from "../../snabbdom/index"
import { CancellationToken } from "../../util/CancellationTokenSource";
import { StringUtils } from "../../util/StringUtils";
import { VNodeUtils } from "../../util/VNodeUtils";
import { LogFileMaintenanceDialogViewModel } from "../../viewmodel/dialogs/LogFileMaintenanceDialogViewModel";
import { componentArea, componentElement } from "../ComponentBase";
import { makeRenderingComponent, RenderArguments } from "../RenderingComponentBase";
import { DialogComponentBase, DialogFrame, dialogViewFor } from "./DialogFrame";

@componentArea("dialogs")
@componentElement("x-logfilemaintenancedialog")
@dialogViewFor(LogFileMaintenanceDialogViewModel)
export class LogFileMaintenanceDialog extends DialogComponentBase<LogFileMaintenanceDialogViewModel> {
    constructor() {
        super();

        makeRenderingComponent(this, {
            render: (ra) => this.render(ra)
        })
    }

    render(renderArgs: RenderArguments): VNode {
        if (!this.viewModel) { return VNodeUtils.createEmptyFragment(); }
        const vm = this.viewModel;

        const vacuumButtonAttrs: Attrs = {};
        const vacuumButtonOn: On = {};
        if (vm.isVacuuming || vm.isClearing) {
            vacuumButtonAttrs["disabled"] = "disabled";
        }
        else {
            vacuumButtonOn["click"] = (e: MouseEvent) => {
                vm.vacuumAsync(CancellationToken.NONE);
            };
        }
        const vacuumButtonText = vm.isVacuuming
            ? <div classList={["vacuum-button-content"]}><x-iconimage classList={[ "vacuum-icon" ]} attr-src="assets/ui/loading-anim.svg"></x-iconimage> Compaction In Progress...</div>
            : <>Compact Log File</>;
        const vacuumButton = <button class={{
                        "group-vacuum-button": true, 
                        "themed": true
                    }} attrs={vacuumButtonAttrs} on={vacuumButtonOn}>{vacuumButtonText}</button>

        const clearButtonAttrs: Attrs = {};
        const clearButtonOn: On = {};
        if (vm.isVacuuming || vm.isClearing) {
            clearButtonAttrs["disabled"] = "disabled";
        }
        else {
            clearButtonOn["click"] = (e: MouseEvent) => {
                vm.clearDatabaseAsync(CancellationToken.NONE);
            };
        }
        const clearButtonText = vm.isClearing
            ? <div classList={["cleardatabase-button-content"]}><x-iconimage classList={[ "cleardatabase-icon" ]} attr-src="assets/ui/loading-anim.svg"></x-iconimage> Clearing Log File...</div>
            : <>Clear Log File</>;

        const clearButton = <button class={{
                "group-cleardatabase-button": true,
                "themed": true
            }} attrs={clearButtonAttrs} on={clearButtonOn}>{clearButtonText}</button>;

        return <>
            <div classList={["groupbox", "group-logfilesize" ]}>
                <div classList={["groupbox-title"]}>Log File Size</div>
                <div classList={["groupbox-content"]}>
                    
                    <div classList={[ "group-logfilesize-label" ]}>File Size:</div>
                    <div classList={[ "group-logfilesize-value" ]}>{StringUtils.numberToApproximateFileSize(vm.logFileSize)}</div>

                </div>
            </div>

            <div classList={["groupbox", "group-vacuum" ]}>
                <div classList={["groupbox-title"]}>Compact Log File</div>
                <div classList={["groupbox-content"]}>
                    
                    <div classList={[ "group-vacuum-description" ]}>
                        You can compact the log file, which may make the log file smaller by removing
                        unused space within the file.  This operation requires approximately enough free
                        disk space as the current log file size; and may take some time to complete if your
                        log file is very large.
                    </div>
                    
                    {vacuumButton}
                </div>
            </div>

            <div classList={["groupbox", "group-cleardatabase" ]}>
                <div classList={["groupbox-title"]}>Clear Log File</div>
                <div classList={["groupbox-content"]}>
                    
                    <div classList={[ "group-cleardatabase-description" ]}>
                        You can clear your log file. <b>This will delete all of your chat logs!</b>
                    </div>
                    
                    {clearButton}
                </div>
            </div>            
        </>;
    }
}