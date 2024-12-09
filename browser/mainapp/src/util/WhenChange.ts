import { IDisposable } from "./Disposable.js";

export class WhenChangeManager implements IDisposable {
    constructor() {
    }

    private _disposed: boolean = false;

    dispose() {
        if (!this._disposed) {
            this._disposed = true;
            this.cleanup();
        }
    }

    [Symbol.dispose]() { this.dispose(); }

    private _currentAssignValues: (object | null) = null;
    private _currentSetupDispose: (IDisposable | null) = null;

    private areDifferent(a: (object | null), b: (object | null)): boolean {
        if (a == null && b == null) return false;
        if (a == null || b == null) return true;

        const aPropsRaw = Object.getOwnPropertyNames(a);
        const bPropsRaw = Object.getOwnPropertyNames(b);
        if (aPropsRaw.length != bPropsRaw.length) return true;

        aPropsRaw.sort();
        bPropsRaw.sort();
        for (let i = 0; i < aPropsRaw.length; i++) {
            if (aPropsRaw[i] != bPropsRaw[i]) return true;

            const aValue = (a as any)[aPropsRaw[i]];
            const bValue = (b as any)[aPropsRaw[i]];

            if (aValue == null && bValue == null) {
            }
            else if (aValue == null || bValue == null) {
                return true;
            }
            else if (typeof aValue.equals == "function") {
                if (!aValue.equals(bValue)) { return true; }
            }
            else if (typeof bValue.equals == "function") {
                if (!bValue.equals(aValue)) { return true; }
            }
            else if (aValue !== bValue) {
                return true;
            }
        }

        return false;
    }

    assign<T extends object>(values: T, onChange: (value: T) => (IDisposable | null | undefined | void)) {
        if (this._disposed) { return; }
        if (this.areDifferent(values, this._currentAssignValues)) {
            this.cleanup();
            this._currentSetupDispose = onChange(values) ?? null;
            this._currentAssignValues = values;
        }
    }

    cleanup() {
        if (this._currentSetupDispose) {
            this._currentSetupDispose.dispose();
            this._currentSetupDispose = null;
            this._currentAssignValues = null;
        }
    }
}