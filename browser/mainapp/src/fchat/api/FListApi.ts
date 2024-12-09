import { CharacterName } from "../../shared/CharacterName";
import { CancellationToken, CancellationTokenSource } from "../../util/CancellationTokenSource";
import { StringUtils } from "../../util/StringUtils";
import { ApiTicketCache, HasFromCache } from "./CredentialCache";

export interface FListApi {
    getAuthenticatedApiAsync(account: string, password: string, cancellationToken: CancellationToken): Promise<FListAuthenticatedApi>;
    getMappingListAsync(cancellationToken: CancellationToken): Promise<MappingList>;
    getProfileFieldsInfoListAsync(cancellationToken: CancellationToken): Promise<ProfileFieldsInfoList>;
    getKinksListAsync(cancellationToken: CancellationToken): Promise<KinkList>;
}

export interface FListAuthenticatedApi extends FListApi {
    readonly account: string;

    invalidateApiTicketAsync(ticket: string, cancellationToken: CancellationToken): Promise<void>;
    getApiTicketAsync(cancellationToken: CancellationToken): Promise<ApiTicket>;

    getFriendsListAsync(cancellationToken: CancellationToken): Promise<FriendsList>;
    addBookmarkAsync(name: CharacterName, cancellationToken: CancellationToken): Promise<void>;
    removeBookmarkAsync(name: CharacterName, cancellationToken: CancellationToken): Promise<void>;

    getCharacterProfileAsync(name: CharacterName, cancellationToken: CancellationToken): Promise<ProfileInfo>;

    saveMemoAsync(name: CharacterName, memoText: string, cancellationToken: CancellationToken): Promise<string>;
}


export interface ApiTicket {
    error?: string;
    bookmarks: ApiTicketBookmark[];
    characters: ApiTicketCharacters;
    default_character: number;
    friends: ApiTicketFriend[];
    ticket: string;
}
export interface ApiTicketBookmark {
    name: string;
}
export interface ApiTicketCharacters {
    [name: string]: number;
}
export interface ApiTicketFriend {
    dest_name: string;
    source_name: string;
}

export interface ProfileInfo {
    readonly badges: CharacterBadge[];
    readonly character_list: CharacterListItem[];
    readonly created_at: number;
    readonly custom_kinks: { [id: string]: CustomKinkInfo } | void[];
    readonly custom_title: string | null;
    readonly customs_first: boolean;
    readonly description: string;
    readonly id: number;
    readonly images: ImageInfo[];
    readonly infotags: InfoTags | void[];
    readonly inlines: { [id: string]: InlineInfo } | void[];
    readonly is_self: boolean;
    readonly kinks: { [id: string]: KinkPrefType } | void[];
    readonly memo: MemoInfo;
    readonly name: string;
    readonly settings: ProfileDisplaySettings;
    readonly updated_at: number;
    readonly views: number;
}
export interface CharacterListItem {
    id: number;
    name: string;
}
export interface InfoTags {
    [id: string]: string;
}
export enum CharacterBadge {
    ADMIN = "admin",
    DEVELOPER = "developer",
    HELPDESK = "helpdesk",
    GLOBAL = "global",
    CHATOP = "chatop",
    CHANOP = "chanop"
}
export interface CustomKinkInfo {
    name: string;
    description: string;
    choice: string;
    children: number[];
}
export interface ImageInfo {
    description: string;
    extension: string;
    height: string;
    image_id: string;
    sort_order: string;
    width: string;
}
export interface InlineInfo {
    hash: string;
    extension: string;
    nsfw: boolean;
}
export enum KinkPrefType {
    FAVE = "fave",
    YES = "yes",
    MAYBE = "maybe",
    NO = "no"
}
export interface MemoInfo {
    id: number;
    memo: string;
}
export interface ProfileDisplaySettings {
    customs_first: boolean;
    guestbook: boolean;
    prevent_bookmarks: boolean;
    public: boolean;
    show_friends: boolean;
}

export interface MappingList {
    kinks: KinkListItem[];
    kink_groups: KinkGroupListItem[];
    infotags: InfotagListItem[];
    infotag_groups: InfotagGroupListItem[];
    listitems: ListItemsListItem[];
}
export interface KinkListItem {
    id: string;
    name: string;
    description: string;
    group_id: string;
}
export interface KinkGroupListItem {
    id: string;
    name: string;
}
export interface InfotagListItem {
    id: string;
    name: string;
    type: "text" | "list";
    list: string;
    group_id: string;
}
export interface InfotagGroupListItem {
    id: string;
    name: string;
}
export interface ListItemsListItem {
    id: string;
    name: string;
    value: string;
}

export interface ProfileFieldsInfoList {
    [id: string]: ProfileFieldsSectionGroup;
}
export interface ProfileFieldsSectionGroup {
    group: string;
    items: ProfileFieldsSectionListItem[];
}
export interface ProfileFieldsSectionListItem {
    id: number;
    name: string;
    type: ProfileFieldsSectionListItemType;
    list?: string[];
}
export type ProfileFieldsSectionListItemType = "text" | "list";

export interface KinkList {
    [id: string]: KinkListGroup;
}
export interface KinkListGroup {
    group: string;
    items: KinkListGroupListItem[];
}
export interface KinkListGroupListItem {
    kink_id: number;
    name: string;
    description: string;
}

export interface FriendsList {
    bookmarklist: string[];
    friendlist: FriendsListFriend[];
    requestlist: FriendsListRequest[]; // incoming requests
    requestpending: FriendsListRequest[]; // outgoing requests
}
export interface FriendsListFriend {
    source: string; // name of your character
    dest: string;  // name of the friend
    last_online: number;  // time in seconds since the dest character last used the website (not very accurate)
}
export interface FriendsListRequest {
    dest: string;  // name of the pending friend
    id: number;
    source: string;  // name of your character
}


export const API_URL_BASE = "https://www.f-list.net/json";
export const TICKET_LIFETIME_MS = (1000 * 60 * 30);

interface CachedCredentials {
    account: string;
    password: string;
    ticket: ApiTicket | null;
    ticketExpiration: Date;
}

export class FListApiImpl implements FListApi {

    readonly apiTicketCache: ApiTicketCache = new ApiTicketCache();

    async getAuthenticatedApiAsync(account: string, password: string, cancellationToken: CancellationToken): Promise<FListAuthenticatedApi> {
        const result = new FListAuthenticatedApiImpl(this, account, password);
        await this.apiTicketCache.getApiTicketAsync(account, password, cancellationToken);
        return result;
    }

    private _mappingListPromise: Promise<MappingList> | null = null;

    getMappingListAsync(cancellationToken: CancellationToken): Promise<MappingList> {
        if (!this._mappingListPromise) {
            this._mappingListPromise = (async function() {
                const resp = await fetch("https://www.f-list.net/json/api/mapping-list.php");
                const result = await resp.json();
                return result;
            })();
        }
        return this._mappingListPromise;
    }

    private _profileFieldsInfoListPromise: Promise<ProfileFieldsInfoList> | null = null;

    getProfileFieldsInfoListAsync(cancellationToken: CancellationToken): Promise<ProfileFieldsInfoList> {
        if (!this._profileFieldsInfoListPromise) {
            this._profileFieldsInfoListPromise = (async function() {
                const resp = await fetch("https://www.f-list.net/json/api/info-list.php");
                const result = await resp.json();
                return result.info;
            })();
        }
        return this._profileFieldsInfoListPromise;
    }

    private _kinksListPromise: Promise<KinkList> | null = null;

    getKinksListAsync(cancellationToken: CancellationToken): Promise<KinkList> {
        if (!this._kinksListPromise) {
            this._kinksListPromise = (async function () {
                const resp = await fetch("https://www.f-list.net/json/api/kink-list.php");
                const result = await resp.json();
                return result.kinks;
            })();
        }
        return this._kinksListPromise;
    }
}

export class FListAuthenticatedApiImpl implements FListAuthenticatedApi {
    constructor(
        private readonly uapi: FListApiImpl,
        public readonly account: string,
        private readonly password: string) {

    }

    getAuthenticatedApiAsync(account: string, password: string, cancellationToken: CancellationToken): Promise<FListAuthenticatedApi> {
        return this.uapi.getAuthenticatedApiAsync(account, password, cancellationToken);
    }

    getMappingListAsync(cancellationToken: CancellationToken): Promise<MappingList> {
        return this.uapi.getMappingListAsync(cancellationToken);
    }

    getProfileFieldsInfoListAsync(cancellationToken: CancellationToken): Promise<ProfileFieldsInfoList> {
        return this.uapi.getProfileFieldsInfoListAsync(cancellationToken);
    }

    getKinksListAsync(cancellationToken: CancellationToken): Promise<KinkList> {
        return this.uapi.getKinksListAsync(cancellationToken);
    }

    async invalidateApiTicketAsync(ticket: string, cancellationToken: CancellationToken): Promise<void> {
        await this.uapi.apiTicketCache.invalidateTicketAsync(this.account, this.password, ticket);
    }

    async getApiTicketAsync(cancellationToken: CancellationToken): Promise<ApiTicket & HasFromCache> {
        const res = await this.uapi.apiTicketCache.getApiTicketAsync(this.account, this.password, cancellationToken);
        return res;
    }

    private async authenticatedFetchInner<T>(input: RequestInfo | URL, init: any, prepareRequestBody: (orig: any, ticket: string) => any): Promise<T> {
        const requestInner = async (ticket: string) => {
            const nformdata = prepareRequestBody(init, ticket);

            const innerInit = init ? { 
                    ...init,
                    signal: init?.cancellationToken?.signal,
                    body: nformdata
                } : {
                    body: nformdata
                };

            const resp = await fetch(input, innerInit);
            const respObj = (await resp.json()) as (T & { error: string });
            if (resp.status != 200) {
                throw new Error(`returned status code ${resp.status}: ${resp.statusText}`);
            }
            if (respObj.error != "Ticket or account missing." && respObj.error != "Invalid ticket.") {
                return respObj;
            }
            else {
                return null;
            }
        };

        let apiTicket = await this.getApiTicketAsync(init?.cancellationToken ?? CancellationToken.NONE);
        let resp = await requestInner(apiTicket.ticket);
        if (resp == null && apiTicket.fromCache) {
            await this.invalidateApiTicketAsync(apiTicket.ticket, init?.cancellationToken ?? CancellationToken.NONE);
            apiTicket = await this.getApiTicketAsync(init?.cancellationToken ?? CancellationToken.NONE);
            resp = await requestInner(apiTicket.ticket);
        }

        if (resp != null) {
            return resp;
        }
        else {
            throw new Error("API call failed, even with fresh ticket");
        }
    }

    private async authenticatedFetchJson<T>(input: RequestInfo | URL, init?: AuthenticatedRequestJsonInit): Promise<T> {
        const result = await this.authenticatedFetchInner<T>(input, init, (orig, ticket) => {
            const nformdata = { ...orig?.body, account: this.account, ticket: ticket };
            return JSON.stringify(nformdata);
        });
        return result;
    }

    private async authenticatedFetch<T>(input: RequestInfo | URL, init?: AuthenticatedRequestInit): Promise<T> {
        const result = await this.authenticatedFetchInner<T>(input, init, (orig, ticket) => {
            const nformdata = new FormData();
            if (init?.body) {
                init!.body.forEach((value, key) => {
                    nformdata.append(key, value);
                });
            }
            nformdata.append("account", this.account);
            nformdata.append("ticket", ticket);
            return nformdata;
        });
        return result;
    }

    async addBookmarkAsync(name: CharacterName, cancellationToken: CancellationToken): Promise<void> {
        const fd = new FormData();
        fd.append("name", name.value);

        const result = await this.authenticatedFetch<any>(API_URL_BASE + "/api/bookmark-add.php", {
            method: "post",
            body: fd
        });
        if (!StringUtils.isNullOrWhiteSpace(result.error)) {
            throw new Error(`Failed adding bookmark: ${result.error}`);
        }
    }

    async removeBookmarkAsync(name: CharacterName, cancellationToken: CancellationToken): Promise<void> {
        const fd = new FormData();
        fd.append("name", name.value);

        const result = await this.authenticatedFetch<any>(API_URL_BASE + "/api/bookmark-remove.php", {
            method: "post",
            body: fd
        });
        if (!StringUtils.isNullOrWhiteSpace(result.error)) {
            throw new Error(`Failed removing bookmark: ${result.error}`);
        }
    }

    async getCharacterProfileAsync(name: CharacterName, cancellationToken: CancellationToken): Promise<ProfileInfo> {
        const fd = new FormData();
        fd.append("name", name.value);

        const pi = await this.authenticatedFetch<ProfileInfo>(API_URL_BASE + "/api/character-data.php", {
            method: "POST",
            body: fd,
            cancellationToken: cancellationToken
        });
        if (!StringUtils.isNullOrWhiteSpace((pi as any).error)) {
            throw new Error(`Could not load profile data: ${(pi as any).error.toString()}`);
        }
        return pi;
    }

    async saveMemoAsync(name: CharacterName, memoText: string, cancellationToken: CancellationToken): Promise<string> {
        const fd = new FormData();
        fd.append("target_name", name.value);
        fd.append("note", memoText);
        const res = await this.authenticatedFetch<{note:string,error?:string}>(API_URL_BASE + "/json/api/character-memo-save.php", {
            method: "POST",
            body: fd,
            cancellationToken: cancellationToken
        });
        if (!StringUtils.isNullOrWhiteSpace(res.error)) {
            throw new Error(`Could not load profile data: ${res.error!.toString()}`);
        }
        return res.note;
    }

    async getFriendsListAsync(cancellationToken: CancellationToken): Promise<FriendsList> {
        const fd = new FormData();
        fd.append("bookmarklist", "true");
        fd.append("friendlist", "true");
        fd.append("requestlist", "true");
        fd.append("requestpending", "true");

        const pi = await this.authenticatedFetch<FriendsList>(API_URL_BASE + "/api/friend-bookmark-lists.php", {
            method: "POST",
            body: fd,
            cancellationToken: cancellationToken
        });
        if (!StringUtils.isNullOrWhiteSpace((pi as any).error)) {
            throw new Error(`Could not load friends/bookmarks data: ${(pi as any).error.toString()}`);
        }
        return pi;
    }
}

type AuthenticatedRequestInit = Omit<Omit<RequestInit, "signal">, "body"> & { cancellationToken?: CancellationToken, body: FormData };

type AuthenticatedRequestJsonInit = Omit<Omit<RequestInit, "signal">, "body"> & { cancellationToken?: CancellationToken, body: object };