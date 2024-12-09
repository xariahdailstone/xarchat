using Microsoft.Data.Sqlite;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Common.DbSchema;

namespace XarChat.Backend.Features.EIconIndexing.XariahNet.Migrations
{
    internal class EIconIndexMigration03AddImageChangeData : MigrationBase
    {
        protected override int Version => 3;

        protected override async Task UpgradeSchema(SqliteConnection cnn, SqliteTransaction xa, CancellationToken cancellationToken)
        {
            await ExecuteNonQueryAsync(
                @"ALTER TABLE eicon
                    ADD etag TEXT",
                cnn, xa, cancellationToken);
            await ExecuteNonQueryAsync(
                @"ALTER TABLE eicon
                    ADD contentlength INTEGER",
                cnn, xa, cancellationToken);
        }
    }
}
