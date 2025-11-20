import { ImagePreviewPopupViewModel } from "../../../viewmodel/popups/ImagePreviewPopupViewModel";
import { LinkHintPopupViewModel } from "../../../viewmodel/popups/LinkHintPopupViewModel";
import { TweetPreviewPopupViewModel } from "../../../viewmodel/popups/TweetPreviewPopupViewModel";
import { CancellationToken } from "../../CancellationTokenSource";
import { EL } from "../../EL";
import { HostInterop } from "../../hostinterop/HostInterop";
import { LinkPreviewData, LinkPreviewImageData, LinkPreviewProvider, LinkPreviewVideoData } from "../../linkpreviews/LinkPreviewProvider";
import { URLUtils } from "../../URLUtils";
import { BBCodeParseContext, BBCodeParser, getContentText } from "../BBCode";
import { BBCodeTag } from "../BBCodeTag";

// function createTwitterPreviewTooltip(context: BBCodeParseContext, el: HTMLElement, u: URL) {
//     const pathParts = u.pathname.split('/');
//     const tweetId = (pathParts[pathParts.length - 2] != "photo") ? pathParts[pathParts.length - 1] : pathParts[pathParts.length - 3];

//     const appViewModel = context.parseOptions.appViewModel!;
//     let popupViewModel: (TweetPreviewPopupViewModel | null) = null;

//     el.addEventListener("mouseover", async () => {
//         const myPopupViewModel = new TweetPreviewPopupViewModel(appViewModel);
//         popupViewModel = myPopupViewModel;
//         myPopupViewModel.tweetId = tweetId;
//     });
//     el.addEventListener("mouseout", () => {
//         if (popupViewModel) {
//             popupViewModel.tweetId = null;
//             popupViewModel.dismissed();
//             popupViewModel = null;
//         }
//     });
// }

function createImageLoadPreviewTooltip(context: BBCodeParseContext, el: HTMLElement, linkUrl: string, previewUrl: string) {
    const appViewModel = context.parseOptions.appViewModel!;
    let popupViewModel: (ImagePreviewPopupViewModel | null) = null;

    el.addEventListener("mouseover", async () => {
        const myPopupViewModel = new ImagePreviewPopupViewModel(appViewModel, el);
        popupViewModel = myPopupViewModel;
        if (previewUrl && popupViewModel == myPopupViewModel) {
            myPopupViewModel.imageUrl = previewUrl;
        }
    });
    el.addEventListener("mouseout", () => {
        if (popupViewModel) {
            popupViewModel.imageUrl = null;
            popupViewModel.dismissed();
            popupViewModel = null;
        }
    });
}

async function prepareLinkHintPopupAsync(context: BBCodeParseContext, el: HTMLElement, linkUrl: string) {
    const appViewModel = context.parseOptions.appViewModel!;
    let popupViewModel: (LinkHintPopupViewModel | null) = null;

    el.addEventListener("mouseover", async () => {
        const myPopupViewModel = new LinkHintPopupViewModel(appViewModel, linkUrl);
        appViewModel.popups.push(myPopupViewModel);
        popupViewModel = myPopupViewModel;
    });
    el.addEventListener("mouseout", () => {
        if (popupViewModel) {
            appViewModel.popups.remove(popupViewModel);
            popupViewModel.dismissed();
            popupViewModel = null;
        }
    });
}

async function preparePreviewTooltipAsync(context: BBCodeParseContext, el: HTMLElement, linkUrl: string) {
    // if (u.host.endsWith("twitter.com")) {
    //     createTwitterPreviewTooltip(context, el, u);
    //     return;
    // }

    const appViewModel = context.parseOptions.appViewModel;
    if (appViewModel) {
        LinkPreviewProvider.addMouseOverPreview(appViewModel, linkUrl, el);
    }

    // const previewImageUrl = await URLUtils.getLinkedImagePreviewUrlAsync(linkUrl);
    // if (previewImageUrl != null) {
    //     createImageLoadPreviewTooltip(context, el, linkUrl, previewImageUrl);
    //     return;
    // }
}

export const BBCodeTagUrl = new BBCodeTag("url", true, true, (context, arg, content) => {
    const contentText = getContentText(content);
    const linkUrl = (arg ? arg : contentText)?.trim();

    let u: URL | null = null;
    try {
        u = new URL(linkUrl);
    }
    catch { }

    if (!linkUrl.startsWith("http://") && !linkUrl.startsWith("https://") || (u == null)) {
        return EL("span", { class: "bbcode-url-invalid", "data-copycontent": content.rawOpenTag + content.rawText + content.rawCloseTag }, [ `{invalid URL: ${linkUrl}}` ]);
    }

    //content = (content.length > 0) ? content : [ document.createTextNode(arg ?? "") ];
    let el: HTMLElement;
    if (arg) {
        let contentNodes = content.nodes;
        if (contentNodes.length == 0) {
            contentNodes = [
                EL("span", { class: "bbcode-url-autoinsert", "data-copycontent": "" }, [ arg ])
            ];
        }

        el = EL("a", { class: "bbcode-url", href: arg.trim(), "data-copyprefix": content.rawOpenTag, "data-copysuffix": content.rawCloseTag, "tabindex": "-1" }, [
            EL("div", {
                class: "bbcode-url-icon",
                "data-copycontent": ""
            }),
            ...contentNodes
        ]);
    }
    else {
        el = EL("a", { class: "bbcode-url", href: contentText.trim(), "data-copycontent": `[url]${contentText}[/url]`, "tabindex": "-1" }, [
            EL("div", {
                class: "bbcode-url-icon",
                "data-copycontent": ""
            }),
            ...content.nodes
        ]);
    }
    if (typeof context.parseOptions.sink?.webpageClick == "function") {
        el.addEventListener("click", (e) => {
            const href = el.getAttribute("href");
            if (href) {
                context.parseOptions.sink!.webpageClick.call(context.parseOptions.sink!, href, false, {
                    rightClick: false,
                    channelContext: context.parseOptions.channelViewModel,
                    targetElement: el
                });
                e.preventDefault();
            }
        });
    }

    // if (context.parseOptions.appViewModel) {
    //     const _ = prepareLinkHintPopupAsync(context, el, linkUrl);
    // }
    if (context.parseOptions.imagePreviewPopups && context.parseOptions.appViewModel) {
        const _ = preparePreviewTooltipAsync(context, el, linkUrl);
    }

    BBCodeParser.markElementAsExcludedFromAutoUrlization(el);

    if (context.parseOptions.addUrlDomains) {
        const infoEl = EL("span", { class: "bbcode-url-hint", "data-copycontent": "" }, [ ` [${u.hostname}]` ]);
        return [ el, infoEl ];
    }
    else {
        return el;
    }
});
