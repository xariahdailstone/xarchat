import { CharacterName } from "../../shared/CharacterName";
import { CancellationToken } from "../../util/CancellationTokenSource";

export interface FListApi {
    getAuthenticatedApiAsync(account: string, password: string, cancellationToken: CancellationToken): Promise<FListAuthenticatedApi>;
    getMappingListAsync(cancellationToken: CancellationToken): Promise<MappingList>;
    getProfileFieldsInfoListAsync(cancellationToken: CancellationToken): Promise<ProfileFieldsInfoList>;
    getKinksListAsync(cancellationToken: CancellationToken): Promise<KinkList>;

    getPartnerSearchFieldsAsync(cancellationToken: CancellationToken): Promise<PartnerSearchFieldsDefinitions>;
}

export interface FListAuthenticatedApi extends FListApi {
    readonly account: string;

    //invalidateApiTicketAsync(ticket: string, cancellationToken: CancellationToken): Promise<void>;
    getApiTicketAsync(cancellationToken: CancellationToken): Promise<ApiTicket>;

    getFriendsListAsync(cancellationToken: CancellationToken): Promise<FriendsList>;
    addBookmarkAsync(name: CharacterName, cancellationToken: CancellationToken): Promise<void>;
    removeBookmarkAsync(name: CharacterName, cancellationToken: CancellationToken): Promise<void>;

    getCharacterProfileAsync(name: CharacterName, cancellationToken: CancellationToken): Promise<ProfileInfo>;
    getCharacterFriendsAsync(name: CharacterName, cancellationToken: CancellationToken): Promise<ProfileFriendsInfo | null>;
    getGuestbookPageAsync(name: CharacterName, page: number, cancellationToken: CancellationToken): Promise<GuestbookPageInfo>;

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

export interface ProfileFriendsInfo {
    readonly friends: ProfileFriendsInfoItem[];
}
export interface ProfileFriendsInfoItem {
    id: number;
    name: string;
}

export interface GuestbookPageInfo {
    page: number;
    nextPage: boolean;
    canEdit: boolean;
    posts: GuestbookPostInfo[];
}
export interface GuestbookPostInfo {
    id: number;
    character: { id: number, name: string };
    postedAt: number;
    message: string;
    reply: string | null;
    private: boolean;
    approved: boolean;
    canEdit: boolean;
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

export interface PartnerSearchFieldsDefinitions {
    readonly genders: ReadonlyArray<string>;
    readonly orientations: ReadonlyArray<string>;
    readonly roles: ReadonlyArray<string>;
    readonly positions: ReadonlyArray<string>;
    readonly languages: ReadonlyArray<string>;
    readonly kinks: ReadonlyArray<PartnerSearchKink>;
}
export interface PartnerSearchKink {
    readonly name: string;
    readonly fetish_id: string;
}