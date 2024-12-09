import { CancellationToken } from "../../util/CancellationTokenSource";
import { StringUtils } from "../../util/StringUtils";
import { API_URL_BASE, ApiTicket, TICKET_LIFETIME_MS } from "./FListApi";

export class ApiTicketCache {
    private readonly _cache: Map<string, CachedCredentialInfo> = new Map();

    private reapCache() {
        for (let kvp of this._cache.entries()) {
            if (kvp[1].expiresAt < new Date()) {
                this._cache.delete(kvp[0]);
            }
        }
    }

    async invalidateTicketAsync(account: string, password: string, ticket: string) {
        this.reapCache();
        const cachedInfo = this._cache.get(account + "/" + password);
        if (cachedInfo) {
            const cachedTicket = await cachedInfo.ticketPromise;
            if (cachedTicket.ticket == ticket && this._cache.get(account) == cachedInfo) {
                this._cache.delete(account + "/" + password);
            }
        }
    }

    async getApiTicketAsync(account: string, password: string, cancellationToken: CancellationToken): Promise<ApiTicket & HasFromCache> {
        this.reapCache();
        const cachedInfo = this._cache.get(account + "/" + password);
        if (cachedInfo && cachedInfo.password == password && cachedInfo.expiresAt > new Date()) {
            try {
                const result = { ...await cachedInfo.ticketPromise, fromCache: true };
                return result;
            }
            catch { }
        }

        const newcci: CachedCredentialInfo =  {
            account: account,
            password: password,
            expiresAt: new Date(new Date().getTime() + TICKET_LIFETIME_MS),
            ticketPromise: this.getApiTicketInternalAsync(account, password)
        };
        this._cache.set(account + "/" + password, newcci);

        const nresult = { ...await newcci.ticketPromise, fromCache: false };
        return nresult;
    }

    private async getApiTicketInternalAsync(account: string, password: string): Promise<ApiTicket> {
        const resp = await fetch(API_URL_BASE + "/getApiTicket.php", {
            method: "POST",
            body: new URLSearchParams([
                [ "account", account ],
                [ "password", password ],
                [ "new_character_list", "true" ]
            ])
        });
        if (resp.status != 200) {
            throw new Error(`getApiTicket returned status code ${resp.status}: ${resp.statusText}`);
        }

        const newTicket = (await resp.json()) as ApiTicket;
        if (!StringUtils.isNullOrWhiteSpace(newTicket.error)) {
            throw new Error(`getApiTicket returned error "${newTicket.error}"`);
        }
        return newTicket;
    }
}

export interface HasFromCache {
    readonly fromCache: boolean;
}

interface CachedCredentialInfo {
    readonly account: string;
    readonly password: string;

    readonly ticketPromise: Promise<ApiTicket>;
    readonly expiresAt: Date;
}