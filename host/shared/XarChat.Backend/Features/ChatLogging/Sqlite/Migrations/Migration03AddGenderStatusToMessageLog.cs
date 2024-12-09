using Microsoft.Data.Sqlite;
using XarChat.Backend.Common.DbSchema;

namespace XarChat.Backend.Features.ChatLogging.Sqlite.Migrations
{
    internal class Migration03AddGenderStatusToMessageLog : MigrationBase
    {
        protected override int Version => 3;

        protected override async Task UpgradeSchema(SqliteConnection cnn, SqliteTransaction xa, CancellationToken cancellationToken)
        {
            await ExecuteNonQueryAsync(
                @"ALTER TABLE channelmessage
                    ADD genderid INTEGER NOT NULL DEFAULT 0",
                cnn, xa, cancellationToken);
            await ExecuteNonQueryAsync(
                @"ALTER TABLE channelmessage
                    ADD onlinestatusid INTEGER NOT NULL DEFAULT 0",
                cnn, xa, cancellationToken);
        }
    }
}
