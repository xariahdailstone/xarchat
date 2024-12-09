import { CharacterName } from "../shared/CharacterName";
import { CancellationToken } from "../util/CancellationTokenSource";
import { IXarHost2HostInterop } from "../util/HostInterop";
//import { SqliteConnection } from "../util/sqlite/SqliteConnection";

export interface NewAppSettings {
    getSavedLoginsAsync(cancellationToken: CancellationToken): Promise<SavedLoginNew[]>;

    addSavedLoginAsync(account: string, characterName: CharacterName, cancellationToken: CancellationToken): Promise<void>;
    removeSavedLoginAsync(account?: string, characterName?: CharacterName, cancellationToken?: CancellationToken): Promise<void>;
}

export interface SavedLoginNew {
    readonly account: string;
    readonly characterName: CharacterName;
}

export class XarHost2NewAppSettings implements NewAppSettings {
    constructor(
        private readonly appSettings: IXarHost2HostInterop) {

    }

    async getSavedLoginsAsync(cancellationToken: CancellationToken): Promise<SavedLoginNew[]> {
        const resp = await this.appSettings.writeAndReadToXCHostSocketAsync({ cmd: "NewAppSettings.SavedLogins.get", data: {} }, cancellationToken);

        const result: SavedLoginNew[] = [];
        for (let x of resp.savedLogins) {
            result.push({
                account: x.accountName,
                characterName: CharacterName.create(x.characterName)
            });
        }
        return result;
    }

    async addSavedLoginAsync(account: string, characterName: CharacterName, cancellationToken: CancellationToken): Promise<void> {
        await this.appSettings.writeAndReadToXCHostSocketAsync({ 
            cmd: "NewAppSettings.SavedLogins.add",
            data: {
                accountName: account,
                characterName: characterName.value
            }
        }, cancellationToken);
    }

    async removeSavedLoginAsync(account?: string | undefined, characterName?: CharacterName | undefined, cancellationToken?: CancellationToken | undefined): Promise<void> {
        await this.appSettings.writeAndReadToXCHostSocketAsync({ 
            cmd: "NewAppSettings.SavedLogins.remove",
            data: {
                accountName: account ?? null,
                characterName: characterName?.value ?? null
            }
        }, cancellationToken);
    }

}

// export class SqliteAppSettingsNew implements AppSettingsNew {
//     constructor(
//         private readonly connection: SqliteConnection) {

//     }

//     async getSavedLoginsAsync(cancellationToken: CancellationToken): Promise<SavedLoginNew[]> {
//         return await using(this.connection.createCommand(), async cmd => {
//             cmd.commandText = `SELECT * FROM savedLogins`;
//             return await using(await cmd.executeReaderAsync(cancellationToken), async dr => {
//                 const result: SavedLoginNew[] = [];
//                 while (await dr.readAsync(cancellationToken)) {
//                     result.push({
//                         account: dr.getValue("account") as string,
//                         characterName: CharacterName.create(dr.getValue("characterName") as string)
//                     });
//                 }
//                 return result;
//             });
//         });
//     }

//     async addSavedLoginAsync(account: string, characterName: CharacterName, cancellationToken: CancellationToken): Promise<void> {
//         return await using(this.connection.createCommand(), async cmd => {
//             cmd.commandText = `INSERT INTO savedLogins(account, characterName) VALUES(@account, @characterName)`;
//             cmd.parameters.add("@account", account);
//             cmd.parameters.add("@characterName", characterName.value);
//             await cmd.executeNonQueryAsync(cancellationToken);
//         });
//     }

//     async removeSavedLoginAsync(account?: string, characterName?: CharacterName, cancellationToken?: CancellationToken): Promise<void> {
//         cancellationToken = cancellationToken ?? CancellationToken.NONE;
//         if (account == null && characterName == null) {
//             return;
//         }

//         return await using(this.connection.createCommand(), async cmd => {
//             if (account != null && characterName != null) {
//                 cmd.commandText = `DELETE FROM savedLogins WHERE account = @account AND LOWER(characterName) = LOWER(@characterName)`;
//                 cmd.parameters.add("@account", account);
//                 cmd.parameters.add("@characterName", characterName.value);
//             }
//             else if (account != null) {
//                 cmd.commandText = `DELETE FROM savedLogins WHERE account = @account`;
//                 cmd.parameters.add("@account", account);
//             }
//             else if (characterName != null) {
//                 cmd.commandText = `DELETE FROM savedLogins WHERE LOWER(characterName) = LOWER(@characterName)`;
//                 cmd.parameters.add("@characterName", characterName.value);
//             }
//             await cmd.executeNonQueryAsync(cancellationToken!);
//         });
//     }
// }
