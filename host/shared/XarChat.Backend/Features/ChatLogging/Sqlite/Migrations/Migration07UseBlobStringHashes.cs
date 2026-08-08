using Microsoft.Data.Sqlite;
using System;
using System.Collections.Generic;
using System.Text;
using XarChat.Backend.Common.DbSchema;

namespace XarChat.Backend.Features.ChatLogging.Sqlite.Migrations
{
    internal class Migration07UseBlobStringHashes : MigrationBase
    {
        protected override int Version => 7;

        public override bool VacuumAfterMigration => true;

        protected override async Task UpgradeSchema(SqliteConnection cnn, SqliteTransaction xa, CancellationToken cancellationToken)
        {
            UpdateMigrationStatus("Optimizing message text storage");

            cnn.CreateFunction("base64_encode", (byte[] data) => Convert.ToBase64String(data));
            cnn.CreateFunction("base64_decode", (string data) => Convert.FromBase64String(data));

            await ExecuteNonQueryAsync(
                @"DROP INDEX ix_strings_hash",
                cnn, xa, cancellationToken);

            await ExecuteNonQueryAsync(
                @"ALTER TABLE strings RENAME TO strings_old",
                cnn, xa, cancellationToken);

            await ExecuteNonQueryAsync(
                @"CREATE TABLE strings (
                    id integer primary key,
                    value text not null,
                    bhash blob not null
                  )",
                cnn, xa, cancellationToken);

            await ExecuteNonQueryAsync(
                @"INSERT INTO strings (id, value, bhash)
                  SELECT id, value, base64_decode(hash)
                  FROM strings_old
                ",
                cnn, xa, cancellationToken);

            await ExecuteNonQueryAsync(
                @"DROP TABLE strings_old
                ",
                cnn, xa, cancellationToken);

            UpdateMigrationStatus("Indexing message text storage");
            await ExecuteNonQueryAsync(
                @"CREATE UNIQUE INDEX ix_strings_bhash ON strings(bhash)
                ",
                cnn, xa, cancellationToken);
        }
    }
}
