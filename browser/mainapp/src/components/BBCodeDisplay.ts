import { asDisposable } from "../util/Disposable";
import { ObservableValue } from "../util/Observable";
import { BBCodeParseOptions, BBCodeParseResult, RegisteredBBCodeParsers } from "../util/bbcode/BBCode";
import { ComponentBase, componentElement } from "./ComponentBase";

const ATTR_PARSER = "parser";
const ATTR_INDENTLIMIT = "indentlimit";

@componentElement("x-bbcodedisplay")
export class BBCodeDisplay extends ComponentBase<BBCodeParseResult | string> {
    static get observedAttributes() { return [ ATTR_PARSER, ATTR_INDENTLIMIT ] };

    constructor() {
        super();

        this.watchExpr(vm => { return { viewModel: vm, parser: this._parser.value, indentLimit: this._indentLimit.value, parseOptions: this._parseOptions.value }; }, (args) => {
            if (!args) { return; }

            const vm = args.viewModel;
            const parser = args.parser ?? "chat";
            const indentLimit = args.indentLimit;
            const parseOptions = args.parseOptions;

            this.elMain.classList.toggle("bbcode-indentlimit", (indentLimit == "true"));

            if (typeof vm == "string") {
                const parserObj = RegisteredBBCodeParsers[parser] ?? RegisteredBBCodeParsers["chat"]
                if (parserObj && parseOptions) {
                    const parseResult = parserObj?.parse(vm, parseOptions);
                    this.elMain.appendChild(parseResult.element);
                    this.logger.logDebug("bbcode assigned");
                    return asDisposable(() => {
                        this.logger.logDebug("bbcode cleanedup");
                        this.elMain.removeChild(parseResult.element);
                        parseResult.dispose();
                    });    
                }
            }
            else {
                this.elMain.appendChild(vm.element);
                return asDisposable(() => {
                    this.elMain.removeChild(vm.element);
                });
            }
        });
    }

    protected override attributeChangedCallback(name: string, oldValue?: string, newValue?: string): void {
        if (name == ATTR_PARSER) {
            this._parser.value = newValue ?? null;
        }
        else if (name == ATTR_INDENTLIMIT) {
            this._indentLimit.value = newValue ?? null;
        }
        else {
            super.attributeChangedCallback(name, oldValue, newValue);
        }
    }

    private readonly _parser: ObservableValue<string | null> = new ObservableValue<string | null>(null).withName("BBCodeDisplay._parser");
    private readonly _indentLimit: ObservableValue<string | null> = new ObservableValue<string | null>(null).withName("BBCodeDisplay._indentLimit");
    private readonly _parseOptions: ObservableValue<BBCodeParseOptions | null> = new ObservableValue<BBCodeParseOptions | null>(null).withName("BBCodeDisplay._parseOptions");

    get parser(): string { return this.getAttribute(ATTR_PARSER) ?? ""; }
    set parser(value: string) {
        if (value != null) {
            this.setAttribute(ATTR_PARSER, value);
        }
        else {
            this.removeAttribute(ATTR_PARSER);
        }
    }

    get indentLimit(): string | null { return this.getAttribute(ATTR_INDENTLIMIT) ?? ""; }
    set indentLimit(value: string | null) {
        if (value != null) {
            this.setAttribute(ATTR_INDENTLIMIT, value);
        }
        else {
            this.removeAttribute(ATTR_INDENTLIMIT);
        }
    }

    get parseOptions() { return this._parseOptions.value; }
    set parseOptions(value: BBCodeParseOptions | null) { this._parseOptions.value = value; }
}