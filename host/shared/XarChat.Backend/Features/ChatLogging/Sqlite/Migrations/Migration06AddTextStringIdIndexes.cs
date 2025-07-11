using Microsoft.Data.Sqlite;
using XarChat.Backend.Common.DbSchema;

namespace XarChat.Backend.Features.ChatLogging.Sqlite.Migrations
{
    internal class Migration06AddTextStringIdIndexes : MigrationBase
    {
        protected override int Version => 6;

        protected override async Task UpgradeSchema(SqliteConnection cnn, SqliteTransaction xa, CancellationToken cancellationToken)
        {
            await ExecuteNonQueryAsync("create index ix_channelmessage_textstringid on channelmessage (textstringid asc)",
                cnn, xa, cancellationToken);
            await ExecuteNonQueryAsync("create index ix_channelmessage_textstringid on channelmessage (textstringid asc)",
                cnn, xa, cancellationToken);
        }
    }
}
