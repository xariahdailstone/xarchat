import { StringUtils } from "./StringUtils"

export class CatchUtils {
    static getMessage(e: any): string {
        if (e instanceof Error) {
            return !StringUtils.isNullOrWhiteSpace(e.message) ? e.message : "unknown error";
        }
        else if (e != null) {
            const msg = e.toString();
            return !StringUtils.isNullOrWhiteSpace(msg) ? msg : "unknown error";
        }
        else {
            return "unknown error";
        }
    }
}