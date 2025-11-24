import { ChannelName } from "../../../shared/ChannelName";
import { OnlineStatus } from "../../../shared/OnlineStatus";
import { jsx, Fragment, VNode, On, Classes } from "../../../snabbdom/index";
import { BBCodeUtils } from "../../../util/BBCodeUtils";
import { asDisposable, ConvertibleToDisposable, EmptyDisposable, IDisposable } from "../../../util/Disposable";
import { IterableUtils } from "../../../util/IterableUtils";
import { ObjectUniqueId } from "../../../util/ObjectUniqueId";
import { StringUtils } from "../../../util/StringUtils";
import { ChatChannelMessageMode } from "../../../viewmodel/ChatChannelViewModel";
import { ConfigureAutoAdsViewModel, ConfiguredAdViewModel } from "../../../viewmodel/ConfigureAutoAdsViewModel";
import { componentArea, componentElement } from "../../ComponentBase";
import { makeRenderingComponent } from "../../RenderingComponentBase";
import { ThemeToggle } from "../../ThemeToggle";
import { DialogBorderType, DialogComponentBase, dialogViewFor } from "../DialogFrame";

const ALERT_EMOJI = "\u26a0\ufe0f";

@componentArea("dialogs/auto-ad-config")
@componentElement("x-configureautoadsdialog")
@dialogViewFor(ConfigureAutoAdsViewModel)
export class ConfigureAutoAdsDialog extends DialogComponentBase<ConfigureAutoAdsViewModel> {
    constructor() {
        super();

        makeRenderingComponent(this, {
            render: () => this.render()
        });
    }

    render(): [VNode, IDisposable] {
        const vm = this.viewModel;
        if (!vm) { return [ <></>, EmptyDisposable ] };

        const disposables: ConvertibleToDisposable[] = [];

        const addDisposable = (d: ConvertibleToDisposable) => { disposables.push(d); };

        const vnode = <div classList="maincontainer">
            <div class={{"enablecontainer": true, "is-enabled": vm.enabled, "is-disabled": !vm.enabled }}>
                <x-themetoggle attr-type="checkbox" id="elEnablePosting" props={{ "value": vm.enabled }} on={{
                    "change": (e) => { vm.enabled = (e.target as ThemeToggle).value; }
                }}></x-themetoggle>
                <span classList="enablelabel">Auto Ad Posting is <b>{ vm.enabled ? "Enabled" : "Disabled" }</b>.</span>
            </div>
            <div classList="enablelistsep"></div>
            <div classList="adlistcontainer">
                { this.renderAdTitleList(vm, addDisposable) }
            </div>
            { this.renderAdDetailContainer(vm, addDisposable) }
        </div>;

        return [vnode, asDisposable(...disposables)];
    }

    renderAdTitleList(vm: ConfigureAutoAdsViewModel, addDisposable: (d: ConvertibleToDisposable) => void): VNode[] {
        const cnodes: VNode[] = [];

        for (let x of vm.entries) {
            const nkey = ObjectUniqueId.get(x);

            const tabclasses: Classes = {
                "adtab": true,
                "adtab-selected": vm.selectedEntry == x,
                "adtab-isnewadplaceholder": false
            };

            let closeButtonNode: VNode | null = null;
            if (!x.isNewAdPlaceholder) {
                closeButtonNode = <div classList="adtab-closebutton" on={{
                    "click": () => {
                        x.delete();
                    }
                }}><x-iconimage src="assets/ui/iconify-window-close.svg"></x-iconimage></div>;
            }
            else {
                tabclasses["adtab-isnewadplaceholder"] = true;
            }

            tabclasses["adtab-isdisabled"] = !x.enabled;

            const tabevts: On = {
                "click": () => {
                    x.select();
                }
            }
            const closeevts: On = {
                "click": (e: Event) => {
                    x.delete();
                    e.stopPropagation();
                }
            }

            let warningText: string | null = null;
            if (!x.isNewAdPlaceholder) {
                if (StringUtils.isNullOrWhiteSpace(x.adText)) {
                    warningText = "No ad text specified, this ad will not send!";
                }
                else if (x.targetOnlineStatuses.length == 0) {
                    warningText = "No online statuses specified, this ad will not send!";
                }
                else if (x.targetChannels.length == 0) {
                    warningText = "No channels specified, this ad will not send!";
                }
            }

            const titleWarnIcon = warningText
                ? <span classList={["adtab-title-warningicon"]} attr-title={warningText}>{ALERT_EMOJI + " "}</span>
                : <span></span>;
            const effTitle = StringUtils.isNullOrWhiteSpace(x.title) 
                ? (!x.isNewAdPlaceholder ? "Untitled Ad" : "New Ad")
                : x.title;
            cnodes.push(<div key={`adtab-${nkey}`} class={tabclasses} on={tabevts}>
                <div classList="adtab-title">{ titleWarnIcon }{ effTitle }</div>
                {closeButtonNode}
            </div>);
        }

        return cnodes;
    }

    renderAdDetailContainer(vm: ConfigureAutoAdsViewModel, addDisposable: (d: ConvertibleToDisposable) => void): VNode {
        const item = vm.selectedEntry;

        const titleOn: On = {
            "change": (e: Event) => item.title = (e.target as HTMLInputElement).value,
            "input": (e: Event) => item.title = (e.target as HTMLInputElement).value,
        }
        const enableOn: On = {
            "change": (e: Event) => item.enabled = (e.target as HTMLInputElement).checked,
            "input": (e: Event) => item.enabled = (e.target as HTMLInputElement).checked,
        }
        const adTextOn: On = {
            "change": (e: Event) => item.adText = (e.target as HTMLTextAreaElement).value,
            "input": (e: Event) => item.adText = (e.target as HTMLTextAreaElement).value,
        }

        const updateOnlineStatuses = () => {
            const togStatus = (eid: string, s: OnlineStatus) => {
                const enabled = (this.$(eid) as HTMLInputElement).checked;
                if (item.targetOnlineStatuses.contains(s)) {
                    if (!enabled) {
                        item.targetOnlineStatuses.remove(s);
                    }
                }
                else {
                    if (enabled) {
                        item.targetOnlineStatuses.add(s);
                    }
                }
            };
            togStatus("cbWhenOnline", OnlineStatus.ONLINE);
            togStatus("cbWhenLooking", OnlineStatus.LOOKING);
            togStatus("cbWhenBusy", OnlineStatus.BUSY);
            togStatus("cbWhenAway", OnlineStatus.AWAY);
            togStatus("cbWhenDND", OnlineStatus.DND);
        };
        const cbOn: On = {
            "input": updateOnlineStatuses,
            "change": updateOnlineStatuses
        };

        const cbWhenOnline = <input id="cbWhenOnline" attr-type="checkbox" props={{ "checked": item.targetOnlineStatuses.contains(OnlineStatus.ONLINE) }} on={cbOn} />;
        const cbWhenLooking = <input id="cbWhenLooking" attr-type="checkbox" props={{ "checked": item.targetOnlineStatuses.contains(OnlineStatus.LOOKING) }} on={cbOn} />;
        const cbWhenBusy = <input id="cbWhenBusy" attr-type="checkbox" props={{ "checked": item.targetOnlineStatuses.contains(OnlineStatus.BUSY) }} on={cbOn} />;
        const cbWhenAway = <input id="cbWhenAway" attr-type="checkbox" props={{ "checked": item.targetOnlineStatuses.contains(OnlineStatus.AWAY) }} on={cbOn} />;
        const cbWhenDND = <input id="cbWhenDND" attr-type="checkbox" props={{ "checked": item.targetOnlineStatuses.contains(OnlineStatus.DND) }} on={cbOn} />;

        const textAreaNode = <textarea id="elAdText" props={{ "value": item.adText ?? "" }} on={adTextOn}></textarea>;
        BBCodeUtils.addEditingShortcutsVNode(textAreaNode, {
            appViewModelGetter: () => vm.activeLoginViewModel.appViewModel,
            activeLoginViewModelGetter: () => vm.activeLoginViewModel,
            onTextChanged: (v) => item.adText = v
        });

        return <div classList="addetailcontainer" key={`${ObjectUniqueId.get(item)}-pane`}>
            <label classList="adtitlecontainer" attr-for="elTitle">
                <span classList="titlelabel">Title</span>
                <input attr-type="text" id="elTitle" props={{ "value": item.title ?? "Untitled Ad" }} on={titleOn}></input>
            </label>
            <label classList="adenabledcontainer" attr-for="elAdEnabled">
                <input attr-type="checkbox" id="elAdEnabled" props={{ "checked": item.enabled ?? true }} on={enableOn}></input>
                <span classList="enabledlabel">Enable This Ad</span>
            </label>
            <label classList="adtextcontainer" attr-for="elAdText">
                <span classList="adtextlabel">Post this ad:</span>
                {textAreaNode}
            </label>
            <div classList="adchannelscontainer">
                <div classList="channelslabel">Into these channels:</div>
                <div classList="channelsset">{ this.renderSelectedChannelSet(vm, item, addDisposable) }</div>
            </div>
            <div classList="adonlinestatuscontainer">
                <div classList="onlinestatuseslabel">When I am in one of these statuses:</div>
                <div classList="onlinestatusesset">
                    <label attr-for="cbWhenOnline">{cbWhenOnline}<span>Online</span></label>
                    <label attr-for="cbWhenLooking">{cbWhenLooking}<span>Looking</span></label>
                    <label attr-for="cbWhenBusy">{cbWhenBusy}<span>Busy</span></label>
                    <label attr-for="cbWhenAway">{cbWhenAway}<span>Away</span></label>
                    <label attr-for="cbWhenDND">{cbWhenDND}<span>DND</span></label>
                </div>
            </div>
        </div>;
    }

    renderSelectedChannelSet(vm: ConfigureAutoAdsViewModel, item: ConfiguredAdViewModel, addDisposable: (d: ConvertibleToDisposable) => void): VNode[] {
        const resultNodes: VNode[] = [];

        const inChanOptionNodes = IterableUtils.asQueryable(vm.activeLoginViewModel.openChannels).orderBy(x => x.title).toArray();

        let i = 0;
        for (let ch of item.targetChannels) {
            const chan = vm.activeLoginViewModel.getChannel(ch);
            const ctitle = chan ? chan.title : ch.value;
            const isInChan = chan != null;
            const chanDisallowsAds = chan?.messageMode == ChatChannelMessageMode.CHAT_ONLY;

            const notInChanAlertNode = !isInChan
                ? <div classList="chanitem-notinchanalert" attr-title="You are not in this channel!">{ALERT_EMOJI}</div>
                : null;

            resultNodes.push(<div key={`chanitem${i++}`} classList={[ "chanitem" ]}>
                {notInChanAlertNode}
                <x-xcselect classList={[ "chanitem-title" ]} props={{ "value": ch.canonicalValue }} on={{
                    "change": (e) => {
                        const sv = (e.target as HTMLSelectElement).value
                        const idx = item.targetChannels.indexOf(ch);
                        item.targetChannels.removeAt(idx);
                        item.targetChannels.addAt(ChannelName.create(sv), idx);
                    }
                }}>
                    {
                        (chan == null) ? <x-xcoption key={ch.canonicalValue} attr-value={ch.canonicalValue} attrs={{ "selected": true }}>{ch.value}</x-xcoption> : null
                    }
                    {
                        inChanOptionNodes
                            .filter(c => c.name == ch || !item.targetChannels.contains(c.name))
                            .map(c => <x-xcoption key={c.name.canonicalValue} attr-value={c.name.canonicalValue} attrs={{ "selected": c.name == ch }}>{c.title}</x-xcoption>)
                    }
                </x-xcselect>
                <div classList={[ "chanitem-close" ]} on={{
                    "click": () => {
                        item.targetChannels.remove(ch);
                    }
                }}><x-iconimage src="assets/ui/iconify-window-close.svg"></x-iconimage></div>
            </div>);
        }

        resultNodes.push(<div key={`newchanitem${i++}`} classList={[ "chanitem", "chanitem-new" ]}>
            <x-xcselect classList={[ "chanitem-title" ]} props={{ "value": "" }} on={{
                "change": (e) => {
                    const sv = (e.target as HTMLSelectElement).value;
                    item.targetChannels.add(ChannelName.create(sv));
                }
            }}>
                    <x-xcoption key=" empty" attrs={{ "value": "", "selected": true }}>Select Channel</x-xcoption>
                    {
                        inChanOptionNodes
                            .filter(c => !item.targetChannels.contains(c.name))
                            .map(c => <x-xcoption key={c.name.canonicalValue} attr-value={c.name.canonicalValue}>{c.title}</x-xcoption>)
                    }
                </x-xcselect>
        </div>);

        return resultNodes;
    }
}