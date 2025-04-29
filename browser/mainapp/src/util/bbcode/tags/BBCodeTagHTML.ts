import { EL } from "../../EL";
import { HTMLUtils } from "../../HTMLUtils";
import { BBCodeParseContext, BBCodeParser, getContentText } from "../BBCode";
import { BBCodeTag } from "../BBCodeTag";

function setupCallbackWrappers(options: BBCodeParseContext, origNode: Node): Node {
    if (origNode.childNodes) {
        const origElChildren = origNode.childNodes;
        for (let i = 0; i < origElChildren.length; i++) {
            const origcnode = origElChildren[i];
            const newcnode = setupCallbackWrappers(options, origcnode);
            if (origcnode != newcnode) {
                origNode.insertBefore(newcnode, origcnode);
                origNode.removeChild(origcnode);
            }
        }
    }
    else {
        return origNode;
    }

    if (origNode.nodeType == Node.ELEMENT_NODE) {
        const origEl = (origNode as Element);

        if (origEl.hasAttribute("data-onclick")) {
            const onClickScriptStr = origEl.getAttribute("data-onclick")!;
            origEl.addEventListener("click", (e) => {
                const appViewModel = options.parseOptions.appViewModel;
                const activeLoginViewModel = options.parseOptions.activeLoginViewModel;
                const channelViewModel = options.parseOptions.channelViewModel;
                const f = eval("(function (e, appViewModel, activeLoginViewModel, channelViewModel) { " + onClickScriptStr + " })");
                return f(e, appViewModel, activeLoginViewModel, channelViewModel);
            });
        }
    }
    
    return origNode;
}

export const BBCodeTagHTML = new BBCodeTag("html", true, true, (options, arg, content) => {
    if (HTMLUtils.verifyHtmlBBCodeTagSignature(arg ?? "", getContentText(content))) {
        const res = EL("span", { class: "bbcode-html bbcode-html-valid", "data-copycontent": "" });
        const tel = document.createElement("template");
        tel.innerHTML = getContentText(content);

        const wrappedFrag = setupCallbackWrappers(options, tel.content.cloneNode(true));
        res.appendChild(wrappedFrag);

        BBCodeParser.markElementAsExcludedFromAutoUrlization(res);
        return res;
    }
    else {
        return EL("span", { class: "bbcode-html bbcode-html-invalid", "data-copycontent": "" });
    }
});