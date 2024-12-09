using Microsoft.Data.Sqlite;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Common.DbSchema;

namespace XarChat.Backend.Features.EIconIndexing.XariahNet.Migrations
{
    internal class EIconIndexMigration01Initial : MigrationBase
    {
        protected override int Version => 1;

        protected override async Task UpgradeSchema(SqliteConnection cnn, SqliteTransaction xa, CancellationToken cancellationToken)
        {
            await ExecuteNonQueryAsync(@"
                    create table eicon (
                        name text primary key,
                        addedat integer
                    );
                ", cnn, xa, cancellationToken);

            await ExecuteNonQueryAsync(@"
                    create table updatestate (
                        lastasof integer
                    );
                ", cnn, xa, cancellationToken);
        }

        protected override Task StoreSchemaVersionAsync(SqliteConnection cnn, SqliteTransaction xa, CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }

        protected override async Task<bool> NeedsUpgradeAsync(SqliteConnection cnn, SqliteTransaction xa, CancellationToken cancellationToken)
        {
            using var cmd = cnn.CreateCommand();
            cmd.Transaction = xa;
            cmd.CommandText = "SELECT COUNT(1) FROM sqlite_master WHERE type='table' AND name='eicon'";
            var result = await cmd.ExecuteScalarAsync(cancellationToken);
            return (result is DBNull) || (result is null) || ((long)result == 0);
        }
    }
}
