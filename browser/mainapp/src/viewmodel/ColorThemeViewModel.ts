import { AppViewModel } from "./AppViewModel";

export class ColorThemeViewModel {
    constructor(
        public readonly appViewModel: AppViewModel) {

        appViewModel.configBlock.observe("global.bgColor", (v: string) => {
            const parts = v.split(';');
            const hue = +parts[0];
            const sat = +parts[1];
            document.body.style.setProperty("--bg-base-hue", hue.toString());
            document.body.style.setProperty("--bg-base-sat", sat.toString() + "%");
        });
    }
}