
export function testEquality(a: any, b: any): boolean {
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    if (typeof a.equals == "function") return a.equals(b);
    if (typeof b.equals == "function") return b.equals(a);
    if (typeof a.constructor.equals == "function") return a.constructor.equals(b);
    if (typeof b.constructor.equals == "function") return b.constructor.equals(a);
    return (a == b);
}

export function testEquivalent(a: any, b: any): boolean {
    if (a === b) return true;

    if (a == null && b == null) return true;
    if (a == null || b == null) return false;

    if (typeof a.equals == "function") return a.equals(b);
    if (typeof b.equals == "function") return b.equals(a);
    if (typeof a.constructor.equals == "function") return a.constructor.equals(b);
    if (typeof b.constructor.equals == "function") return b.constructor.equals(a);

    if (a instanceof Array) {
        if (!(b instanceof Array)) return false;
        if (a.length != b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (!testEquivalent(a[i], b[i])) return false;
        }
        return true;
    }
    else if (typeof a == "object") {
        if (!(typeof b == "object")) return false;
        const aKeys = Object.keys(a);
        const bKeys = Object.keys(b);
        if (aKeys.length != bKeys.length) return false;
        for (let i = 0; i < aKeys.length; i++) {
            const tkey = aKeys[i];
            const bidx = bKeys.indexOf(tkey);
            if (bidx == -1) return false;
            bKeys.splice(bidx, 1);
            if (!testEquivalent(a[tkey], b[tkey])) return false;
        }
        if (bKeys.length > 0) return false;
        return true;
    }
    else {
        return (a == b);
    }
}

export interface Equatable {
    equals(other: any): boolean;
}
export interface Hashable {
    getHashCode(): number;
}