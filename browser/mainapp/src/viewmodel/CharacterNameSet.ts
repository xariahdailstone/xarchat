import { CharacterName } from "../shared/CharacterName";
import { CharacterStatus } from "../shared/CharacterSet";
import { OnlineStatus } from "../shared/OnlineStatus";
import { CallbackSet } from "../util/CallbackSet";
import { IDisposable } from "../util/Disposable";
import { Collection } from "../util/ObservableCollection";
import { DictionaryChangeEvent, ObservableKeyExtractedOrderedDictionary, ObservableOrderedDictionaryImpl, ReadOnlyObservableOrderedDictionary } from "../util/ObservableKeyedLinkedList";
import { KeyValuePair } from "../util/collections/KeyValuePair";
import { StdObservableCollectionChangeType, StdObservableCollectionObserver } from "../util/collections/ReadOnlyStdObservableCollection";
import { ActiveLoginViewModel } from "./ActiveLoginViewModel";

export interface CharacterNameSet extends ObservableKeyExtractedOrderedDictionary<CharacterName, CharacterName> {
    clear(): void;

    rawHas(name: CharacterName): boolean;
}

export interface ReadOnlyCharacterNameSet extends ReadOnlyObservableOrderedDictionary<CharacterName, CharacterName> {
    rawHas(name: CharacterName): boolean;
}

export class CharacterNameSetImpl extends ObservableOrderedDictionaryImpl<CharacterName, CharacterName> {
    constructor() {
        super(cn => cn, CharacterName.compare, { useQuickHas: true });
    }
}

export class UnsortedCharacterNameSet extends Collection<KeyValuePair<CharacterName, CharacterName>> {
    constructor() {
        super();
    }
}