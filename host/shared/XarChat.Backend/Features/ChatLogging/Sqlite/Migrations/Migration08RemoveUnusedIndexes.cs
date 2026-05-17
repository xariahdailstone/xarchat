using Microsoft.Data.Sqlite;
using XarChat.Backend.Common.DbSchema;

namespace XarChat.Backend.Features.ChatLogging.Sqlite.Migrations
{
    internal class Migration08RemoveUnusedIndexes : MigrationBase
    {
        protected override int Version => 8;

        public override bool VacuumAfterMigration => true;

        protected override async Task UpgradeSchema(SqliteConnection cnn, SqliteTransaction xa, CancellationToken cancellationToken)
        {
            await ExecuteNonQueryAsync(
                @"DROP INDEX ix_channelmessage_bytextstringid",
                cnn, xa, cancellationToken);

            await ExecuteNonQueryAsync(
                @"DROP INDEX ix_channelmessage_ordered",
                cnn, xa, cancellationToken);
        }
    }
}
