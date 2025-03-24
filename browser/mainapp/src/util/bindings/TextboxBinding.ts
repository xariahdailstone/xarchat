import { IDisposable, asDisposable } from "../Disposable";
import { CalculatedObservable } from "../ObservableExpression";
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
            const robs = new CalculatedObservable("TextboxBinding.initialize", () => this.viewModelValueRef.read());
            const rsub = robs.addValueChangeListener(value => {
                onViewModelUpdate(value ?? "");
            });
            this._disposables.add(robs);
            this._disposables.add(rsub);
        }
    }

    private readonly _sentinelSym: symbol = Symbol();
    private readonly _disposables: Set<IDisposable> = new Set();

    private _disposed = false;
    dispose() {
        if (!this._disposed) {
            this._disposed = true;
            for (let d of this._disposables.values()) {
                try { d.dispose(); }
                catch { }
            }
        }
    }

    [Symbol.dispose]() { this.dispose(); }

    get isDisposed() { return this._disposed; }
}