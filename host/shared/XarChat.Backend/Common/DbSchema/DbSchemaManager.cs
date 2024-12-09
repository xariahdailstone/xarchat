using Microsoft.Data.Sqlite;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace XarChat.Backend.Common.DbSchema
{
    internal static class DbSchemaManager
    {
        public static async Task<SqliteConnection> VerifySchemaAsync(
            string dbFilename,
            bool readOnly,
            IEnumerable<IMigration> migrations,
            CancellationToken cancellationToken)
        {
            var mode = readOnly ? "ReadOnly" : "ReadWriteCreate";
            var connStr = $"Data Source={dbFilename};Mode={mode};Cache=Shared;";
            var cnn = new SqliteConnection(connStr);
            try
            {
                await cnn.OpenAsync(cancellationToken);

                if (!readOnly)
                {
                    foreach (var mig in migrations)
                    {
                        await mig.RunAsync(cnn, cancellationToken);
                    }
                }

                return cnn;
            }
            catch (Exception )
            {
                if (cnn is not null)
                {
                    await cnn.DisposeAsync();
                }
                throw;
            }
        }
    }

    internal interface IMigration
    {
        Task RunAsync(SqliteConnection sqliteConnection, CancellationToken cancellationToken);
    }

    internal abstract class MigrationBase : IMigration
    {
        protected virtual async Task ExecuteNonQueryAsync(string sql, SqliteConnection cnn, SqliteTransaction xa, CancellationToken cancellationToken)
        {
            using var cmd = cnn.CreateCommand();
            cmd.CommandText = sql;
            cmd.Transaction = xa;
            await cmd.ExecuteNonQueryAsync(cancellationToken);
        }

        protected abstract int Version { get; }

        protected abstract Task UpgradeSchema(SqliteConnection cnn, SqliteTransaction xa, CancellationToken cancellationToken);

        protected virtual async Task StoreSchemaVersionAsync(SqliteConnection cnn, SqliteTransaction xa, CancellationToken cancellationToken)
        {
            await using (var cmd = cnn.CreateCommand())
            {
                cmd.Transaction = xa;
                cmd.CommandText = "UPDATE schemaver SET schemaversion = @newversion";
                cmd.Parameters.Add("@newversion", SqliteType.Integer).Value = this.Version;
                await cmd.ExecuteNonQueryAsync(cancellationToken);
            }
        }

        protected virtual async Task<bool> NeedsUpgradeAsync(SqliteConnection cnn, SqliteTransaction xa, CancellationToken cancellationToken)
        {
            await using (var cmd = cnn.CreateCommand())
            {
                try
                {
                    cmd.Transaction = xa;
                    cmd.CommandText = "SELECT schemaversion FROM schemaver";
                    var curVer = Convert.ToInt32(await cmd.ExecuteScalarAsync());
                    return curVer < this.Version;
                }
                catch
                {
                    return false;
                }
            }
        }

        public async Task RunAsync(SqliteConnection sqliteConnection, CancellationToken cancellationToken)
        {
            await using var xa = (SqliteTransaction)(await sqliteConnection.BeginTransactionAsync(cancellationToken));
            var needsUpgrade = await NeedsUpgradeAsync(sqliteConnection, xa, cancellationToken);
            if (needsUpgrade)
            {
                await UpgradeSchema(sqliteConnection, xa, cancellationToken);
                await StoreSchemaVersionAsync(sqliteConnection, xa, cancellationToken);
                await xa.CommitAsync(cancellationToken);
            }
        }
    }
}
