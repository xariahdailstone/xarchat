import { CollapseButton } from "../../../components/CollapseButton";
import { EL } from "../../EL";
import { BBCodeTag } from "../BBCodeTag";

export const BBCodeTagCollapseOLD = new BBCodeTag("collapse", true, true, (options, arg, content) => {
    const titleEl = EL("div", { class: "bbcode-collapse-title", "data-copycontent": "" }, [ arg ?? "" ]);

    const el = EL("div", { class: "bbcode-collapse", "data-copyprefix": content.rawOpenTag, "data-copysuffix": content.rawCloseTag }, [
        titleEl,
        EL("div", { class: "bbcode-collapse-body-outer", "data-copyinline": "true" }, [
            EL("div", { class: "bbcode-collapse-body", "data-copyinline": "true" }, content.nodes),
        ])
    ]);

    titleEl.addEventListener("click", () => {
        el.classList.toggle("bbcode-collapse-expanded");
    });

    return el;
});

export const BBCodeTagCollapse = new BBCodeTag("collapse", true, true, (options, arg, content) => {
    const elCollapseButton = EL("x-collapsebutton", { class: "bbcode-collapse-title-button" }, []) as CollapseButton;

    const titleTextEl = EL("div", { class: "bbcode-collapse-title-text" }, [
        arg ?? "" 
    ]);
    const titleEl = EL("div", { class: "bbcode-collapse-title", "data-copycontent": "" }, [ 
        elCollapseButton,
        titleTextEl 
    ]);

    const collapseBodyOuterEl = EL("x-collapsebody", { class: "bbcode-collapse-body-outer", "data-copyinline": "true" }, [
        EL("div", { class: "bbcode-collapse-body", "data-copyinline": "true" }, content.nodes),
    ]);

    const el = EL("div", { class: "bbcode-collapse", "data-copyprefix": content.rawOpenTag, "data-copysuffix": content.rawCloseTag }, [
        titleEl,
        collapseBodyOuterEl 
    ]);

    elCollapseButton.viewModel = null;
    elCollapseButton.target = collapseBodyOuterEl;
    elCollapseButton.collapsed = true;

    titleTextEl.addEventListener("click", () => {
        elCollapseButton.collapsed = !elCollapseButton.collapsed;
    });

    return el;
});