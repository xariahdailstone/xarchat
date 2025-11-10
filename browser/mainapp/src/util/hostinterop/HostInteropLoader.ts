import { IHostInterop } from "./IHostInterop";
import { NullHostInterop } from "./null/NullHostInterop";
import { XarHost2Interop } from "./xarchatapp/XarHost2Interop";

export function loadHostInterop(): IHostInterop {
    const qp = new URLSearchParams(document.location.search);

    let result: IHostInterop;
    if (qp.get("XarHostMode") == "2") {
        result = new XarHost2Interop();
    }
    else {
        result = new NullHostInterop();
    }
    return result;
}