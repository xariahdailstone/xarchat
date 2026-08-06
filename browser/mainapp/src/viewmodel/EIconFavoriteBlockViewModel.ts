import { asDisposable, IDisposable } from "../util/Disposable";
import { ObservableBase } from "../util/ObservableBase";
import { ObservableExpression } from "../util/ObservableExpression";
import { AppViewModel } from "./AppViewModel";

export type BlockStateChangedHandler = (eiconName: string, isBlocked: boolean) => any;

export class EIconFavoriteBlockViewModel extends ObservableBase {
    constructor(public readonly appViewModel: AppViewModel) {
        super();
    }

    isInConfigArray(configKey: string, eiconName: string): boolean {
        const eiconNameLower = eiconName.toLowerCase();
        const favs: string[] = ((this.appViewModel.configBlock.get(configKey) as (string[] | null)) ?? []);
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

    addBlockStateChangedHandler(eiconName: string, handler: BlockStateChangedHandler): IDisposable {
        const myKey = {};
        const oe = new ObservableExpression(
            () => this.isBlocked(eiconName),
            (v) => handler(eiconName, !!v),
            (err) => {}
        );
        return asDisposable(() => {
            oe.dispose();
        });
    }
}