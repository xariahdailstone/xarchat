import { IDisposable, asDisposable } from "../Disposable";
import { ObservableExpression } from "../ObservableExpression";
import { ValueReference } from "../ValueReference";

export class TextboxBinding implements IDisposable {
    constructor(
        textbox: HTMLInputElement,
        private readonly viewModelValueRef: ValueReference<string>) {

        this._fm = new FinalizationRegistry<number>((heldValue) => {
            this.dispose();
        });

        const wtb = new WeakRef(textbox);
        this.initialize(wtb);
    }

    private readonly _fm: FinalizationRegistry<number>;
    private _transitingData: number = 0;

    private initialize(textboxRef: WeakRef<HTMLInputElement>) {

        const sentinelObj = {};

        (textboxRef.deref() as any)[this._sentinelSym] = sentinelObj;
        this._fm.register(sentinelObj, 0);

        this._disposables.add(asDisposable(() => {
            const tb = textboxRef.deref();
            if (tb) {
                delete (tb as any)[this._sentinelSym];
                this._fm.unregister(sentinelObj);
            }
        }));

        const onTextBoxUpdate = () => {
            if (this._transitingData == 0) {
                const tb = textboxRef.deref();
                if (tb) {
                    const value = tb.value;

                    this._transitingData++;
                    try {
                        this.viewModelValueRef.write(value);
                    }
                    finally {
                        this._transitingData--;
                    }
                }
            }
        };
        const onViewModelUpdate = (value: string) => {
            const tb = textboxRef.deref();
            if (tb) {
                if (this._transitingData == 0) {
                    this._transitingData++;
                    try {
                        tb.value = value;
                    }
                    finally {
                        this._transitingData--;
                    }
                }
            }
        };

        if (this.viewModelValueRef.canWrite) {
            textboxRef.deref()!.addEventListener("change", onTextBoxUpdate);
            textboxRef.deref()!.addEventListener("input", onTextBoxUpdate);

            this._disposables.add(asDisposable(() => {
                const tb = textboxRef.deref();
                if (tb) {
                    tb.removeEventListener("change", onTextBoxUpdate);
                    tb.removeEventListener("input", onTextBoxUpdate);
                }
            }));
        }

        if (this.viewModelValueRef.canRead) {
            this._disposables.add(new ObservableExpression(
                () => { return this.viewModelValueRef.read(); },
                (value) => { onViewModelUpdate(value ?? ""); },
                (err) => { onViewModelUpdate(""); })
            );
        }
    }

    private readonly _sentinelSym: symbol = Symbol();
    private readonly _disposables: Set<IDisposable> = new Set();

    dispose() {
        for (let d of this._disposables.values()) {
            try { d.dispose(); }
            catch { }
        }
    }

    [Symbol.dispose]() { this.dispose(); }
}