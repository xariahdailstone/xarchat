import { StyleLoader } from "./components/ComponentBase.js";
import { MainInterface } from "./components/MainInterface.js";
import { HostInteropConfigBlock } from "./util/ConfigBlock.js";
import { HostInterop } from "./util/HostInterop.js";
import { KeyCodes } from "./util/KeyCodes.js";
import { hookRequestAnimationFrame } from "./util/RequestAnimationFrameHook.js";
import { polyfillRequestIdleCallback } from "./util/RequestIdleCallbackPolyfill.js";
import { setStylesheetAdoption, SharedStyleSheet } from "./util/StyleSheetPolyfill.js";
import { XarChatUtils } from "./util/XarChatUtils.js";
import { AppViewModel } from "./viewmodel/AppViewModel.js";
import { AppInitializeViewModel } from "./viewmodel/dialogs/AppInitializeViewModel.js";
import { registerDebuggingFunctions } from "./util/debugging/DebugUtils.js";

polyfillRequestIdleCallback();

registerDebuggingFunctions();

hookRequestAnimationFrame();
    
function onReady(func: Function) {
    if (/complete|interactive|loaded/.test(document.readyState)) {
        func();
    }
    else {
        document.addEventListener("DOMContentLoaded", () => func());
    }
}

function setClientVersionData() {
    const p = new URLSearchParams(document.location.search);
    const ver = p.get("ClientVersion");
    const platform = p.get("ClientPlatform");
    const branch = p.get("ClientBranch");
    if (ver) { XarChatUtils.clientVersion = ver; }
    if (platform) { XarChatUtils.clientPlatform = platform; }
    if (branch) { XarChatUtils.clientBranch = branch; }
}

//alert("in main.ts");
onReady(async () => {
    setClientVersionData();

    const elMain = document.createElement("x-maininterface");
    elMain.id = "elMain";
    document.body.insertBefore(elMain, document.body.firstChild);

    //alert("in main.onReady");
    const cb = await HostInteropConfigBlock.createAsync();

    if (window.CSS && typeof window.CSS.registerProperty == "function") {
        window.CSS.registerProperty({
            name: "--fgcolor",
            syntax: "<color>",
            inherits: true,
            initialValue: "#ffffff"
        });
        window.CSS.registerProperty({
            name: "--bgcolor",
            syntax: "<color>",
            inherits: true,
            initialValue: "#000000"
        });
        window.CSS.registerProperty({
            name: "--dot1color",
            syntax: "<color>",
            inherits: true,
            initialValue: "#ffffff"
        });
        window.CSS.registerProperty({
            name: "--dot2color",
            syntax: "<color>",
            inherits: true,
            initialValue: "#ffffff"
        });
        window.CSS.registerProperty({
            name: "--dot3color",
            syntax: "<color>",
            inherits: true,
            initialValue: "#ffffff"
        });
    }

    const allCssFiles = await HostInterop.getAllCssFilesAsync();
    for (let f of allCssFiles) {
        await StyleLoader.loadAsync(f);
    }
    
    loadDarkThemeCss();

    const p = new URLSearchParams(document.location.search);
    if (p.get("nogpu") == "1") {
        document.body.classList.add("nogpu");
    }

    window.addEventListener("dragenter", (e) => { e.preventDefault(); e.dataTransfer!.dropEffect = "none"; return false; });
    window.addEventListener("dragover", (e) => { e.preventDefault(); e.dataTransfer!.dropEffect = "none"; return false; });
    window.addEventListener("drop", (e) => { e.preventDefault(); return false; });

    let vm = new AppViewModel(cb);
    (window as any)["__vm"] = vm;

    HostInterop.registerWindowBoundsChangeCallback((loc) => {
        vm.applicationWindowMoved(loc);
    });
    
    (document.getElementById("elMain") as MainInterface).viewModel = vm;

    const initializeVM = new AppInitializeViewModel(vm);
    const dlgShowPromise = vm.showDialogAsync(initializeVM);
    initializeVM.runAsync(true);
    vm.isInStartup = false;
    await dlgShowPromise;
    
});

window.addEventListener("resize", (e) => {
    document.body.style.setProperty("--device-pixel-ratio", window.devicePixelRatio.toString());
});
document.body.style.setProperty("--device-pixel-ratio", window.devicePixelRatio.toString());

document.addEventListener("keydown", (e) => {
    if (e.keyCode == KeyCodes.KEY_R) {
        if (e.ctrlKey) {
            e.preventDefault();
            e.stopPropagation();
        }
    }
    else if (e.keyCode == KeyCodes.KEY_G) {
        if (e.ctrlKey && e.shiftKey) {
            HostInterop.performWindowCommandAsync(null, { cmd: "restartgpu" });
            e.preventDefault();
            e.stopPropagation();
        }
    }
    else if (e.keyCode == KeyCodes.KEY_P && e.ctrlKey) {
        e.preventDefault();
    }
    else if (e.keyCode == KeyCodes.F11) {
        e.preventDefault();
        HostInterop.showDevTools();
    }
});

async function loadDarkThemeCss() {
    const sss = await StyleLoader.loadAsync("styles/dark-theme.css");
    const sss2 = await StyleLoader.loadAsync("styles/bbcode.css");
    const customCssStlyesheet = await StyleLoader.loadAsync("/customcss");
    setStylesheetAdoption(document, [sss, sss2, customCssStlyesheet]);
    document.getElementById("elLinkDarkTheme")?.remove();
}
