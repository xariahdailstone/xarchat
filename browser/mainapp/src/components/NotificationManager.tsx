import { jsx, Fragment, VNode } from "../snabbdom/index";
import { IDisposable } from "../util/Disposable";
import { ReadOnlyObservableCollection } from "../util/ObservableCollection";
import { ObservableExpression } from "../util/ObservableExpression";
import { Scheduler } from "../util/Scheduler";
import { ScrollAnchorTo } from "../util/ScrollAnchorTo";
import { INotificationSetState, NotificationViewModel, NotificationManagerViewModel, NotificationSetState, NotificationButtonViewModel } from "../viewmodel/NotificationManagerViewModel";
import { AnchorElementInfo, AnchorElementScrollTo, DefaultStreamScrollManager, ScrollSuppressionReason } from "./ChannelStream";
import { componentElement } from "./ComponentBase";
import { RenderArguments, RenderingComponentBase } from "./RenderingComponentBase";
import { stageViewFor } from "./Stage";

@componentElement("x-notificationmanager")
@stageViewFor(NotificationManagerViewModel)
export class NotificationManager extends RenderingComponentBase<NotificationManagerViewModel> {
    constructor() {
        super();
    }

    render(args: RenderArguments): VNode {
        if (!this.viewModel) { return <></>; }
        const vm = this.viewModel;

        let transientNotificationsTitle = "Notifications";

        let persistentNotificationsNode: VNode | null = null;
        if (vm.persistentSetState.collection.length > 0) {
            transientNotificationsTitle = "Other Notifications";
            persistentNotificationsNode = <div key="notifications-persistent" classList={[ "notifications-section", "notifications-section-persistent" ]}>
                <div classList={[ "notifications-section-title" ]}>Persistent Notifications</div>
                {this.renderNotificationsContainer(args, vm.persistentSetState)}
            </div>
        }
        else {
            persistentNotificationsNode = <div key="notifications-persistent" classList={[ "notifications-section", "notifications-section-persistent" ]}></div>;
        }
        

        return <div classList={[ "main-inner" ]}>
            {persistentNotificationsNode}
            <div key="notifications-transient" classList={[ "notifications-section", "notifications-section-transient" ]}>
                <div classList={[ "notifications-section-title" ]}>{transientNotificationsTitle}</div>
                {this.renderNotificationsContainer(args, vm.transientSetState)}
            </div>
        </div>;
    }

    renderNotificationsContainer(args: RenderArguments, setState: INotificationSetState): VNode[] {

        return [
            <div classList={[ "notifications-container-inner" ]} hook={{
                    "insert": (vn) => {
                        const el = vn.elm as HTMLElement;
                        const edata = this.getElementData(el);
                        if (edata == null) {
                            const dssm = new DefaultStreamScrollManager(
                                el,
                                () => {
                                    const result: AnchorElementInfo[] = [];
                                    const childEls = el.querySelectorAll(`*[${NotificationManager.ATTR_DATANOTIFID}]`);
                                    for (let i = 0; i < childEls.length; i++) {
                                        const cel = childEls.item(i) as HTMLElement;
                                        const elIdentity = cel.getAttribute(NotificationManager.ATTR_DATANOTIFID)!;
                                        result.push({ element: cel, elementIdentity: elIdentity });
                                    }
                                    return result;
                                },
                                (identity) => {
                                    const childEls = el.querySelectorAll(`*[${NotificationManager.ATTR_DATANOTIFID}]`);
                                    for (let i = 0; i < childEls.length; i++) {
                                        const cel = childEls.item(i) as HTMLElement;
                                        const elIdentity = cel.getAttribute(NotificationManager.ATTR_DATANOTIFID)!;
                                        if (elIdentity == identity) {
                                            return cel;
                                        }
                                    }
                                    return null;
                                },
                                (scrolledTo) => {
                                    //this.logger.logInfo("scrolledTo set to", scrolledTo);
                                    setState.scrolledTo = scrolledTo;
                                });
                            const scrolledToOE = new ObservableExpression(
                                () => setState.scrolledTo,
                                (v) => { dssm.scrolledTo = v ?? null; },
                                (err) => {}
                            );
                            this.setElementData(el, dssm, scrolledToOE);
                            //this.logger.logInfo("created DSSM", ObjectUniqueId.get(dssm), vn.elm);
                            Scheduler.scheduleCallback("frame", () => { 
                                dssm.enabled = true;
                                dssm.resetScroll(); 
                            });
                        }
                    },
                    "destroy": (vn) => {
                        const el = vn.elm as HTMLElement;
                        const edata = this.getElementData(el);
                        if (edata) {
                            this.clearElementData(el);
                            edata.streamScrollManager.dispose();
                            edata.scrolledToOE.dispose();
                            //this.logger.logInfo("disposed DSSM", ObjectUniqueId.get(edata.streamScrollManager), vn.elm);
                        }
                    },
                    "prepatch": (oldvn, vn) => {
                        const el = oldvn.elm as HTMLElement;
                        const edata = this.getElementData(el);
                        if (edata) {
                            edata.streamScrollManager.suppressScrollRecording(ScrollSuppressionReason.CMCVUpdatingElements);
                        }
                    },
                    "postpatch": (oldvn, vn) => {
                        const el = oldvn.elm as HTMLElement;
                        const edata = this.getElementData(el);
                        if (edata) {
                            edata.streamScrollManager.resumeScrollRecording(ScrollSuppressionReason.CMCVUpdatingElements);
                        }
                    }
                }}>
                {this.renderNotificationsItems(args, setState)}
            </div>,
            <div classList={[ "notifications-container-buttons" ]}>
                <button classList={[ "notifications-container-button", "themed", "button-clearall" ]} on={{
                    "click": () => {
                        for (let notif of [...setState.collection.iterateValues()]) {
                            this.viewModel!.removeNotification(notif);
                        }
                    }
                }}>Clear All</button>
            </div>
        ];
    }

    static readonly ATTR_DATANOTIFID = "data-notificationid";

    renderNotificationsItems(
        args: RenderArguments, 
        setState: INotificationSetState): VNode[] {

        const result: VNode[] = [];

        for (let notif of setState.collection.iterateValues()) {
            result.push(
                <div classList={[ "notification-item-outer "]} key={notif.uniqueId} attrs={{
                    [NotificationManager.ATTR_DATANOTIFID]: notif.uniqueId
                }}>
                    {this.renderSingleNotification(args, notif)}
                </div>
            );
        }

        return result;
    }

    private readonly SYM_DATA = Symbol();

    private getElementData(el: HTMLElement): ({ streamScrollManager: DefaultStreamScrollManager, scrolledToOE: IDisposable } | null) {
        return (el as any)[this.SYM_DATA] ?? null;
    }
    private setElementData(el: HTMLElement, streamScrollManager: DefaultStreamScrollManager, scrolledToOE: IDisposable) {
        (el as any)[this.SYM_DATA] = { streamScrollManager, scrolledToOE };
    }
    private clearElementData(el: HTMLElement) {
        delete (el as any)[this.SYM_DATA];
    }

    renderSingleNotification(args: RenderArguments, notif: NotificationViewModel): VNode {
        return <div classList={[ "notification-item-inner" ]} data-notificationid={notif.uniqueId}>
            <div classList={[ "notification-item-inner-message" ]}>{notif.messageBBCode.asVNode()}</div>
            {this.renderSingleNotificationButtonSet(args, notif)}
        </div>;
    }

    renderSingleNotificationButtonSet(args: RenderArguments, notif: NotificationViewModel): VNode | null {
        if (notif.buttons.length == 0) { return null; }
        return <div classList={[ "notification-item-button-set" ]}>{notif.buttons.map(b => this.renderSingleNotificationButton(args, b))}</div>;
    }
    renderSingleNotificationButton(args: RenderArguments, button: NotificationButtonViewModel): VNode {
        return <button classList={[ "notification-item-button", "themed" ]} on={{
            "click": () => {
                button.click();
            }
        }}>{button.title}</button>;
    }
}