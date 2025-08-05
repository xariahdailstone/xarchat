import { jsx, VNode, Fragment, init, styleModule, toVNode, propsModule, eventListenersModule } from "../../../snabbdom/index.js";
import { IDisposable } from "../../../util/Disposable";
import { CharacterGuestbookViewModel, GuestbookLoadingStatus } from "../../../viewmodel/dialogs/character-profile/CharacterGuestbookViewModel";
import { componentArea, componentElement } from "../../ComponentBase";
import { RenderingComponentBase } from "../../RenderingComponentBase";
import { BBCodeParseOptions } from "../../../util/bbcode/BBCode"
import { URLUtils } from "../../../util/URLUtils.js";
import { StringUtils } from "../../../util/StringUtils.js";
import { CancellationToken } from "../../../util/CancellationTokenSource.js";
import { WhenChangeManager } from "../../../util/WhenChange.js";
import { getEffectiveCharacterNameVNodes } from "../../../util/CharacterNameIcons.js";
import { CharacterGenderConvert } from "../../../shared/CharacterGender.js";
import { CharacterLinkUtils } from "../../../util/CharacterLinkUtils.js";

@componentArea("dialogs/character-profile")
@componentElement("x-characterguestbookpane")
export class CharacterGuestbookPane extends RenderingComponentBase<CharacterGuestbookViewModel> {
    constructor() {
        super();
    }

    render(): (VNode | [VNode, IDisposable]) {
        if (!this.viewModel) {
            return <></>;
        }
        else if (this.viewModel.loadingStatus == GuestbookLoadingStatus.LOADING) {
            return <div classList="guestbook-loading">Loading...</div>;
        }
        else {
            return <div classList="guestbook-page-display">{this.renderGuestbookPage(this.viewModel)}</div>;
        }
    }

    renderGuestbookPage(vm: CharacterGuestbookViewModel) {
        return <>
            {this.createPageNavigationBar(vm, "guestbook-page-navbar-top")}
            {this.renderGuestbookPosts(vm)}
            {this.createPageNavigationBar(vm, "guestbook-page-navbar-bottom")}
        </>
    }

    private readonly _parseOptionsWCM: WhenChangeManager = new WhenChangeManager();
    private _bbcodeParseOptions: BBCodeParseOptions = null!;

    renderGuestbookPosts(vm: CharacterGuestbookViewModel): VNode[] {
        const result: VNode[] = [];

        const locale = vm.session.appViewModel.locale;

        this._parseOptionsWCM.assign({ sink: vm.session.bbcodeSink, appViewModel: vm.session.appViewModel, session: vm.session },
            (v) => {
                this._bbcodeParseOptions = {
                    sink: v.sink,
                    addUrlDomains: true,
                    appViewModel: v.appViewModel,
                    activeLoginViewModel: v.session,
                    channelViewModel: undefined,
                    imagePreviewPopups: true,
                    syncGifs: true
                }
            });
        const po = this._bbcodeParseOptions;

        for (let post of vm.posts) {
            const hasReply = post.reply;

            const posterChar = CharacterLinkUtils.createCharacterLinkVNode(vm.session, post.character);
            const selfChar = CharacterLinkUtils.createCharacterLinkVNode(vm.session, vm.character);

            result.push(<div classList={["guestbook-post", hasReply ? "guestbook-post-hasreply" : null]}>
                <div classList="guestbook-post-info">
                    <img classList="guestbook-poster-image" attr-src={URLUtils.getAvatarImageUrl(post.character)}></img>
                    <div classList={["guestbook-poster-name"]}><b>{posterChar}</b></div>
                    <div classList="guestbook-datetime">Posted <span>{StringUtils.dateToString(locale, post.postedAt, { dateStyle: "long", timeStyle: "short" })}</span></div>
                </div>
                <div classList="guestbook-message"><x-bbcodedisplay props={{ "viewModel": post.message, parseOptions: po, parser: "profilenoimg" }} ></x-bbcodedisplay></div>
                { hasReply 
                    ? <div classList="guestbook-reply-section">
                        <div classList="guestbook-reply-intro">Reply by <b>{selfChar}</b>:</div>
                        <div classList="guestbook-reply"><x-bbcodedisplay props={{ "viewModel": post.reply, parseOptions: po, parser: "profilenoimg" }} ></x-bbcodedisplay></div>
                      </div>
                    : <></> }
            </div>);
        }
        return result;
    }

    createPageNavigationBar(vm: CharacterGuestbookViewModel, className: string) {
        return <div classList={["guestbook-page-navbar", className]}>
            { vm.hasPrevPage
                ? <button classList="guestbook-page-navbar-prev"
                    on={{ "click": (e) => { vm.navigateToPageAsync(vm.page - 1, CancellationToken.NONE); } }}>&lt; Previous Page</button>
                : <></> }
            <div classList="guestbook-page-navbar-current">Page <span>{vm.page + 1}</span></div>
            { vm.hasNextPage
                ? <button classList="guestbook-page-navbar-next"
                    on={{ "click": (e) => { vm.navigateToPageAsync(vm.page + 1, CancellationToken.NONE); } }}>Next Page &gt;</button>
                : <></> }
        </div>;
    }
}