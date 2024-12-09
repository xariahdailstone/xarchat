using Microsoft.Data.Sqlite;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Common.DbSchema;

namespace XarChat.Backend.Features.EIconIndexing.XariahNet.Migrations
{
    internal class EIconIndexMigration02AddSchemaVersionTable : MigrationBase
    {
        protected override int Version => 2;

        protected override async Task<bool> NeedsUpgradeAsync(SqliteConnection cnn, SqliteTransaction xa, CancellationToken cancellationToken)
        {
            using var cmd = cnn.CreateCommand();
            cmd.Transaction = xa;
            cmd.CommandText = "SELECT COUNT(1) FROM sqlite_master WHERE type='table' AND name='schemaver'";
            var result = await cmd.ExecuteScalarAsync(cancellationToken);
            return (result is DBNull) || (result is null) || ((long)result == 0);
        }

        protected override async Task UpgradeSchema(SqliteConnection cnn, SqliteTransaction xa, CancellationToken cancellationToken)
        {
            await ExecuteNonQueryAsync(
                @"CREATE TABLE schemaver (
                    schemaversion INTEGER NOT NULL
                )",
                cnn, xa, cancellationToken);

            await ExecuteNonQueryAsync(
                @"INSERT INTO schemaver(schemaversion) VALUES (2)",
                cnn, xa, cancellationToken);
        }
    }
}
