import { CharacterName } from "../../shared/CharacterName";
import { CancellationToken } from "../../util/CancellationTokenSource";
import { ApiTicket, FListApi, FListAuthenticatedApi, FriendsList, KinkList, MappingList, ProfileFieldsInfoList, ProfileFriendsInfo, ProfileInfo } from "./FListApi";

const API_URL_BASE = "/api/flist/";

export class HostInteropApi implements FListApi {

    private async getResponseErrorAsync(resp: Response): Promise<Error> {
        try {
            const json = await resp.json();
            if (json && ((json.error && json.error != "") || (json.Error && json.Error != ""))) {
                const errMsg = json.error ?? json.Error;
                return new Error(`API request failed: ${errMsg}`);
            }
        }
        catch (e) {
        }
        return new Error(`API request failed: status code ${resp.status}`);
    }

    async getFromHostInteropAsync<T>(url: string, cancellationToken: CancellationToken): Promise<T> {
        const resp = await fetch(API_URL_BASE + url);
        if (resp.status != 200) {
            throw (await this.getResponseErrorAsync(resp));
            //throw new Error(`API request failed: status code ${resp.status}`);
        }
        const json = await resp.json();
        return json;
    }

    async postFromHostInteropAsync<T>(url: string, formData: { [name: string]: string }, cancellationToken: CancellationToken): Promise<T> {
        const fd = new FormData();
        for (let k of Object.getOwnPropertyNames(formData)) {
            fd.append(k, formData[k]);
        }
        const resp = await fetch(API_URL_BASE + url, {
            method: "post",
            body: fd
        });
        if (resp.status != 200) {
            throw (await this.getResponseErrorAsync(resp));
            //throw new Error(`API request failed: status code ${resp.status}`);
        }
        const json = await resp.json();
        return json;
    }

    async getMappingListAsync(cancellationToken: CancellationToken): Promise<MappingList> {
        const r = await this.getFromHostInteropAsync<MappingList>("mappingList", cancellationToken);
        return r;
    }

    async getKinksListAsync(cancellationToken: CancellationToken): Promise<KinkList> {
        const r = await this.getFromHostInteropAsync<any>("kinkList", cancellationToken);
        return r.kinks;
    }

    async getProfileFieldsInfoListAsync(cancellationToken: CancellationToken): Promise<ProfileFieldsInfoList> {
        const r = await this.getFromHostInteropAsync<any>("profileFieldInfoList", cancellationToken);
        return r.info;
    }

    async getAuthenticatedApiAsync(account: string, password: string, cancellationToken: CancellationToken): Promise<FListAuthenticatedApi> {
        const r = await this.postFromHostInteropAsync<any>("authenticate", {
            account: account,
            password: password
        }, cancellationToken);

        const result = new HostInteropAuthenticatedApi(this, account, password);
        return result;
    }
}

export class HostInteropAuthenticatedApi implements FListAuthenticatedApi {
    constructor(
        private readonly owner: HostInteropApi, 
        public readonly account: string, 
        password: string) {
    }

    // async invalidateApiTicketAsync(ticket: string, cancellationToken: CancellationToken): Promise<void> {
    //     const result = await this.owner.postFromHostInteropAsync<ApiTicket>(`${this.account}/invalidateTicket`, {
    //         ticket: ticket
    //     }, cancellationToken);
    // }

    async getFriendsListAsync(cancellationToken: CancellationToken): Promise<FriendsList> {
        const result = await this.owner.getFromHostInteropAsync<FriendsList>(`${this.account}/friendsList`, cancellationToken);
        return result;
    }

    async addBookmarkAsync(name: CharacterName, cancellationToken: CancellationToken): Promise<void> {
        const result = await this.owner.postFromHostInteropAsync<ApiTicket>(`${this.account}/addBookmark`, {
            name: name.value
        }, cancellationToken);
    }

    async removeBookmarkAsync(name: CharacterName, cancellationToken: CancellationToken): Promise<void> {
        const result = await this.owner.postFromHostInteropAsync<ApiTicket>(`${this.account}/removeBookmark`, {
            name: name.value
        }, cancellationToken);
    }

    async saveMemoAsync(name: CharacterName, memoText: string, cancellationToken: CancellationToken): Promise<string> {
        const r = await this.owner.postFromHostInteropAsync<any>(`${this.account}/saveMemo`, {
            target_name: name.value,
            note: memoText
        }, cancellationToken);
        return r.note;
    }

    async getCharacterProfileAsync(name: CharacterName, cancellationToken: CancellationToken): Promise<ProfileInfo> {
        const result = await this.owner.getFromHostInteropAsync<ProfileInfo>(`${this.account}/profile/${name.value}`, cancellationToken);
        return result;
    }

    async getCharacterFriendsAsync(name: CharacterName, cancellationToken: CancellationToken): Promise<ProfileFriendsInfo | null> {
        const result = await this.owner.getFromHostInteropAsync<ProfileFriendsInfo>(`${this.account}/profile-friends/${name.value}`, cancellationToken);
        return result;
    }

    getAuthenticatedApiAsync(account: string, password: string, cancellationToken: CancellationToken): Promise<FListAuthenticatedApi> {
        return this.owner.getAuthenticatedApiAsync(account, password, cancellationToken);
    }

    getMappingListAsync(cancellationToken: CancellationToken): Promise<MappingList> {
        return this.owner.getMappingListAsync(cancellationToken);
    }

    getProfileFieldsInfoListAsync(cancellationToken: CancellationToken): Promise<ProfileFieldsInfoList> {
        return this.owner.getProfileFieldsInfoListAsync(cancellationToken);
    }

    getKinksListAsync(cancellationToken: CancellationToken): Promise<KinkList> {
        return this.owner.getKinksListAsync(cancellationToken);
    }

    async getApiTicketAsync(cancellationToken: CancellationToken): Promise<ApiTicket> {
        const result = await this.owner.getFromHostInteropAsync<ApiTicket>(`${this.account}/ticket`, cancellationToken);
        return result;
    }
}