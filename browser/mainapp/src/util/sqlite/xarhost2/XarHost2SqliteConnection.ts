// import { CancellationToken } from "../../CancellationTokenSource";
// import { IXarHost2HostInterop } from "../../HostInterop";
// import { SqliteCommand, SqliteConnection, SqliteDataReader, SqliteParameter, SqliteParameterSet, SqliteParameterValue } from "../SqliteConnection";

// export class XarHost2SqliteConnection implements SqliteConnection {
//     constructor(
//         private readonly hostInterop: IXarHost2HostInterop,
//         readonly connectionId: string) {

//     }

//     private _disposed: boolean = false;

//     private throwIfDisposed() {
//         if (this._disposed) {
//             throw new Error("sqlite connection disposed");
//         }
//     }

//     private readonly _activeCommands: Set<XarHost2SqliteCommand> = new Set();

//     createCommand(): SqliteCommand {
//         this.throwIfDisposed();
//         const result = new XarHost2SqliteCommand(this);
//         this._activeCommands.add(result);
//         return result;
//     }

//     commandDisposed(command: XarHost2SqliteCommand) {
//         this._activeCommands.delete(command);
//     }

//     dispose(): void {
//         if (!this._disposed) {
//             this._disposed = true;

//             for (let x of [...this._activeCommands.values()]) {
//                 x.dispose();
//             }

//             this.hostInterop.closeSqlConnection(this.connectionId);
//         }
//     }

//     async sendCommandAsync(cmd: any, cancellationToken: CancellationToken = CancellationToken.NONE): Promise<any> {
//         const result = await this.hostInterop.sendSqlCommandAsync(cmd, cancellationToken);
//         return result;
//     }
// }

// class XarHost2SqliteCommand implements SqliteCommand {
//     constructor(
//         readonly connection: XarHost2SqliteConnection) {

//         this.parameters = new XarHost2SqliteParameterSet(this);
//     }

//     private _disposed = false;

//     private throwIfDisposed() {
//         if (this._disposed) {
//             throw new Error("sqlite connection disposed");
//         }
//     }

//     commandText: string = "";

//     readonly parameters: XarHost2SqliteParameterSet;

//     async executeNonQueryAsync(cancellationToken: CancellationToken): Promise<number> {
//         this.throwIfDisposed();

//         const cmd = {
//             action: "executeNonQuery",
//             command: this.toJSON()
//         };
        
//         const result = await this.connection.sendCommandAsync(cmd);
//         return result.rowCount as number;
//     }

//     async executeScalarAsync(cancellationToken: CancellationToken): Promise<SqliteParameterValue | undefined> {
//         this.throwIfDisposed();

//         const cmd = {
//             action: "executeScalar",
//             command: this.toJSON()
//         };
        
//         const result = await this.connection.sendCommandAsync(cmd);
//         return result.result;
//     }

//     private readonly _currentReaders: Set<XarHost2SqliteDataReader> = new Set();

//     async executeReaderAsync(cancellationToken: CancellationToken): Promise<SqliteDataReader> {
//         this.throwIfDisposed();

//         const cmd = {
//             action: "executeReader",
//             command: this.toJSON()
//         };
        
//         const result = await this.connection.sendCommandAsync(cmd);
//         const readerId = result.readerId as number;
//         const resultObj = new XarHost2SqliteDataReader(this, readerId);
//         this._currentReaders.add(resultObj);
//         return resultObj;
//     }

//     readerDisposed(reader: XarHost2SqliteDataReader) {
//         this._currentReaders.delete(reader);
//     }

//     dispose(): void {
//         if (!this._disposed) {
//             this._disposed = true;
//             this.connection.commandDisposed(this);
//             for (let x of [...this._currentReaders.values()]) {
//                 x.dispose();
//             }
//         }
//     }

//     private toJSON(): any {
//         return {
//             commandText: this.commandText,
//             parameters: this.parameters.toJSON()
//         };
//     }
// }

// class XarHost2SqliteParameterSet implements SqliteParameterSet {
//     constructor(
//         private readonly command: XarHost2SqliteCommand) {
            
//     }

//     private readonly _paramsByName: Map<string, XarHost2SqliteParameter> = new Map();

//     get(name: string): SqliteParameter | null {
//         const res = this._paramsByName.get(name);
//         return res ?? null;
//     }

//     add(name: string, value?: SqliteParameterValue | undefined): SqliteParameter {
//         const p = new XarHost2SqliteParameter(this, name);
//         if (value !== undefined) {
//             p.value = value;
//         }
//         this._paramsByName.set(name, p);
//         return p;
//     }

//     toJSON(): any {
//         const result: any[] = [];
//         for (let x of this._paramsByName.values()) {
//             result.push(x.toJSON());
//         }
//         return result;
//     }
// }

// class XarHost2SqliteParameter implements SqliteParameter {
//     constructor(
//         private readonly parameterSet: XarHost2SqliteParameterSet,
//         name: string) {

//         this.name = name;
//     }

//     name: string;

//     value: SqliteParameterValue = null;

//     toJSON(): any {
//         return {
//             name: this.name,
//             value: this.value
//         };
//     }
// }

// class XarHost2SqliteDataReader implements SqliteDataReader {
//     constructor(
//         private readonly command: XarHost2SqliteCommand,
//         private readonly readerId: number) {

//     }

//     private _disposed = false;
//     private _currentRow: any = undefined;

//     private throwIfDisposed() {
//         if (this._disposed) {
//             throw new Error("sqlite connection disposed");
//         }
//     }

//     async readAsync(cancellationToken: CancellationToken): Promise<boolean> {
//         this.throwIfDisposed();

//         const cmd = {
//             action: "readerRead",
//             readerId: this.readerId
//         };

//         const resp = await this.command.connection.sendCommandAsync(cmd, cancellationToken);
//         if (resp.data) {
//             this._currentRow = resp.data;
//             return true;
//         }
//         else {
//             return false;
//         }
//     }

//     toObject() {
//         this.throwIfDisposed();
//         return this._currentRow;
//     }

//     getValue(name: string): SqliteParameterValue | undefined {
//         this.throwIfDisposed();
//         if (this._currentRow) {
//             return this._currentRow[name];
//         }
//         else {
//             return undefined;
//         }
//     }

//     dispose(): void {
//         if (!this._disposed) {
//             this._disposed = true;
//             this.command.readerDisposed(this);

//             this._currentRow = undefined;

//             const cmd = {
//                 action: "disposeReader",
//                 readerId: this.readerId
//             };
            
//             this.command.connection.sendCommandAsync(cmd);
//         }
//     }
// }