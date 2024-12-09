// import { CancellationToken } from "../CancellationTokenSource";
// import { Disposable } from "../Disposable";

// export interface SqliteConnection extends Disposable {
//     createCommand(): SqliteCommand;
// }

// export interface SqliteCommand extends Disposable {
//     commandText: string;
//     readonly parameters: SqliteParameterSet;

//     executeNonQueryAsync(cancellationToken: CancellationToken): Promise<number>;
//     executeScalarAsync(cancellationToken: CancellationToken): Promise<SqliteParameterValue | undefined>;

//     executeReaderAsync(cancellationToken: CancellationToken): Promise<SqliteDataReader>;
// }

// export interface SqliteParameterSet {
//     get(name: string): SqliteParameter | null;
//     add(name: string, value?: SqliteParameterValue): SqliteParameter;
// }

// export type SqliteParameterValue = string | number | null;

// export interface SqliteParameter {
//     name: string;
//     value: SqliteParameterValue;
// }

// export interface SqliteDataReader extends Disposable {
//     readAsync(cancellationToken: CancellationToken): Promise<boolean>;

//     toObject(): any;
//     getValue(name: string): SqliteParameterValue | undefined;
// }