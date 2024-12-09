if (!Symbol.asyncDispose) {
    (Symbol as any).asyncDispose = Symbol("asyncDispose");
}
if (!Symbol.dispose) {
    (Symbol as any).dispose = Symbol("dispose");
}