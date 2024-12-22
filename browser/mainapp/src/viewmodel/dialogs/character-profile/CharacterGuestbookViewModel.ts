import { GuestbookPostInfo } from "../../../fchat/api/FListApi";
import { CharacterName } from "../../../shared/CharacterName";
import { CancellationToken } from "../../../util/CancellationTokenSource";
import { CatchUtils } from "../../../util/CatchUtils";
import { ObservableValue } from "../../../util/Observable";
import { ObservableBase, observableProperty } from "../../../util/ObservableBase";
import { Collection } from "../../../util/ObservableCollection";
import { ActiveLoginViewModel } from "../../ActiveLoginViewModel";

export class CharacterGuestbookViewModel extends ObservableBase {
    constructor(
        public readonly session: ActiveLoginViewModel,
        public readonly character: CharacterName) {

        super();
        this.navigateToPageAsync(0, CancellationToken.NONE);
    }

    private readonly _page: ObservableValue<number> = new ObservableValue(-1);
    private readonly _hasNextPage: ObservableValue<boolean> = new ObservableValue(false);
    private readonly _hasPrevPage: ObservableValue<boolean> = new ObservableValue(false);

    get page(): number { return this._page.value; }
    get hasNextPage(): boolean { return this._hasNextPage.value; }
    get hasPrevPage(): boolean { return this._hasPrevPage.value; }

    @observableProperty
    loadingStatus: GuestbookLoadingStatus = GuestbookLoadingStatus.LOADED;

    @observableProperty
    errorMessage: string | null = null;

    @observableProperty
    posts: Collection<CharacterGuestbookPostViewModel> = new Collection();

    @observableProperty
    canEdit: boolean = false;

    async navigateToPageAsync(page: number, cancellationToken: CancellationToken) {
        if (page != this._page.value) {
            this.loadingStatus = GuestbookLoadingStatus.LOADING;
            try {
                this._page.value = page;
                const gbPageInfo = await this.session.authenticatedApi.getGuestbookPageAsync(this.character, page, cancellationToken);

                this._hasNextPage.value = gbPageInfo.nextPage;
                const pc = new Collection<CharacterGuestbookPostViewModel>();
                for (let post of gbPageInfo.posts) {
                    pc.add(new CharacterGuestbookPostViewModel(this, post));
                }
                this.posts = pc;
                this.canEdit = gbPageInfo.canEdit;
                this.loadingStatus = GuestbookLoadingStatus.LOADED;
            }
            catch (e) {
                this.errorMessage = CatchUtils.getMessage(e);
                this.posts = new Collection();
                this.canEdit = false;
                this.loadingStatus = GuestbookLoadingStatus.ERROR;
            }
            this._hasPrevPage.value = (page > 0);
        }
    }
}

export class CharacterGuestbookPostViewModel extends ObservableBase {
    constructor(
        private readonly owner: CharacterGuestbookViewModel,
        private readonly post: GuestbookPostInfo) {

        super();
    }

    get character() { return CharacterName.create(this.post.character.name); }

    get postedAt() { return new Date(this.post.postedAt * 1000); }

    get message() { return this.post.message; }

    get reply() { return this.post.reply; }

    get private() { return this.post.private; }

    get approved() { return this.post.approved; }

    get canEdit() { return this.post.canEdit; }
}

export enum GuestbookLoadingStatus {
    LOADED,
    LOADING,
    ERROR
}