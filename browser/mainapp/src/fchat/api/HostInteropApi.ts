import { CharacterName } from "../../shared/CharacterName";
import { CancellationToken } from "../../util/CancellationTokenSource";
import { ApiTicket, FListApi, FListAuthenticatedApi, FriendsList, GuestbookPageInfo, KinkList, MappingList, PartnerSearchFieldsDefinitions, ProfileFieldsInfoList, ProfileFriendsInfo, ProfileInfo, ReportData } from "./FListApi";

const API_URL_BASE = "/api/flist/";

type Timed<T> = { expiresAt: number, value: Promise<T> };
let cachedMappingList: Timed<MappingList> = { expiresAt: 0, value: null! };
let cachedProfileFieldsInfoList: Timed<ProfileFieldsInfoList> = { expiresAt: 0, value: null! };
let cachedKinksList: Timed<KinkList> = { expiresAt: 0, value: null! };

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

    async postFromHostInteropAsync<T>(url: string, formData: { [name: string]: string | null }, cancellationToken: CancellationToken): Promise<T> {
        const fd = new URLSearchParams();
        for (let k of Object.getOwnPropertyNames(formData)) {
            const v = formData[k];
            if (v !== null) {
                fd.append(k, v);
            }
        }
        const resp = await fetch(API_URL_BASE + url, {
            method: "post",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: fd.toString()
        });
        if (resp.status != 200) {
            throw (await this.getResponseErrorAsync(resp));
            //throw new Error(`API request failed: status code ${resp.status}`);
        }
        const json = await resp.json();
        return json;
    }

    private async getOrCreateAsync<T>(ref: Timed<T>, cacheForMs: number, createFunc: () => Promise<T>) {
        const now = (new Date()).getTime();
        if (ref.expiresAt < now) {
            ref.expiresAt = now + cacheForMs;
            ref.value = createFunc();
        }
        const result = await ref.value;
        return result;
    }

    async getMappingListAsync(cancellationToken: CancellationToken): Promise<MappingList> {
        const r = await this.getOrCreateAsync(cachedMappingList, 1000 * 60 * 30, async () => {
            const res = await this.getFromHostInteropAsync<MappingList>("mappingList", cancellationToken);
            return res;
        });
        return r;
    }

    async getKinksListAsync(cancellationToken: CancellationToken): Promise<KinkList> {
        const r = await this.getOrCreateAsync(cachedKinksList, 1000 * 60 * 30, async () => {
            const res = await this.getFromHostInteropAsync<any>("kinkList", cancellationToken);
            return res;
        });
        return r.kinks;
    }

    async getProfileFieldsInfoListAsync(cancellationToken: CancellationToken): Promise<ProfileFieldsInfoList> {
        const r = await this.getOrCreateAsync(cachedProfileFieldsInfoList, 1000 * 60 * 30, async () => {
            const res = await this.getFromHostInteropAsync<any>("profileFieldInfoList", cancellationToken);
            return res;
        });
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

    async getPartnerSearchFieldsAsync(cancellationToken: CancellationToken): Promise<PartnerSearchFieldsDefinitions> {
        const r = await this.getFromHostInteropAsync<PartnerSearchFieldsDefinitions>("partnerSearchFieldsDefinitions", cancellationToken);
        return r;
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

    async addFriendRequestAsync(myCharName: CharacterName, theirCharName: CharacterName, cancellationToken: CancellationToken): Promise<void> {
        const result = await this.owner.postFromHostInteropAsync<any>(`${this.account}/addFriendRequest`, {
            myCharName: myCharName.value,
            theirCharName: theirCharName.value
        }, cancellationToken);
    }

    async cancelFriendRequestAsync(friendRequestId: number, cancellationToken: CancellationToken): Promise<void> {
        const result = await this.owner.postFromHostInteropAsync<any>(`${this.account}/cancelFriendRequest`, {
            request_id: friendRequestId.toString()
        }, cancellationToken);
    }

    async acceptIncomingFriendRequestAsync(friendRequestId: number, cancellationToken: CancellationToken): Promise<void> {
        const result = await this.owner.postFromHostInteropAsync<any>(`${this.account}/acceptIncomingFriendRequest`, {
            request_id: friendRequestId.toString()
        }, cancellationToken);
    }

    async rejectIncomingFriendRequestAsync(friendRequestId: number, cancellationToken: CancellationToken): Promise<void> {
        const result = await this.owner.postFromHostInteropAsync<any>(`${this.account}/rejectIncomingFriendRequest`, {
            request_id: friendRequestId.toString()
        }, cancellationToken);
    }

    async removeFriendAsync(myCharName: CharacterName, theirCharName: CharacterName, cancellationToken: CancellationToken): Promise<void> {
        const result = await this.owner.postFromHostInteropAsync<any>(`${this.account}/removeFriend`, {
            myCharName: myCharName.value,
            theirCharName: theirCharName.value
        }, cancellationToken);
    }

    async saveMemoAsync(name: CharacterName, memoText: string, cancellationToken: CancellationToken): Promise<string> {
        const r = await this.owner.postFromHostInteropAsync<any>(`${this.account}/saveMemo`, {
            target_name: name.value,
            note: memoText
        }, cancellationToken);
        return r.note;
    }

    async submitReportAsync(reportData: ReportData, cancellationToken: CancellationToken): Promise<number | null> {
        const r = await this.owner.postFromHostInteropAsync<any>(`${this.account}/submitReport`, {
            character: reportData.character.value,
            reportText: reportData.reportText,
            log: reportData.log,
            channel: reportData.channel,
            text: "true",
            reportUser: reportData.reportUser?.value ?? null
        }, cancellationToken);
        return r.log_id ?? null;
    }

    async getCharacterProfileAsync(name: CharacterName, cancellationToken: CancellationToken): Promise<ProfileInfo> {
        const result = await this.owner.getFromHostInteropAsync<ProfileInfo>(`${this.account}/profile/${name.value}`, cancellationToken);
        const cn = CharacterName.createCanonical(result.name);
        return result;
    }

    async getCharacterFriendsAsync(name: CharacterName, cancellationToken: CancellationToken): Promise<ProfileFriendsInfo | null> {
        const result = await this.owner.getFromHostInteropAsync<ProfileFriendsInfo>(`${this.account}/profile-friends/${name.value}`, cancellationToken);
        return result;
    }

    async getGuestbookPageAsync(name: CharacterName, page: number, cancellationToken: CancellationToken): Promise<GuestbookPageInfo> {
        const result = await this.owner.getFromHostInteropAsync<GuestbookPageInfo>(`${this.account}/guestbook/${name.value}/${page}`, cancellationToken);
        return result;
    }

    async getPartnerSearchFieldsAsync(cancellationToken: CancellationToken): Promise<PartnerSearchFieldsDefinitions> {
        const r = await this.owner.getPartnerSearchFieldsAsync(cancellationToken);
        return r;
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