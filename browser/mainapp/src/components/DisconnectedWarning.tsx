import { asDisposable } from "../util/Disposable";
import { WhenChangeManager } from "../util/WhenChange";
import { ActiveLoginViewModel, ChatConnectionState } from "../viewmodel/ActiveLoginViewModel";
import { ComponentBase, componentElement } from "./ComponentBase";
import { RenderingComponentBase } from "./RenderingComponentBase";
import { Fragment, init, jsx, VNode, styleModule, toVNode, propsModule, eventListenersModule } from "../snabbdom/index.js";
import { VNodeUtils } from "../util/VNodeUtils";

@componentElement("x-disconnectedwarning")
export class DisconnectedWarning extends RenderingComponentBase<ActiveLoginViewModel> {
    constructor() {
        super();

        this.watchExpr(vm => vm.connectionState, () => this.stateHasChanged());
        this.watchExpr(vm => vm.autoReconnectInSec, () => this.stateHasChanged());
    }

    render(): VNode {
        const connState = this.viewModel?.connectionState;
        const reconnectInSec = this.viewModel?.autoReconnectInSec;

        if (connState != ChatConnectionState.CONNECTED) {
            const msgBuilder: string[] = [];
            switch (connState) {
                case ChatConnectionState.DISCONNECTED_UNEXPECTEDLY:
                    msgBuilder.push("Your chat connection has been lost.");
                    break;
                case ChatConnectionState.DISCONNECTED_KICKED:
                    msgBuilder.push("You were kicked from the chat server.");
                    break;
                case ChatConnectionState.DISCONNECTED_NORMALLY:
                    msgBuilder.push("You disconnected from chat.");
                    break;
                case ChatConnectionState.DISCONNECTED_LOGGED_IN_ELSEWHERE:
                    msgBuilder.push("You were disconnected because you logged in somewhere else.");
                    break;
            }

            if (reconnectInSec != null) {
                if (reconnectInSec >= 0) {
                    msgBuilder.push(`Reconnecting in ${reconnectInSec} second${reconnectInSec != 1 ? 's' : ''}...`);
                }
                else {
                    msgBuilder.push("Attempting to reconnect...");
                }
            }
            
            const msgText = msgBuilder.join(' ');

            const el = 
                <div classList={[ "disconnected-message" ]}>
                    { msgText }
                </div>;

            return el;
        }
        
        return VNodeUtils.createEmptyFragment();
    }
}
