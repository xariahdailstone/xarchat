
export class ObjectUniqueId {
    static _idSym = Symbol("objectuniqueid");
    static _nextId = 1;

    static get(obj: object): number {
        if ((obj as any)[this._idSym] == null) {
            (obj as any)[this._idSym] = this._nextId++;
        }
        return (obj as any)[this._idSym];
    }
}