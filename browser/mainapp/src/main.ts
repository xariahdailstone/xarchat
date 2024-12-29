import { ChatViewModelSink } from "./ChatViewModelSink.js";
import { ComponentBase, StyleLoader } from "./components/ComponentBase.js";
import { MainInterface } from "./components/MainInterface.js";
import { ChatConnectionFactory, NullChatConnection } from "./fchat/ChatConnectionFactory.js";
import { ChannelMessageData } from "./fchat/ChatConnectionSink.js";
import { ChannelName } from "./shared/ChannelName.js";
import { CharacterGender, CharacterGenderConvert } from "./shared/CharacterGender.js";
import { CharacterName } from "./shared/CharacterName.js";
import { OnlineStatus, OnlineStatusConvert } from "./shared/OnlineStatus.js";
import { TypingStatus } from "./shared/TypingStatus.js";
import { CancellationToken } from "./util/CancellationTokenSource.js";
import { HostInteropConfigBlock } from "./util/ConfigBlock.js";
import { HostInterop } from "./util/HostInterop.js";
import { KeyCodes } from "./util/KeyCodes.js";
import { ObservableBase } from "./util/ObservableBase.js";
import { polyfillRequestIdleCallback } from "./util/RequestIdleCallbackPolyfill.js";
import { ActiveLoginViewModel } from "./viewmodel/ActiveLoginViewModel.js";
import { AppViewModel } from "./viewmodel/AppViewModel.js";
import { ChannelMessageViewModel, ChannelViewModel } from "./viewmodel/ChannelViewModel.js";
import { ChatChannelViewModel } from "./viewmodel/ChatChannelViewModel.js";
import { AppInitializeViewModel } from "./viewmodel/dialogs/AppInitializeViewModel.js";
import { LoginViewModel } from "./viewmodel/dialogs/LoginViewModel.js";



function onReady(func: Function) {
    if (/complete|interactive|loaded/.test(document.readyState)) {
        func();
    }
    else {
        document.addEventListener("DOMContentLoaded", () => func());
    }
}

function runChannelChatting(ch: ChatChannelViewModel) {
    // let i = 0;
    // window.setInterval(() => {
    //     ch.addChatMessage(new Date(), CharacterName.create("Xariah Dailstone"), `This is message for ${ch.title} #${i++}`);
    // }, 300);
}

function runStatusSetting(vm: ActiveLoginViewModel) {
    // window.setInterval(() => {
    //     vm.characterSet.setCharacterStatus(CharacterName.create("Xariah Dailstone"), {
    //         gender: CharacterGenderConvert.getRandom(),
    //         status: OnlineStatusConvert.getRandom()
    //     });
    // }, 750);
}

function createTestButton(vm: AppViewModel) {
    const btn = document.createElement("button");
    btn.style.position = "absolute";
    btn.style.top = "10px";
    btn.style.left = "10px";
    btn.style.zIndex = "99999999";
    btn.innerText = "test";

    btn.addEventListener("click", () => {
        // const builder = [];
        // for (let i = 0; i < 500; i++) {
        //     builder.push(`this is a test alert ${i}`);
        // }
        // vm.alertAsync(builder.join(""), "title");

        const ld = new LoginViewModel(vm);
        vm.showDialogAsync(ld);
    });

    document.body.appendChild(btn);
}

//alert("in main.ts");
onReady(async () => {
    const elMain = document.createElement("x-maininterface");
    elMain.id = "elMain";
    document.body.insertBefore(elMain, document.body.firstChild);

    polyfillRequestIdleCallback();
    
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

    const p = new URLSearchParams(document.location.search);
    if (p.get("nogpu") == "1") {
        document.body.classList.add("nogpu");
    }

    let vm = new AppViewModel(cb);
    (window as any)["__vm"] = vm;
    //vm.pingWords = [ "xariah" ];

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
});