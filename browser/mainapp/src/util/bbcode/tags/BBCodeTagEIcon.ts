import { asDisposable } from "../../Disposable";
import { EL } from "../../EL";
import { EventListenerUtil } from "../../EventListenerUtil";
import { URLUtils } from "../../URLUtils";
import { getContentText } from "../BBCode";
import { BBCodeTag } from "../BBCodeTag";

export const syncGifs = (raisingEl: HTMLElement) => {
    let tel: (HTMLElement | null) = raisingEl;
    while (tel) {
        if (tel.classList.contains("bbcode-parsed")) {
            let allLoaded = true;
            const loadableEls =  tel.querySelectorAll("*[data-loaded]");
            if (loadableEls.length > 1) {
                const q = loadableEls.forEach(x => allLoaded = allLoaded && !!x.getAttribute("data-loaded"));
                if (allLoaded) {
                    for (let i = 0; i < loadableEls.length; i++) {
                        const reloadEl = (loadableEls.item(i) as HTMLImageElement);
                        if (!(reloadEl as any).__reloadedThisFrame) {
                            const tsrc = reloadEl.src;
                            reloadEl.src = '';
                            reloadEl.src = tsrc;
                            (reloadEl as any).__reloadedThisFrame = true;
                            window.requestAnimationFrame(() => {
                                delete (reloadEl as any).__reloadedThisFrame;
                            });
                        }
                    }
                }
            }
            break;
        }
        tel = tel.parentElement;
    }
};

let nextUniqueId = 1;
export const BBCodeTagEIcon = new BBCodeTag("eicon", true, false, 
    (context, arg, content) => {
        const contentText = getContentText(content);
        const url = URLUtils.getEIconUrl(contentText, context.parseOptions.eiconsUniqueLoadTag 
            ? context.parseOptions.eiconsUniqueLoadTag.replace("#", (nextUniqueId++).toString()) 
            : null);

        let persistentImg: (HTMLImageElement | null) = EL("img", { src: url });
        context.disposables.push(asDisposable(() => {
            persistentImg = null;
        }));

        let el: HTMLImageElement;
        if (arg) {
            el = EL("img", { 
                class: "bbcode-eicon", 
                title: `${contentText}\n@${arg}`
            });
        }
        else {
            el = EL("img", { 
                class: "bbcode-eicon", 
                title: contentText
            });
        }
        el.setAttribute("data-copycontent", `${content.rawOpenTag}${contentText}${content.rawCloseTag}`);

        if (context.parseOptions.syncGifs) {
            el.setAttribute("data-loaded", "false");
            const lhandler = EventListenerUtil.addDisposableEventListener(el, "load", () => {
                lhandler.dispose();
                el.setAttribute("data-loaded", "true");
                syncGifs(el);
            });

            let isIntersecting: (boolean | null) = null;
            const intersectObserver = new IntersectionObserver((entries) => {
                for (let e of entries) {
                    if (e.target == el) {
                        if (e.isIntersecting) {
                            if (isIntersecting == null || isIntersecting == false) {
                                syncGifs(el);
                            }
                            isIntersecting = e.isIntersecting;
                        }
                    }
                }
            });
            intersectObserver.observe(el);
            context.disposables.push(
                asDisposable(() => {
                    intersectObserver.disconnect();
                })
            );
        }

        el.classList.add("bbcode-eicon-loading");
        el.addEventListener("load", () => {
            el.classList.remove("bbcode-eicon-loading");
        });
        el.addEventListener("error", () => {
            el.classList.remove("bbcode-eicon-loading");
            el.classList.remove("bbcode-eicon-failedtoload");
        });

        el.setAttribute("src", url);

        return el;

        //return EL("div", { class: "bbcode-eicon-outershell", "data-copyinline": "true" }, [ el ]);

    });