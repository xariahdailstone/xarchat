
import { jsx, VNode, Fragment } from "../snabbdom/index"

export class VNodeUtils {
    static createEmptyFragment(): VNode {
        // XXX: Pending fix for https://github.com/snabbdom/snabbdom/issues/1135
        //return <></>;
        return <x-emptyfragment style={{ "display": "none" }}></x-emptyfragment>
    }
}