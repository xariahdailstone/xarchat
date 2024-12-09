
export function testEquality(a: any, b: any): boolean {
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    if (typeof a.equals == "function") return a.equals(b);
    if (typeof b.equals == "function") return b.equals(a);
    if (typeof a.constructor.equals == "function") return a.constructor.equals(b);
    if (typeof b.constructor.equals == "function") return b.constructor.equals(a);
    return (a == b);
}