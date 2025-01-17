import { HostInterop } from "./HostInterop";
import { URLUtils } from "./URLUtils";

export class EIconUtils {
    static async getAndSubmitEIconMetadata(eiconName: string): Promise<void> {
        try {
            const eiconUrl = URLUtils.getEIconUrl(eiconName);
            const resp = await fetch(eiconUrl, {
                method: "HEAD"
            });
            const contentLength = resp.headers.get("content-length");
            const eTag = resp.headers.get("etag");
            if (contentLength && eTag) {
                HostInterop.submitEIconMetadata(eiconName, +contentLength, eTag);
            }
        }
        catch (e) { }
    }
}