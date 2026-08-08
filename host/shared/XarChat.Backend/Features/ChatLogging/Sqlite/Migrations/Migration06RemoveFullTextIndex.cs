using Microsoft.Data.Sqlite;
using XarChat.Backend.Common.DbSchema;

namespace XarChat.Backend.Features.ChatLogging.Sqlite.Migrations
{
    internal class Migration06RemoveFullTextIndex : MigrationBase
    {
        protected override int Version => 6;

        public override bool VacuumAfterMigration => true;

        protected override async Task UpgradeSchema(SqliteConnection cnn, SqliteTransaction xa, CancellationToken cancellationToken)
        {
            UpdateMigrationStatus("Removing full-text index");

            await ExecuteNonQueryAsync(
                @"DROP TRIGGER strings_ad",
                cnn, xa, cancellationToken);

            await ExecuteNonQueryAsync(
                @"DROP TRIGGER strings_ai",
                cnn, xa, cancellationToken);

            await ExecuteNonQueryAsync(
                @"DROP TRIGGER strings_au",
                cnn, xa, cancellationToken);

            //await ExecuteNonQueryAsync(
            //    @"DROP TABLE fts_strings_idx",
            //    cnn, xa, cancellationToken);

            //await ExecuteNonQueryAsync(
            //    @"DROP TABLE fts_strings_docsize",
            //    cnn, xa, cancellationToken);

            //await ExecuteNonQueryAsync(
            //    @"DROP TABLE fts_strings_data",
            //    cnn, xa, cancellationToken);

            //await ExecuteNonQueryAsync(
            //    @"DROP TABLE fts_strings_config",
            //    cnn, xa, cancellationToken);

            await ExecuteNonQueryAsync(
                @"DROP TABLE fts_strings",
                cnn, xa, cancellationToken);
        }
    }
}
