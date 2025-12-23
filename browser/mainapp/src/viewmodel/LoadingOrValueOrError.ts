import { PromiseSource } from "../util/PromiseSource";

export class LoadingOrValueOrError<T> {
    private static readonly _loading: LoadingOrValueOrError<any> = new LoadingOrValueOrError(true, false, null, false, null);
    static loading() {
        return this._loading;
    }
    static error<T>(message: string) {
        return new LoadingOrValueOrError(false, true, message, false, null as T);
    }
    static value<T>(value: T) {
        return new LoadingOrValueOrError(false, false, null, true, value);
    }

    private constructor(
        public readonly isLoading: boolean,
        public readonly isError: boolean,
        public readonly error: string | null,
        public readonly isValue: boolean,
        public readonly value: T | null) {
    }
}
