import { HTMLUtils } from "../util/HTMLUtils";
import { IconImage } from "./IconImage";

let svgLoadPromise: Promise<string> | null = null;

function getSvgContentAsync(): Promise<string> {
    if (svgLoadPromise == null) {
        svgLoadPromise = new Promise(async (resolve) => {
            try {
                const resp = await fetch("assets/ui/loading-anim.svg");
                const body = await resp.text();
                resolve(body);
            }
            catch {
                resolve("");
            }
        });
    }

    return svgLoadPromise;
}

export class LoadingIcon extends HTMLElement {
    constructor() {
        super();

        const sroot = this.attachShadow({ mode: 'closed' });
        HTMLUtils.assignStaticHTMLFragment(sroot, `
            <style>
                :host {
                    position: relative;
                    width: 32px;
                    aspect-ratio: 1;
                    display: block;
                }
                .image-container {
                    width: 100%;
                    height: 100%;
                    --fgcolor: currentColor;
                }
                .image-container > * {
                    width: 100%;
                    height: 100%;
                }
            </style>
            <div class="image-container" id="elImgContainer">
            </div>
        `);
        const elImgContainer = sroot.getElementById("elImgContainer") as HTMLDivElement;

        (async function () {
            const content = await getSvgContentAsync();
            elImgContainer.innerHTML = content;
        })();
    }
}

window.customElements.define("x-loadingicon", LoadingIcon);