using Microsoft.Data.Sqlite;
using XarChat.Backend.Common.DbSchema;

namespace XarChat.Backend.Features.ChatLogging.Sqlite.Migrations
{
    internal class Migration09RemoveLoggedAds : MigrationBase
    {
        protected override int Version => 9;

        public override bool VacuumAfterMigration => true;

        protected override async Task UpgradeSchema(SqliteConnection cnn, SqliteTransaction xa, CancellationToken cancellationToken)
        {
            // Delete ads
            UpdateMigrationStatus("Removing ads from log");
            await ExecuteNonQueryAsync(
                @"DELETE FROM channelmessage WHERE messagetype = 1",
                cnn, xa, cancellationToken);

            // Remove unreferenced strings
            UpdateMigrationStatus("Removing unnecessary message text");
            await ExecuteNonQueryAsync(
                @"DELETE FROM strings WHERE NOT EXISTS (SELECT textstringid FROM channelmessage)",
                cnn, xa, cancellationToken);
        }
    }
}
