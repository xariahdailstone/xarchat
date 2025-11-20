import { CancellationToken, CancellationTokenSource } from "./CancellationTokenSource";
import { IDisposable } from "./Disposable";
import { HostInterop } from "./hostinterop/HostInterop";
import { Logger, Logging } from "./Logger";
import { ObjectUniqueId } from "./ObjectUniqueId";
import { PromiseSource } from "./PromiseSource";
import { BlobObjectURL, URLUtils } from "./URLUtils";

export interface EIconLoadManager {
    getEIcon(eiconName: string): LoadedEIcon;
}

export interface LoadedEIcon {
    getBlobUrlAsync(uniqueToken: string, cancellationToken: CancellationToken): Promise<LoadedEIconUniqueBlob>;
}

export interface LoadedEIconUniqueBlob extends IDisposable {
    readonly url: string;
}

class LoadedEIconUniqueBlobImpl implements LoadedEIconUniqueBlob {
    constructor(
        public readonly owner: BlobLoadedEIconImpl,
        public readonly url: string,
        public readonly uniqueToken: string) {

        this._logger = Logging.createLogger(`LoadedEIconUniqueBlobImpl#${uniqueToken}`);
        this._logger.logDebug("created");
    }

    private readonly _logger: Logger;

    public readonly unregisterToken: object = {};

    private _disposed = false;

    dispose() {
        if (!this._disposed) {
            this._disposed = true;
            this._logger.logDebug("disposed");
            this.owner.dereference(this);
        }
    }

    [Symbol.dispose]() {
        this.dispose();
    }

    get isDisposed() { return this._disposed; }
}

const allocatedEIconObjectUrls = new Set<string>();

class BlobLoadedEIconImpl implements LoadedEIcon {
    constructor(private readonly eiconName: string) {
        this._logger = Logging.createLogger(`LoadedEIconImpl[${eiconName}]#${ObjectUniqueId.get(this)}`);
        this._fr = new FinalizationRegistry<string>(uniqueToken => {
            this.dereferenceInternal(uniqueToken);
        });
        this._logger.logDebug("created");
    }

    private readonly _logger: Logger;

    private _blob: Blob | null = null;
    private readonly _issuanceWaiters: Set<(blob: Blob) => void> = new Set();

    private readonly _issuedUrls: Map<string, { urlobj: BlobObjectURL, refCount: number }> = new Map();
    private readonly _fr: FinalizationRegistry<string>;

    async getBlobUrlAsync(uniqueToken: string, cancellationToken: CancellationToken): Promise<LoadedEIconUniqueBlob> {
        let iui = this._issuedUrls.get(uniqueToken);
        if (iui == null) {
            if (this._blob == null) {
                let blob: Blob;
                const mustBeginRetrieval = (this._issuanceWaiters.size == 0);

                const ps = new PromiseSource<Blob>();
                const r = (blob: Blob) => {
                    ps.tryResolve(blob);
                };
                this._issuanceWaiters.add(r);
                if (mustBeginRetrieval) {
                    this.beginActualRetrieval();
                }

                using cr = cancellationToken.register(() => {
                    const wasInSet = this._issuanceWaiters.delete(r);
                    ps.trySetCancelled(cancellationToken);
                    if (wasInSet && this._issuanceWaiters.size == 0) {
                        this.stopActualRetrieval();
                    }
                });

                blob = await ps.promise;
                if (this._blob == null) {
                    this._blob = blob;
                }
            }
            
            const urlobj = URLUtils.createObjectURL(this._blob);
            iui = { urlobj: urlobj, refCount: 0 };
            this._issuedUrls.set(uniqueToken, iui);
        }

        iui.refCount++;
        this._logger.logDebug("referenced", uniqueToken, iui.refCount);
        const result = new LoadedEIconUniqueBlobImpl(this, iui.urlobj.url + `#canonicalUrl=${encodeURIComponent(URLUtils.getDirectEIconUrl(this.eiconName))}`, uniqueToken);
        this._fr.register(result, uniqueToken, result.unregisterToken);
        return result;
    }

    private _actualRetrievalCTS: CancellationTokenSource | null = null;

    private beginActualRetrieval() {
        if (this._actualRetrievalCTS == null) {
            this._actualRetrievalCTS = new CancellationTokenSource();
            this.performActualRetrieval(this._actualRetrievalCTS);
        }
    }

    private stopActualRetrieval() {
        if (this._actualRetrievalCTS != null) {
            this._actualRetrievalCTS.cancel();
            this._actualRetrievalCTS = null;
        }
    }

    private async performActualRetrieval(actualRetrievalCTS: CancellationTokenSource) {
        const blob = await HostInterop.getEIconDataBlob(this.eiconName, actualRetrievalCTS.token);

        this._blob = blob;
        const iw = [...this._issuanceWaiters];
        this._issuanceWaiters.clear();
        for (let w of iw) {
            w(blob);
        }

        actualRetrievalCTS.dispose();
    }

    dereference(ub: LoadedEIconUniqueBlobImpl) {
        this._fr.unregister(ub.unregisterToken);
        this.dereferenceInternal(ub.uniqueToken);
    }

    private dereferenceInternal(uniqueToken: string) {
        const iui = this._issuedUrls.get(uniqueToken);
        if (iui) {
            iui.refCount--;
            this._logger.logDebug("dereferenced", uniqueToken, iui.refCount);
            if (iui.refCount == 0) {
                this._issuedUrls.delete(uniqueToken);
                iui.urlobj.dispose();
            }
        }
    }
}

class DirectLoadedEIcon implements LoadedEIcon {
    constructor(private readonly eiconName: string) {
    }

    async getBlobUrlAsync(uniqueToken: string, cancellationToken: CancellationToken): Promise<LoadedEIconUniqueBlob> {
        return new DirectLoadedEIconUniqueBlobImpl(this.eiconName, uniqueToken);
    }
}
class DirectLoadedEIconUniqueBlobImpl implements LoadedEIconUniqueBlob {
    constructor(
        eiconName: string,
        uniqueToken: string) {

        this.url = URLUtils.getDirectEIconUrl(eiconName, uniqueToken);
    }

    readonly url: string;

    _isDisposed: boolean = false;
    get isDisposed() { return this._isDisposed; }

    dispose(): void {
        if (!this._isDisposed) {
            this._isDisposed = true;
        }
    }
    [Symbol.dispose](): void {
        this.dispose();
    }
}

class EIconLoadManagerImpl implements EIconLoadManager {
    constructor() {
        this._fr = new FinalizationRegistry((eiconName) => {
            this._loadedEIcons.delete(eiconName);
        });
    }

    private readonly _fr: FinalizationRegistry<string>;
    private readonly _loadedEIcons: Map<string, WeakRef<LoadedEIcon>> = new Map();

    getEIcon(eiconName: string): LoadedEIcon {
        if (HostInterop.canGetEIconDataBlobs) {
            return this.getEIconBlob(eiconName);
        }
        else {
            return this.getEIconDirect(eiconName);
        }
    }

    private getEIconDirect(eiconName: string): LoadedEIcon {
        return new DirectLoadedEIcon(eiconName);
    }

    private getEIconBlob(eiconName: string): LoadedEIcon {
        const x = this._loadedEIcons.get(eiconName);
        if (x) {
            const xv = x.deref();
            if (xv) {
                return xv;
            }
            else {
                this._loadedEIcons.delete(eiconName);
            }
        }

        const newRes = new BlobLoadedEIconImpl(eiconName);
        this._loadedEIcons.set(eiconName, new WeakRef(newRes));
        this._fr.register(newRes, eiconName);
        return newRes;
    }
}

export const EIconLoadManager: EIconLoadManager = new EIconLoadManagerImpl();
(window as any)["__eiconloadmanager"] = EIconLoadManager;
(window as any)["__allocatedEIconObjectUrls"] = allocatedEIconObjectUrls;