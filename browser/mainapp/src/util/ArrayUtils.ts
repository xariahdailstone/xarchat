import { testEquality } from "./Equality";

export class ArrayUtils {
    static areEquivalent(a: Array<any> | null | undefined, b: Array<any> | null | undefined): boolean {
        if (a == null && b == null) { return true; }
        if (a == null || b == null) { return false; }
        if (a.length != b.length) { return false; }
        for (let x = 0; x < a.length; x++) {
            if (!testEquality(a[x], b[x])) {
                return false;
            }
        }
        return true;
    }
}