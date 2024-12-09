
export interface ValueReference<T> {
    readonly canRead: boolean;
    read(): T;

    readonly canWrite: boolean;
    write(value: T): void;
}

export function getValueReference<T, TProperty extends keyof T>(obj: T, propertyName: TProperty): ValueReference<T[TProperty]> {
    const result: ValueReference<T[TProperty]> = {
        canRead: true,
        canWrite: true,

        read: () => {
            return obj[propertyName];
        },

        write: (value: T[TProperty]) => {
            obj[propertyName] = value;
        }
    };

    return result;
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