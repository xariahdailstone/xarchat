using Microsoft.Data.Sqlite;
using XarChat.Backend.Common.DbSchema;

namespace XarChat.Backend.Features.ChatLogging.Sqlite.Migrations
{
    internal class Migration04AddGenderStatusToPMLog : MigrationBase
    {
        protected override int Version => 4;

        protected override async Task UpgradeSchema(SqliteConnection cnn, SqliteTransaction xa, CancellationToken cancellationToken)
        {
            await ExecuteNonQueryAsync(
                @"ALTER TABLE pmconvomessage
                    ADD genderid INTEGER NOT NULL DEFAULT 0",
                cnn, xa, cancellationToken);
            await ExecuteNonQueryAsync(
                @"ALTER TABLE pmconvomessage
                    ADD onlinestatusid INTEGER NOT NULL DEFAULT 0",
                cnn, xa, cancellationToken);
        }
    }
}
