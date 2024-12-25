import { CharacterName } from "../shared/CharacterName";
import { CharacterStatus } from "../shared/CharacterSet";
import { OnlineStatus } from "../shared/OnlineStatus";
import { IDisposable } from "../util/Disposable";
import { Collection } from "../util/ObservableCollection";
import { ObservableOrderedDictionaryImpl } from "../util/ObservableKeyedLinkedList";
import { KeyValuePair } from "../util/collections/KeyValuePair";
import { StdObservableCollectionChangeType } from "../util/collections/ReadOnlyStdObservableCollection";
import { ActiveLoginViewModel } from "./ActiveLoginViewModel";

export class CharacterNameSet extends ObservableOrderedDictionaryImpl<CharacterName, CharacterName> {
    constructor() {
        super(cn => cn, CharacterName.compare);
    }
}

export class UnsortedCharacterNameSet extends Collection<KeyValuePair<CharacterName, CharacterName>> {
    constructor() {
        super();
    }
}

export class OnlineWatchedCharsCharacterNameSet extends CharacterNameSet {
    constructor(
        private readonly activeLoginViewModel: ActiveLoginViewModel) {

        super();

        const csWatches: Map<CharacterName, IDisposable> = new Map();
        activeLoginViewModel.watchedChars.addCollectionObserver(entries => {
            for (let entry of entries) {
                switch (entry.changeType) {
                    case StdObservableCollectionChangeType.ITEM_ADDED:
                        {
                            const charName = entry.item.value;
                            const handleCharStatus = (cs: CharacterStatus) => {
                                const isOnline = cs.status != OnlineStatus.OFFLINE;
                                if (isOnline) {
                                    this.add(charName);
                                }
                                else {
                                    this.delete(charName);
                                }
                            };

                            const csWatch = activeLoginViewModel.characterSet.addStatusListenerDebug(
                                [ "OnlineWatchedCharsCharacterNameSet", charName ],
                                charName, handleCharStatus);
                            csWatches.set(charName, csWatch);
                            handleCharStatus(activeLoginViewModel.characterSet.getCharacterStatus(charName));
                        }
                        break;
                    case StdObservableCollectionChangeType.ITEM_REMOVED:
                        {
                            const charName = entry.item.value;
                            csWatches.get(charName)!.dispose();
                            csWatches.delete(charName);
                            this.delete(charName);
                        }
                        break;
                    case StdObservableCollectionChangeType.CLEARED:
                        {
                            for (let csw of csWatches.values()) {
                                csw.dispose();
                            }
                            csWatches.clear();
                            this.clear();
                        }
                        break;
                }
            }
        });
    }
}