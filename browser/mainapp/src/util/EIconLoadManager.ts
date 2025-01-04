import { CancellationToken, CancellationTokenSource } from "./CancellationTokenSource";
import { IDisposable } from "./Disposable";
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
        public readonly owner: LoadedEIconImpl,
        public readonly url: string,
        public readonly uniqueToken: string) {
    }

    public readonly unregisterToken: object = {};

    private _disposed = false;

    dispose() {
        if (!this._disposed) {
            this._disposed = true;
            this.owner.dereference(this);
        }
    }

    [Symbol.dispose]() {
        this.dispose();
    }

    get isDisposed() { return this._disposed; }
}

const allocatedEIconObjectUrls = new Set<string>();

class LoadedEIconImpl implements LoadedEIcon {
    constructor(private readonly eiconName: string) {
        this._fr = new FinalizationRegistry<string>(uniqueToken => {
            this.dereferenceInternal(uniqueToken);
        });
    }

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
        const cancellationToken = actualRetrievalCTS.token;
        const eiconUrl = URLUtils.getEIconUrl(this.eiconName);
        const fetchResp = await fetch(eiconUrl, {
            signal: cancellationToken.signal
        });
        if (fetchResp.status >= 400) {
            throw new Error(`failed to fetch eicon, status code ${fetchResp.status}`);
        }
        const blob = await fetchResp.blob();

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
            if (iui.refCount == 0) {
                this._issuedUrls.delete(uniqueToken);
                iui.urlobj.dispose();
            }
        }
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

        const newRes = new LoadedEIconImpl(eiconName);
        this._loadedEIcons.set(eiconName, new WeakRef(newRes));
        this._fr.register(newRes, eiconName);
        return newRes;
    }
}

export const EIconLoadManager: EIconLoadManager = new EIconLoadManagerImpl();
(window as any)["__eiconloadmanager"] = EIconLoadManager;
(window as any)["__allocatedEIconObjectUrls"] = allocatedEIconObjectUrls;