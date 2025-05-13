import { CharacterName } from "../shared/CharacterName.js";
import { CharacterStatus } from "../shared/CharacterSet.js";
import { CancellationToken, CancellationTokenSource } from "../util/CancellationTokenSource.js";
import { SnapshottableMap } from "../util/collections/SnapshottableMap.js";
import { SnapshottableSet } from "../util/collections/SnapshottableSet.js";
import { DisposableOwnerField, IDisposable, asDisposable, asNamedDisposable, isDisposable } from "../util/Disposable.js";
import { testEquality } from "../util/Equality.js";
import { EventListenerUtil } from "../util/EventListenerUtil.js";
import { FastEventSource } from "../util/FastEventSource.js";
import { HostInterop } from "../util/HostInterop.js";
import { Logger, Logging, LogLevel } from "../util/Logger.js";
import { ObjectUniqueId } from "../util/ObjectUniqueId.js";
import { Observable, ValueSubscription } from "../util/Observable.js";
import { ObservableBase } from "../util/ObservableBase.js";
import { Collection } from "../util/ObservableCollection.js";
import { ObservableExpression } from "../util/ObservableExpression.js";
import { Optional } from "../util/Optional.js";
import { Predicate } from "../util/Predicate.js";
import { OperationCancelledError } from "../util/PromiseSource.js";
import { createStylesheet, setStylesheetAdoption, SharedStyleSheet } from "../util/StyleSheetPolyfill.js";
import { TaskUtils } from "../util/TaskUtils.js";
import { WhenChangeManager } from "../util/WhenChange.js";
import { ActiveLoginViewModel } from "../viewmodel/ActiveLoginViewModel.js";
import { ConstructorOf } from "./dialogs/DialogFrame.js";

const NOW = () => (new Date()).getTime();

type Action<T> = (value: T) => void;

const _componentAreas: Map<any, string> = new Map();

export class StyleLoader {
    private static _loadedStylesheets: Map<string, Promise<SharedStyleSheet>> = new Map();
    private static SYM_RAWCSS = Symbol();

    static loadAsync(url: string): Promise<SharedStyleSheet> {
        if (this._loadedStylesheets.has(url)) {
            return this._loadedStylesheets.get(url)!;
        }

        const p = new Promise<SharedStyleSheet>(async (resolve, reject) => {
            const body = await this.loadAsyncInternal(url, CancellationToken.NONE);
            const result = createStylesheet();
            result.replaceSync(body);
            (result as any)[this.SYM_RAWCSS] = body;
            resolve(result);
        });

        this._loadedStylesheets.set(url, p);
        return p;
    }

    private static async loadAsyncInternal(url: string, cancellationToken: CancellationToken): Promise<string> {
        const result = await HostInterop.getCssDataAsync(url, cancellationToken);
        return result;
    }

    static async refreshCss(filename: string) {
        for (let kvp of this._loadedStylesheets.entries()) {
            const url = kvp[0];
            const ssobj = await kvp[1];

            if (url.toLowerCase().indexOf(filename.toLowerCase()) != -1) {
                const newCss = await this.loadAsyncInternal(url, CancellationToken.NONE);
                const existingCss = (ssobj as any)[this.SYM_RAWCSS];
                if (newCss != existingCss) {
                    ssobj.replaceSync(newCss);
                    (ssobj as any)[this.SYM_RAWCSS] = newCss;
                }
            }
        }
    }

    constructor(private readonly onLoadChange: Action<SharedStyleSheet[]>) {
        onLoadChange([]);
    }

    private readonly _results: SharedStyleSheet[] = [];

    async addLoad(url: string): Promise<SharedStyleSheet | null> {
        try {
            const r = await StyleLoader.loadAsync(url);
            this.addResult(r);
            return r;
        }
        catch {
            return null;
        }
    }

    private addResult(ss: SharedStyleSheet) {
        this._results.push(ss);
        this.onLoadChange([...this._results]);
    }
}

(window as any).__refreshCss = async (filename: string) => {
    await StyleLoader.refreshCss(filename);
};

export abstract class ComponentBase<TViewModel> extends HTMLElement {

    static get observedAttributes(): string[] { return [ ]; };

    static readonly INHERITED_VIEW_MODEL = {};

    protected readonly _fastEventSource: FastEventSource;

    constructor() {
        super();

        this.logger = Logging.createLogger(`${this.constructor.name}#${ObjectUniqueId.get(this)}`);

        this._fastEventSource = new FastEventSource(this.fastEvents, this);

        this._sroot = this.attachShadow({ mode: 'closed' });

        const className = this.constructor.name;

        const elMain = document.createElement("div");
        elMain.id = "elMain";
        elMain.classList.add(`component-${this.constructor.name}`);
        elMain.style.opacity = "0";
        this._sroot.appendChild(elMain);

        this.elMain = elMain;

        this._styleLoader = new StyleLoader(ss => {
            setStylesheetAdoption(this._sroot, ss);
            //(this._sroot as any).adoptedStyleSheets = [...ss];
        });

        let commonLoaded = false;
        let compLoaded = false;
        this.addMultipleStyleSheetsAsync([...this.requiredStylesheets, ...this.postRequiredStylesheets]).then(() => {
            this.elMain.style.removeProperty("opacity");
        });

        this.uniqueId = ComponentBase._nextUniqueId++;
    }

    get fastEvents() { return [ "viewmodelchange", "connected", "disconnected" ]; }

    protected get area(): string {
        let ct = this;
        while (ct && !(ct.constructor instanceof ComponentBase)) {
            const a = _componentAreas.get(ct.constructor);
            if (a) {
                return a;
            }
            ct = (ct as any).prototype;
        }

        return "";
    }

    protected get coreRequiredStylesheets() {
        return [
            'styles/common.css',
            'styles/bbcode.css'
        ]; 
    }

    protected get myRequiredStylesheets() {
        const area = this.area;
        let areaPath: string;
        if (area != "") {
            areaPath = `${area}/`;
        }
        else {
            areaPath = "";
        }
        return [
            `styles/components/${areaPath}${this.constructor.name}.css`
        ]; 
    }

    protected get requiredStylesheets() {
        return [
            ...this.coreRequiredStylesheets,
            ...this.myRequiredStylesheets
        ]
    }

    protected get postRequiredStylesheets() {
        return ["/customcss"];
    }

    private static _nextUniqueId = 1;
    protected readonly uniqueId: number;

    logger: Logger;

    protected log(logLevel: LogLevel, message: string, ...params: any[]) {
        const logId = this.getAttribute("logid");
        const logIdStr = logId ? `#${logId}` : "";
        this.logger.log(logLevel, message, ...params);
    }

    protected logDebug(message: string, ...params: any[]) { this.log(LogLevel.DEBUG, message, ...params); }
    protected logInfo(message: string, ...params: any[]) { this.log(LogLevel.INFO, message, ...params); }
    protected logWarn(message: string, ...params: any[]) { this.log(LogLevel.WARN, message, ...params); }
    protected logError(message: string, ...params: any[]) { this.log(LogLevel.ERROR, message, ...params); }

    private readonly _styleLoader: StyleLoader;

    protected addStyleSheetAsync(url: string): Promise<SharedStyleSheet | null> {
        return this._styleLoader.addLoad(url);
    }

    protected async addMultipleStyleSheetsAsync(urls: string[]): Promise<void> {
        const promises = [];
        for (let url of urls) {
            const tpromise = this.addStyleSheetAsync(url);
            promises.push(tpromise);
        }
        for (let tpromise of promises) {
            try { await tpromise; } catch { }
        }
    }

    protected readonly _sroot: ShadowRoot;
    public readonly elMain: HTMLDivElement;

    public $(id: string): (HTMLElement | null) { return this._sroot.getElementById(id) as HTMLElement; }

    private _isComponentConnected: boolean = false;
    protected get isComponentConnected() { return this._isComponentConnected; }

    private connectedCallback() {
        try {
            this._isComponentConnected = true;
            this.parentComponent = this.findParentComponent();
            //this.logger.logDebug(`${this.constructor.name} connected`, this.parentComponent);
            this.viewModelContextUpdated();
            this.connectedToDocument();
            this.setupWhenConnecteds();
            this.raiseConnectedEvent();
        }
        catch (e) {
            this.logger.logError("connectedCallback failed", e);
        }
    }

    protected connectedToDocument() { }
    protected disconnectedFromDocument() { }

    private disconnectedCallback() {
        //this.logger.logDebug(`${this.constructor.name} disconnected`);
        this.logger.logDebug("disconnecting");
        try {
            this._isComponentConnected = false;
            this.parentComponent = null;
            this.viewModelContextUpdated();
            this.disconnectedFromDocument();
            this.teardownWhenConnecteds();
            this.raiseDisconnectedEvent();
            this.logger.logDebug("disconnected"); 
        } 
        catch (e) { 
            this.logger.logError("disconnectedCallback failed", e);
        }
    }

    private _inAttributeChangedCallback: boolean = false;

    private readonly _attrChangeHandlers: Map<string, Set<((name: string, oldValue?: string, newValue?: string) => void)>> = new Map();
    addAttributeChangedHandler(attributeName: string, callback: ((name: string, oldValue?: string, newValue?: string) => void)): IDisposable {
        if (!this._attrChangeHandlers.has(attributeName)) {
            this._attrChangeHandlers.set(attributeName, new Set());
        }
        this._attrChangeHandlers.get(attributeName)!.add(callback);
        return asDisposable(() => {
            const handlers = this._attrChangeHandlers.get(attributeName);
            if (handlers) {
                handlers.delete(callback);
                if (handlers.size == 0) {
                    this._attrChangeHandlers.delete(attributeName);
                }
            }
        });
    }

    protected attributeChangedCallback(name: string, oldValue?: string, newValue?: string) {
        if (this._inAttributeChangedCallback) return;

        this._inAttributeChangedCallback = true;
        try
        {
        }
        finally{
            this._inAttributeChangedCallback = false;
        }
    }

    private _parentComponent: ComponentBase<unknown> | null = null;
    private readonly _parentComponentViewModelChange = new DisposableOwnerField();
    private _explicitViewModel: any = ComponentBase.INHERITED_VIEW_MODEL;

    get parentComponent(): (ComponentBase<unknown> | null) { return this._parentComponent; }
    private set parentComponent(value: (ComponentBase<unknown> | null)) {
        if (value !== this._parentComponent) {
            this._parentComponentViewModelChange.value = null;
            this._parentComponent = value;
            if (this._parentComponent) {
                this._parentComponentViewModelChange.value = this._parentComponent.whenConnectedWithViewModel(vm => {
                    this.viewModelContextUpdated();
                });
            }
            else {
                this.viewModelContextUpdated();
            }
        }
    }

    private viewModelContextUpdated() {
        const parentComponent = this.parentComponent;
        let vm: any = this._explicitViewModel;

        if (vm == ComponentBase.INHERITED_VIEW_MODEL) {
            if (parentComponent) {
                vm = parentComponent.viewModel;    
            }
            else {
                vm = null;
            }
        }

        this.viewModelMaybeChanged();
    }

    private findParentComponent(): (ComponentBase<unknown> | null) {
        let curEl = this.parentNode;
        while (curEl != null) {
            if (curEl instanceof ComponentBase) {
                //this.logger.logDebug(`parent component of ${this.tagName} is ${curEl.tagName}`);
                return curEl;
            }

            if (curEl instanceof ShadowRoot) {
                curEl = curEl.host;
            }
            else { 
                curEl = curEl.parentNode;
            }
        }

        //this.logger.logDebug(`parent component of ${this.tagName} is null`);
        return null;
    }

    get viewModel(): (TViewModel | null) { 
        return this._lastExposedViewModel;
    }
    set viewModel(value: (TViewModel | null)) {
        if (value !== this._explicitViewModel) {
            this._explicitViewModel = value;
            this.viewModelContextUpdated();
        }
    }

    private _lastExposedViewModel: any = null;
    private viewModelMaybeChanged() {
        let newVm: any = null;
        if (this._explicitViewModel === ComponentBase.INHERITED_VIEW_MODEL) {
            const parentComponent = this.findParentComponent();
            if (parentComponent) {
                newVm = parentComponent.viewModel;
            }
        }
        else {
            newVm = this._explicitViewModel;
        }

        if (newVm != this._lastExposedViewModel) {
            this._lastExposedViewModel = newVm;
            //this.logger.logDebug(`viewModelChanged in ${this.tagName} to ${newVm}`);
            this.viewModelChangedInternal();
        }
    }

    private viewModelChangedInternal() {
        this.dispatchEvent(new Event("viewmodelchange"));
        this.viewModelChanged();
    }

    protected viewModelChanged() { }

    private raiseConnectedEvent() {
        this.dispatchEvent(new Event("connected"));
    }

    private raiseDisconnectedEvent() {
        this.dispatchEvent(new Event("disconnected"));
    }

    watchExpr<const T>(expr: (vm: TViewModel) => T, valueChanged: (value: (T | undefined)) => (void | IDisposable)): IDisposable {
        const result = this.whenConnectedWithViewModel((vm) => {
            const lastReturnedDisposable = new DisposableOwnerField();

            const oexpr = new ObservableExpression(
                () => expr(vm), 
                v => {
                    const vcResult = valueChanged(v);
                    lastReturnedDisposable.value = vcResult ?? null;
                });
            
            return asNamedDisposable(`${this.constructor.name}_watchExprRegistration`, () => {
                lastReturnedDisposable.value = valueChanged(undefined) ?? null;
                lastReturnedDisposable.dispose();
                oexpr.dispose();
            });
        });
        
        return result;
    }

    watchExprTyped<TTypedViewModel, T>(type: ConstructorOf<TTypedViewModel>, expr: (vm: TTypedViewModel) => T, valueChanged: (value: (T | undefined)) => (void | IDisposable)): IDisposable {
        return this.watchExpr(vm => vm instanceof type ? expr(vm) : undefined, valueChanged);
    }

    watchViewModel(valueChanged: (value: TViewModel | null | undefined) => (void | IDisposable)): IDisposable {
        const lastReturnedDisposable = new DisposableOwnerField();
        const result = this.whenConnectedWithViewModel(vm => {
            lastReturnedDisposable.value = valueChanged(vm) ?? null;
            return lastReturnedDisposable;
        });
        return asDisposable(() => {
            result.dispose();
            lastReturnedDisposable.value = valueChanged(undefined) ?? null;
            lastReturnedDisposable.dispose();
        });
    }

    private readonly _whenConnectedEntries: SnapshottableSet<{ invoke: (isConnected: boolean) => Optional<IDisposable>, lastResult: DisposableOwnerField }> = new SnapshottableSet();

    protected whenConnected(createFunc: () => Optional<IDisposable>): IDisposable {
        const lastResult = new DisposableOwnerField();
        const reg = { 
            invoke: (isConnected: boolean) => {
                lastResult.value = null;
                if (isConnected) {
                    try {
                        const tresult = createFunc();
                        lastResult.value = tresult ?? null;
                    }
                    catch {
                        lastResult.value = null;
                    }
                }
            }, 
            lastResult: lastResult };
        this._whenConnectedEntries.add(reg);

        if (this.isComponentConnected) {
            reg.invoke(true);
        }

        return asDisposable(() => {
            this._whenConnectedEntries.delete(reg);
            reg.lastResult.dispose();
        });
    }
    private setupWhenConnecteds() {
        this._whenConnectedEntries.forEachValueSnapshotted(reg => {
            try { reg.invoke(true); }
            catch { }
        });
    }
    private teardownWhenConnecteds() {
        this._whenConnectedEntries.forEachValueSnapshotted(reg => {
            try { reg.invoke(false); }
            catch { }
        });
    }

    whenConnectedWithViewModel(createFunc: (vm: TViewModel) => Optional<IDisposable>): IDisposable {
        const wcReg = this.whenConnected(() => {
            const lastResult = new DisposableOwnerField();

            const vmChange = () => {
                const vm = this.viewModel;
                if (vm) {
                    const r = createFunc(vm);
                    lastResult.value = r ?? null;
                }
                else {
                    lastResult.value = null;
                }
            };

            const e = EventListenerUtil.addDisposableEventListener(this, "viewmodelchange", vmChange);
            vmChange();

            return asDisposable(() => {
                e.dispose();
                lastResult.dispose();
            });
        });
        return wcReg;
    }
}

export class ComponentCharacterStatusListener implements IDisposable {
    constructor(
        private readonly component: ComponentBase<unknown>,
        private readonly callback: (status: CharacterStatus) => void) {

        this._viewModelChangeHandler = EventListenerUtil.addDisposableEventListener(this.component, "viewmodelchange", () => {
            this.viewModelChanged();
        });
        this._connectedHandler = EventListenerUtil.addDisposableEventListener(this.component, "connected", () => {
            this.viewModelChanged();
        });
        this._disconnectedHandler = EventListenerUtil.addDisposableEventListener(this.component, "disconnected", () => {
            this.viewModelChanged();
        });
        this.viewModelChanged();
    }

    private _disposed: boolean = false;
    private _viewModelChangeHandler: IDisposable;
    private _connectedHandler: IDisposable;
    private _disconnectedHandler: IDisposable;

    dispose() {
        this._disposed = true;
        this._disconnectedHandler.dispose();
        this._connectedHandler.dispose();
        this._viewModelChangeHandler.dispose();
        this.detachFromSession();
    }

    [Symbol.dispose]() { this.dispose(); }

    get isDisposed() { return this._disposed; }

    private _characterName: CharacterName | null = null;

    setCharacterName(name: CharacterName | string | null) {
        if (typeof name == "string") {
            name = CharacterName.create(name);
        }
        if (name !== this._characterName) {
            this._characterName = name;
            this.attachToSession();
        }
    }

    private _lastSeenActiveLoginViewModel: ActiveLoginViewModel | null = null;

    private viewModelChanged() {
        const alvm = this.getCurrentActiveLoginViewModel();

        if (alvm !== this._lastSeenActiveLoginViewModel) {
            this._lastSeenActiveLoginViewModel = alvm;
            this.attachToSession();
        }
    }

    private _sessionAttach: IDisposable | null = null;

    private attachToSession() {
        this.detachFromSession();

        if (this._disposed) {
            return;
        }

        const vm = this._lastSeenActiveLoginViewModel;
        if (vm == null || this._characterName == null) {
            return;
        }

        this._sessionAttach = vm.characterSet.addStatusListenerDebug(
            [ "ComponentCharacterStatusListener.attachedToSession", this._characterName ],
            this._characterName, (cs) => {
            this.maybeFireCallback(cs);
        });
        this.maybeFireCallback(vm.characterSet.getCharacterStatus(this._characterName));
    }

    private _lastFiredStatus: CharacterStatus | null = null;

    private maybeFireCallback(cs: CharacterStatus) {
        if (this._lastFiredStatus && cs.equals(this._lastFiredStatus)) {
            return;
        }

        this._lastFiredStatus = cs;
        try { this.callback(cs); }
        catch { }
    }

    private detachFromSession() {
        if (this._sessionAttach != null) {
            this._sessionAttach.dispose();
            this._sessionAttach = null;
        }
    }

    private getCurrentActiveLoginViewModel(): ActiveLoginViewModel | null {
        if (!this.component.isConnected) {
            return null;
        }

        let cvm = this.component.viewModel;
        while (cvm) {
            if (cvm instanceof ActiveLoginViewModel) {
                return cvm;
            }
            
            cvm = (cvm as any).parent;
        }
        return null;
    }
}

type ValueChangedHandler = (event: Event) => void;


export type EventHandler = (e: Event) => void;


export interface ComponentAttributeConstructorOptions<T> {
    owner: ComponentBase<unknown>;
    attributeName: string;
    initialValue: T;
    onAssignmentFunc: ComponentAttributeAssignmentHandler<T>;
    onChange?: ComponentAttributeChangeHandler<T>;
}

export class ComponentAttribute<T> {
    constructor(
        args: ComponentAttributeConstructorOptions<T>)
    {
        this.owner = args.owner;
        this.attributeName = args.attributeName;
        this.onAssignmentFunc = args.onAssignmentFunc;
        this.onChange = args.onChange ?? (() => {});

        this._propertyValue = args.initialValue;
        
        const origACC = (this.owner as any).attributeChangedCallback as Function;
        this.owner.addAttributeChangedHandler(args.attributeName, (name, oldValue, newValue) => {
            if (this._assigningAttributeValue == 0) {
                this.assign("attribute", newValue ?? null);
            }
        });
    }

    protected readonly owner: ComponentBase<unknown>;
    protected readonly attributeName: string;
    protected readonly onAssignmentFunc: ComponentAttributeAssignmentHandler<T>;
    protected readonly onChange: ComponentAttributeChangeHandler<T>;

    private _propertyValue: T;

    get propertyValue(): T { return this._propertyValue; }
    set propertyValue(value: T) { this.assign("property", value); }

    private _assigningAttributeValue: number = 0;

    get attributeValue(): (string | null) { return this.owner.getAttribute(this.attributeName) ?? null; }
    set attributeValue(value: (string | null)) { this.assign("attribute", value); }

    private assign(via: "attribute", value: string | null): void;
    private assign(via: "property", value: T): void;
    //private assign(via: "attribute" | "property", value: T | string | null): void;
    private assign(via: "attribute" | "property", value: T | string | null): void {
        let changeResult: ComponentAttributeValueChangeResult<T>;
        if (via == "attribute") {
            changeResult = this.onAssignmentFunc({ via: "attribute", attributeValue: value as (string | null) });
        }
        else {
            changeResult = this.onAssignmentFunc({ via: "property", propertyValue: value as T });
        }

        this._assigningAttributeValue++;
        try {
            if (changeResult.attributeValue == null) {
                this.owner.removeAttribute(this.attributeName);
            }
            else {
                this.owner.setAttribute(this.attributeName, changeResult.attributeValue);
            }
        }
        finally {
            this._assigningAttributeValue--;
        }

        if (!testEquality(this._propertyValue, changeResult.propertyValue)) {
            this._propertyValue = changeResult.propertyValue;
            try { this.onChange(changeResult.propertyValue); } catch { }
        }
    }
}

export interface ComponentAttributeAssignmentArgs<T> {
    via: "attribute" | "property";
    attributeValue?: string | null;
    propertyValue?: T;
}
export interface ComponentAttributeValueChangeResult<T> {
    attributeValue: string | null;
    propertyValue: T;
}

export type ComponentAttributeAssignmentHandler<T> = (args: ComponentAttributeAssignmentArgs<T>) => ComponentAttributeValueChangeResult<T>;
export type ComponentAttributeChangeHandler<T> = (newValue: T) => void;

export interface StringComponentAttributeConstructorOptions {
    owner: ComponentBase<unknown>;
    attributeName: string;
    defaultValue: string;
    onValidate?: Predicate<string>;
    onChange?: ComponentAttributeChangeHandler<string>;
}

export class StringComponentAttribute extends ComponentAttribute<string> {
    constructor(
        args: StringComponentAttributeConstructorOptions)
    {
        super({
            owner: args.owner,
            attributeName: args.attributeName, 
            initialValue: args.defaultValue, 
            onAssignmentFunc: (x) => this.onAssignment(x),
            onChange: args.onChange 
        });

        this.defaultValue = args.defaultValue;
        this.onValidate = args.onValidate ?? (() => true);
    }

    private readonly defaultValue: string;
    private readonly onValidate: Predicate<string>;

    private onAssignment(args: ComponentAttributeAssignmentArgs<string>) {
        if (args.via == "property") {
            const value = args.propertyValue!;
            if (this.onValidate(value)) {
                return { propertyValue: value, attributeValue: value != this.defaultValue ? value : null };
            }
            else {
                return { propertyValue: this.propertyValue, attributeValue: this.attributeValue };
            }
        }
        else {
            const value = args.attributeValue;
            if (value == null) {
                return { propertyValue: this.defaultValue, attributeValue: null };
            }
            if (this.onValidate(value)) {
                return { propertyValue: value, attributeValue: value };
            }
            else {
                return { propertyValue: this.propertyValue, attributeValue: this.attributeValue };
            }
        }
    }
}



export interface BooleanComponentAttributeConstructorOptions {
    owner: ComponentBase<unknown>;
    attributeName: string;
    defaultValue: boolean;
    onChange?: ComponentAttributeChangeHandler<boolean>;
}

export class BooleanComponentAttribute extends ComponentAttribute<boolean> {
    constructor(
        args: BooleanComponentAttributeConstructorOptions)
    {
        super({
            owner: args.owner,
            attributeName: args.attributeName, 
            initialValue: args.defaultValue, 
            onAssignmentFunc: (x) => this.onAssignment(x),
            onChange: args.onChange 
        });

        this.defaultValue = args.defaultValue;
    }

    private readonly defaultValue: boolean;

    private onAssignment(args: ComponentAttributeAssignmentArgs<boolean>) {
        if (args.via == "property") {
            const value = args.propertyValue!;
            return { propertyValue: value, attributeValue: value != this.defaultValue ? value.toString() : null };
        }
        else {
            const value = args.attributeValue;
            if (value == null) {
                return { propertyValue: this.defaultValue, attributeValue: null };
            }
            return { propertyValue: !!value, attributeValue: value };
        }
    }
}

export function componentArea(area: string) {
    return function (target: any) {
        const taa = (target as any);
        _componentAreas.set(taa, area); 
    }
}

export function componentElement(elementName: string, extendsTagName?: string) {
    return function (target: any) {
        //alert(`componentElement elementName=${elementName} target=${target.name}`);
        const opts: ElementDefinitionOptions = {};
        if (extendsTagName) {
            opts["extends"] = extendsTagName;
        }
        window.customElements.define(elementName, target, opts);
    }
}