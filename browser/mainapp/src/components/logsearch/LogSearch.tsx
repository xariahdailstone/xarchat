import { jsx, Fragment, VNode, On, Attrs, Hooks } from "../../snabbdom/index";
import { TextboxBinding } from "../../util/bindings/TextboxBinding";
import { DateUtils } from "../../util/DateUtils";
import { IDisposable } from "../../util/Disposable";
import { ExplicitDate, ExplicitDateUtils } from "../../util/hostinterop/HostInteropLogSearch";
import { ObjectUniqueId } from "../../util/ObjectUniqueId";
import { Scheduler } from "../../util/Scheduler";
import { LogSearch3ViewModel } from "../../viewmodel/logsearch/LogSearch3ViewModel";
import { LogSearchResultsMessageGroupSetViewModel } from "../../viewmodel/logsearch/LogSearchResultsMessageGroupSetViewModel";
import { LogSearchStatus } from "../../viewmodel/logsearch/LogSearchStatus";
import { LogSearchType } from "../../viewmodel/logsearch/LogSearchType";
import { componentArea, componentElement } from "../ComponentBase";
import { makeRenderingComponent, RenderArguments, RenderingComponentBase } from "../RenderingComponentBase";
import { StageViewComponent, stageViewFor } from "../Stage";
import { XCSelectElement } from "../XCSelect";

@componentElement("x-logsearch3")
@componentArea("logsearch")
@stageViewFor(LogSearch3ViewModel)
export class LogSearch3 extends StageViewComponent<LogSearch3ViewModel> {
    constructor() {
        super();

        makeRenderingComponent(this, {
            render: (x) => this.render(x)
        });
    }

    render(args: RenderArguments): VNode {
        if (this.viewModel == null) { return <></>; }
        const vm = this.viewModel;

        return <div class={{ "logsearch-main": true }}>
            { this.renderArgs(args, vm) }
            { this.renderBottom(args, vm) }
        </div>;
    }

    private renderArgs(args: RenderArguments, vm: LogSearch3ViewModel): VNode {
        return <div class={{ "logsearch-main-args": true }}>
            <div key="typeselect-label" class={{ "logsearch-main-args-type-label": true }}>Search</div>
            <x-xcselect key="typeselect" class={{ "logsearch-main-args-type-select": true }} props={{ "value": vm.logSearchType }} on={{
                "change": (e) => {
                    const target = e.target as XCSelectElement;
                    vm.logSearchType = target.value as LogSearchType;
                }
            }}>
                <x-xcoption attr-value="channel">Channel</x-xcoption>
                <x-xcoption attr-value="pmconvo">Private Messages</x-xcoption>
            </x-xcselect>
            <div class={{ "logsearch-main-args-details-container": true }}>
                { this.renderArgsDetails(args, vm) }
            </div>
            <button key="searchbutton" class={{ "logsearch-main-args-searchbutton": true, "themed": true }} attrs={{
                "disabled": !vm.canSearch
            }} on={{
                "click": (e) => {
                    vm.search();
                }
            }}>Search</button>
        </div>;
    }

    private renderArgsDetails(args: RenderArguments, vm: LogSearch3ViewModel): VNode {
        if (vm.logSearchType == LogSearchType.CHANNEL) {
            return this.renderArgsDetailsChannel(args, vm);
        }
        else if (vm.logSearchType == LogSearchType.PRIVATE_MESSAGE) {
            return this.renderArgsDetailsPMConvo(args, vm);
        }
        else {
            return <></>;
        }
    }

    private renderArgsDetailsChannel(args: RenderArguments, vm: LogSearch3ViewModel): VNode {
        // const onChange = (e: Event) => {
        //     const target = e.target as HTMLInputElement;
        //     vm.channelTitle = target.value;
        // };

        return <>
            <x-suggesttextbox attr-type="text" classList={[ "logsearch-main-args-channelselect", "themed" ]} props={{ "viewModel": vm.channelTitleSuggest }}></x-suggesttextbox>

            {/* <input classList={[ "logsearch-main-args-channelselect", "themed" ]} attrs={{ "type": "text" }} props={{ "value": vm.channelTitle }} on={{
                "input": (e) => { onChange(e); },
                "change": (e) => { onChange(e); }
            }}></input> */}
        </>;
    }

    private renderArgsDetailsPMConvo(args: RenderArguments, vm: LogSearch3ViewModel): VNode {
        return <>
            <div class={{ "logsearch-main-args-pm-mychar-label": true }}>between</div>
            <x-suggesttextbox attr-type="text" classList={[ "logsearch-main-args-pm-mychar-label-select", "themed" ]} props={{ "viewModel": vm.myCharacterNameSuggest }}></x-suggesttextbox>
            <div class={{ "logsearch-main-args-pm-interlocutorchar-label": true }}>and</div>
            <x-suggesttextbox attr-type="text" classList={[ "logsearch-main-args-pm-interlocutorchar-select", "themed" ]} props={{ "viewModel": vm.interlocutorCharacterNameSuggest }}></x-suggesttextbox>
        </>;
    }

    private renderBottom(args: RenderArguments, vm: LogSearch3ViewModel): VNode {
        if (vm.status == LogSearchStatus.SEARCHING) {
            return this.renderBottomLoading(args, vm);
        }
        else if (vm.results == null) {
            return <div key="bottom-null" class={{ "logsearch-main-bottom": true }}>No results found.</div>;
        }
        else {
            return this.renderBottomResults(args, vm);
        }
    }

    private renderBottomLoading(args: RenderArguments, vm: LogSearch3ViewModel): VNode {
        return <div key="bottom-loading" class={{ 
            "logsearch-main-bottom": true,
            "logsearch-main-bottom-loading": vm.status == LogSearchStatus.SEARCHING
        }}>Please wait, searching...</div>;
    }

    private renderBottomResults(args: RenderArguments, vm: LogSearch3ViewModel): VNode {
        return <div key="bottom-results" class={{ 
            "logsearch-main-bottom": true,
            "logsearch-main-bottom-results": true
        }}>
            {this.renderBottomDatePicker(args, vm)}
            {this.renderBottomMessageStream(args, vm)}
        </div>;
    }

    private _lastRenderedDate: (ExplicitDate | null) = null;
    private renderBottomDatePicker(args: RenderArguments, vm: LogSearch3ViewModel): VNode {
        const r = vm.results!;

        let lastSeenYear = 0;
        const yearOptions: VNode[] = [];
        for (let thisYear of r.hasYears) {
            if (thisYear != lastSeenYear) {
                lastSeenYear = thisYear;
                yearOptions.push(<x-xcoption attrs={{ "value": thisYear.toString() }}>{ thisYear.toString() }</x-xcoption>)
            }
        }

        r.selectedYear = r.selectedYear ?? lastSeenYear;

        const yearPicker = <div key="bottom-results-yearpicker" class={{ 
            "logsearch-main-bottom-results-yearpicker": true
        }}>
            <button classList={[ "prev-year", "themed" ]} attrs={{
                "disabled": !r.canGoPreviousYear
            }} on={{
                "click": () => r.goPreviousYear()
            }}>&lt;</button>
            <x-xcselect classList={[ "year-select" ]} props={{ "value": r.selectedYear.toString() }} on={{
                "change": (e) => {
                    const target = e.target as XCSelectElement;
                    r.selectedYear = +target.value;
                }
            }}>
                {yearOptions}
            </x-xcselect>
            <button classList={[ "next-year", "themed" ]} attrs={{
                "disabled": !r.canGoNextYear
            }} on={{
                "click": () => r.goNextYear()
            }}>&gt;</button>
        </div>;

        const monthNodes: VNode[] = [];

        for (let mon = 0; mon < 12; mon++) {
            let monthHasDayWithLog = false;
            let curDate = new Date(Date.UTC(r.selectedYear, mon, 1, 0, 0, 0, 0));

            const monthName = DateUtils.getMonthName(mon);
            const weekNodes: VNode[] = [
                <tr classList={[ "week-row" ]}></tr>
            ];
            let curWeekNodes: VNode[] = [];
            weekNodes[0].children = curWeekNodes;
            for (var x = 0; x < curDate.getUTCDay(); x++) {
                curWeekNodes.push(<td class={{ "empty-day": true }}></td>);
            }
            const currentlySelectedDate: ExplicitDate | null = r.selectedDate;
            const renderDateChanged = !ExplicitDateUtils.equals(this._lastRenderedDate, currentlySelectedDate);
            if (renderDateChanged) {
                this.logger.logInfo("Render Date Changed", this._lastRenderedDate, currentlySelectedDate);
            }

            while (true) {
                if (curWeekNodes.length >= 7) {
                    const newWeek = <tr classList={[ "week-row" ]}></tr>;
                    curWeekNodes = [];
                    newWeek.children = curWeekNodes;
                    weekNodes.push(newWeek);
                }
                const tcurdate = { y: curDate.getUTCFullYear(), m: curDate.getUTCMonth() + 1, d: curDate.getUTCDate() };
                const dateHasLogs = r.hasDate(tcurdate.y, tcurdate.m, tcurdate.d);
                const isSelectedDate = ExplicitDateUtils.equals(currentlySelectedDate, tcurdate);
                const dateOn: On = {};
                const dateHooks: Hooks = {};
                const dateVNode = <td class={{ "day": true, "day-has-logs": dateHasLogs, "selected-date": isSelectedDate }}
                    on={dateOn} hook={dateHooks}>{ tcurdate.d.toString() }</td>;

                if (dateHasLogs) {
                    dateOn["click"] = (e: Event) => {
                        r.selectedDate = tcurdate;
                        // Set this selected date as the last rendered date so we don't autoscroll to it
                        this._lastRenderedDate = tcurdate;
                    };
                    monthHasDayWithLog = true;

                    if (isSelectedDate) {
                        this.logger.logInfo("Rendering currently selected date", tcurdate);
                        if (renderDateChanged) {
                            this.logger.logInfo("Adding post hook to scroll to new date", tcurdate);
                            dateHooks.postpatch = () => {
                                this._lastRenderedDate = currentlySelectedDate;
                                this.logger.logInfo("scrolling date pick into view 0");
                                Scheduler.scheduleCallback("afterframe", () => {
                                    this.logger.logInfo("scrolling date pick into view 1");
                                    const el = dateVNode.elm! as HTMLTableCellElement;
                                    this.logger.logInfo("scrolling date pick into view", el);
                                    el.scrollIntoView({ block: "center" });
                                });
                            };
                        }
                    }
                }
                
                curWeekNodes.push(dateVNode);
                curDate = DateUtils.addDays(curDate, 1);
                if (curDate.getUTCMonth() != mon) {
                    break;
                }
            }
            if (curDate.getUTCDay() != 0) {
                for (var x = curDate.getUTCDay(); x < 7; x++) {
                    curWeekNodes.push(<td class={{ "empty-day": true }}></td>);
                }
            }

            const tMonthNode =
                <table key={`month-${r.selectedYear}-${mon}`}>
                    <tr classList={[ "month-name-row" ]}>
                        <th attr-colspan="7">{ monthName }</th>
                    </tr>
                    <tr classList={[ "week-headings-row" ]}>
                        <th>Su</th>
                        <th>Mo</th>
                        <th>Tu</th>
                        <th>We</th>
                        <th>Th</th>
                        <th>Fr</th>
                        <th>Sa</th>
                    </tr>
                    {weekNodes[0]}
                    {weekNodes[1]}
                    {weekNodes[2]}
                    {weekNodes[3]}
                    {weekNodes[4] ?? null}
                    {weekNodes[5] ?? null}
                </table>;
            if (monthHasDayWithLog) {
                monthNodes.push(tMonthNode);
            }
        }

        return <div key="bottomresults-datepicker" class={{
            "logsearch-main-bottom-results-datepicker": true
        }}>
            {yearPicker}
            <div class={{ "logsearch-main-bottom-results-months": true }}>
                {monthNodes}
            </div>
        </div>;
    }

    private renderBottomMessageStream(args: RenderArguments, vm: LogSearch3ViewModel): VNode {
        const r = vm.results!;

        if (r.loadingMessages) {
            return <div classList={[ "logsearch-main-bottom-results-stream-loading" ]}>Please wait, searching...</div>;
        }
        else if (r.messageSet) {
            return <x-logsearch3setview 
                classList={[ "logsearch-main-bottom-results-stream" ]} 
                props={{ "viewModel": r.messageSet }}></x-logsearch3setview>;
            // return <x-channelstream 
            //     classList={[ "logsearch-main-bottom-results-stream" ]} 
            //     props={{ "viewModel": r.messages }}></x-channelstream>;
        }
        else {
            return <div classList={[ "logsearch-main-bottom-results-stream-empty" ]}></div>;
        }
    }
}


@componentElement("x-logsearch3setview")
@componentArea("logsearch")
export class LogSearch3SetView extends RenderingComponentBase<LogSearchResultsMessageGroupSetViewModel> {
    constructor() {
        super();
    }

    protected render(args: RenderArguments): VNode {
        const vm = this.viewModel;
        if (!vm) { return <></>; }

        const groupSelectNodes: VNode[] = [];
        for (let g of vm.groups) {
            const isSelectedGroup = (g == vm.selectedGroup)
            groupSelectNodes.push(<div class={{
                "timerange-group": true,
                "is-selected": isSelectedGroup
            }} on={{
                "click": () => {
                    vm.selectedGroup = g;
                }
            }}>{ g.timeRangeString }</div>);
        }

        const streamNode = vm.selectedGroup
            ? <x-channelstream key={`stream-${ObjectUniqueId.get(vm.selectedGroup.channel)}`}
                classList={[ "selectedgroup-stream" ]} 
                props={{ "viewModel": vm.selectedGroup.channel }}></x-channelstream>
            : <></>;

        return <div classList={[]}>
            <div classList={[ "timerange-group-container" ]}>{groupSelectNodes}</div>
            {streamNode}
        </div>;
    }
}