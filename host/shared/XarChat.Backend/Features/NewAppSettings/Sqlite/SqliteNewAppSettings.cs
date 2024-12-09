using Microsoft.Data.Sqlite;
using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization.Metadata;
using System.Threading;
using System.Threading.Tasks;
using XarChat.Backend.Features.AppDataFolder;

namespace XarChat.Backend.Features.NewAppSettings.Sqlite
{
    internal class SqliteNewAppSettings : INewAppSettings, IDisposable
    {
        private readonly SemaphoreSlim _sem = new SemaphoreSlim(1);
        private readonly Microsoft.Data.Sqlite.SqliteConnection _connection;

        public SqliteNewAppSettings(
            IAppDataFolder appDataFolder)
        {
            var adf = appDataFolder.GetAppDataFolder();
            var fn = Path.Combine(adf, "appsettings.db");

            _connection = new Microsoft.Data.Sqlite.SqliteConnection($"Data Source={fn};Mode=ReadWriteCreate;Cache=Private;");
            _connection.Open();
        }

        public void Dispose()
        {
            _connection.Dispose();
        }

        private bool _schemaChecked = false;

        private async ValueTask CheckForSchema(CancellationToken cancellationToken)
        {
            if (_schemaChecked)
                return;

            using var su = new SqliteSchemaSetupUtility(_connection);

            await su.EnsureTableAsync("settings", [
                new EnsureField("name", SqliteType.Text, nullable: false, primaryKey: true),
                new EnsureField("jsonvalue", SqliteType.Text, nullable: false)
            ], cancellationToken);

            await su.CommitAsync(cancellationToken);
            _schemaChecked = true;
        }

        async Task<INewAppSettingsCheckout<TValue>> INewAppSettings.CheckoutValueAsync<TValue>(string settingName,
            JsonTypeInfo<TValue> jsonTypeInfo,
            Func<TValue> defaultValueCreator,
            CancellationToken cancellationToken)
            => await this.CheckoutValueAsync(settingName, jsonTypeInfo, defaultValueCreator, cancellationToken);

        public async Task<NewAppSettingsCheckout<TValue>> CheckoutValueAsync<TValue>(string settingName, 
            JsonTypeInfo<TValue> jsonTypeInfo,
            Func<TValue> defaultValueCreator,
            CancellationToken cancellationToken)
        {
            await CheckForSchema(cancellationToken);

            await _sem.WaitAsync(cancellationToken);
            try
            {
                TValue value;

                using var cmd = _connection.CreateCommand();
                cmd.CommandText = "SELECT jsonvalue FROM settings WHERE name = @name";
                cmd.Parameters.Add("@name", SqliteType.Text).Value = settingName;
                var dbValue = await cmd.ExecuteScalarAsync(cancellationToken);
                if (dbValue is DBNull || dbValue is null)
                {
                    value = defaultValueCreator();
                }
                else
                {
                    value = JsonSerializer.Deserialize(dbValue.ToString()!, jsonTypeInfo)!;
                }

                return new NewAppSettingsCheckout<TValue>(this, settingName, jsonTypeInfo, value, () =>
                {
                    _sem.Release();
                    return ValueTask.CompletedTask;
                });
            }
            catch
            {
                _sem.Release();
                throw;
            }
        }

        public async Task<TValue> GetValueSnapshotAsync<TValue>(
            string settingName, 
            JsonTypeInfo<TValue> jsonTypeInfo,
            Func<TValue> defaultValueCreator,
            CancellationToken cancellationToken)
        {
            await using var co = await this.CheckoutValueAsync<TValue>(settingName, jsonTypeInfo, defaultValueCreator, cancellationToken);
            return co.Value;
        }

        internal async Task ValueChanged<TValue>(string settingName, JsonTypeInfo<TValue> jsonTypeInfo, TValue value, CancellationToken cancellationToken)
        {
            using var cmd = _connection.CreateCommand();
            cmd.CommandText = "REPLACE INTO settings (name, jsonvalue) VALUES (@name, @jsonvalue)";
            cmd.Parameters.Add("@name", SqliteType.Text).Value = settingName;
            cmd.Parameters.Add("@jsonvalue", SqliteType.Text).Value = JsonSerializer.Serialize(value, jsonTypeInfo);
            await cmd.ExecuteNonQueryAsync(cancellationToken);
        }
    }

    internal class SqliteSchemaSetupUtility : IDisposable
    {
        private readonly SqliteConnection _cnn;
        private SqliteTransaction? _xa;

        public SqliteSchemaSetupUtility(SqliteConnection cnn)
        {
            _cnn = cnn;
        }

        public void Dispose()
        {
            if (_xa != null)
            {
                _xa.Dispose();
                _xa = null;
            }
        }

        public async Task CommitAsync(CancellationToken cancellationToken)
        {
            if (_xa != null)
            {
                await _xa.CommitAsync(cancellationToken);
                _xa.Dispose();
                _xa = null;
            }
        }

        private async Task<SqliteTransaction> GetOrCreateTransactionAsync(CancellationToken cancellationToken)
        {
            _xa = _xa ?? ((SqliteTransaction)await _cnn.BeginTransactionAsync(cancellationToken));
            return _xa;
        }

        public async Task EnsureTableAsync(string name, List<EnsureField> ensureFields, CancellationToken cancellationToken)
        {
            bool exists;
            using (var cmd = _cnn.CreateCommand())
            {
                cmd.Transaction = await GetOrCreateTransactionAsync(cancellationToken);
                cmd.CommandText = "SELECT COUNT(1) FROM sqlite_master WHERE type='table' AND name=@tablename";
                cmd.Parameters.Add("@tablename", SqliteType.Text).Value = name;
                exists = Convert.ToInt32(await cmd.ExecuteScalarAsync(cancellationToken)) > 0;
            }

            if (!exists)
            {
                var ctbuilder = new StringBuilder();
                ctbuilder.AppendLine($"create table {name} (");
                var isFirst = true;
                foreach (var fld in ensureFields)
                {
                    if (!isFirst)
                    {
                        ctbuilder.Append(", ");
                    }
                    fld.WriteSqlColumnSpec(ctbuilder);

                    isFirst = false;
                }
                ctbuilder.AppendLine(");");

                using var cmd = _cnn.CreateCommand();
                cmd.Transaction = await GetOrCreateTransactionAsync(cancellationToken);
                cmd.CommandText = ctbuilder.ToString();
                await cmd.ExecuteNonQueryAsync(cancellationToken);
            }
        }
    }

    internal record EnsureField(string name, SqliteType dbType, bool nullable = true, bool primaryKey = false)
    {
        public void WriteSqlColumnSpec(StringBuilder builder)
        {
            builder.Append(name);
            builder.Append(' ');
            switch (dbType)
            {
                case SqliteType.Integer:
                    builder.Append("integer ");
                    break;
                case SqliteType.Real:
                    builder.Append("real ");
                    break;
                case SqliteType.Blob:
                    builder.Append("blob ");
                    break;
                case SqliteType.Text:
                default:
                    builder.Append("text ");
                    break;
            }
            if (!nullable)
            {
                builder.Append("not null ");
            }
            if (primaryKey)
            {
                builder.Append("primary key ");
            }
        }
    }

    internal class NewAppSettingsCheckout<TValue> : INewAppSettingsCheckout<TValue>
    {
        private readonly SqliteNewAppSettings _owner;
        private readonly string _name;
        private readonly JsonTypeInfo<TValue> _jsonTypeInfo;
        private Func<ValueTask>? _onDispose;

        public NewAppSettingsCheckout(SqliteNewAppSettings owner, string name, JsonTypeInfo<TValue> jsonTypeInfo, TValue value, Func<ValueTask> onDispose)
        {
            _name = name;
            _owner = owner;
            _jsonTypeInfo = jsonTypeInfo;
            this.Value = value;
            _onDispose = onDispose;
        }

        public TValue Value { get; set; }

        private bool _disposed = false;
        public async ValueTask DisposeAsync()
        {
            if (!_disposed)
            {
                _disposed = true;

                if (_onDispose != null)
                {
                    await _onDispose.Invoke();
                    _onDispose = null;
                }
            }
        }

        public async Task SaveChangeAsync(CancellationToken cancellationToken)
        {
            await _owner.ValueChanged(_name, _jsonTypeInfo, this.Value, cancellationToken);
        }
    }
}
