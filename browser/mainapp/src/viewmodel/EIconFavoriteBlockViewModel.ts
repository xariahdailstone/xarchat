import { ObservableBase } from "../util/ObservableBase";
import { ActiveLoginViewModel } from "./ActiveLoginViewModel";

export class EIconFavoriteBlockViewModel extends ObservableBase {
    constructor(public readonly activeLoginViewModel: ActiveLoginViewModel) {
        super();
    }

    isInConfigArray(configKey: string, eiconName: string): boolean {
        const eiconNameLower = eiconName.toLowerCase();
        const favs: string[] = ((this.activeLoginViewModel.appViewModel.configBlock.get(configKey) as (string[] | null)) ?? []);
        for (let f of favs) {
            if (f.toLowerCase() == eiconNameLower) { return true; }
        }
        return false;
    }

    isFavorite(eiconName: string): boolean {
        return this.isInConfigArray("global.favoriteEIcons", eiconName);
    }

    isBlocked(eiconName: string): boolean {
        return this.isInConfigArray("global.blockedEIcons", eiconName);
    }
}