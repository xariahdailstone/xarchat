
export interface ValueReference<T> {
    readonly canRead: boolean;
    read(): T;

    readonly canWrite: boolean;
    write(value: T): void;
}

const SYM_VALUEREFS = Symbol("value references");
export function getValueReference<T, TProperty extends keyof T>(obj: T, propertyName: TProperty): ValueReference<T[TProperty]> {
    let vrefs: { [propName: string]: ValueReference<T[TProperty]> } | null | undefined = null;
    vrefs = (obj as any)[SYM_VALUEREFS];
    if (!vrefs) {
        vrefs = {};
        (obj as any)[SYM_VALUEREFS] = vrefs;
    }

    let tref = vrefs[propertyName as string];
    if (!tref) {
        tref = {
            canRead: true,
            canWrite: true,

            read: () => {
                return obj[propertyName];
            },

            write: (value: T[TProperty]) => {
                obj[propertyName] = value;
            }
        };
        vrefs[propertyName as string] = tref;
    }

    return tref;
}

export function getMappedValueReference<T, TProperty extends keyof T, TMappedType>(obj: T, propertyName: TProperty,
    mapReadFunc: (value: T[TProperty]) => TMappedType,
    mapWriteFunc: (value: TMappedType) => T[TProperty]): ValueReference<TMappedType> {

    const result: ValueReference<TMappedType> = {
        canRead: true,
        canWrite: true,

        read: () => {
            return mapReadFunc(obj[propertyName]);
        },

        write: (value: TMappedType) => {
            obj[propertyName] = mapWriteFunc(value);
        }
    };

    return result;  
}