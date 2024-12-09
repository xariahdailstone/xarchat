using Microsoft.Data.Sqlite;
using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization.Metadata;
using System.Threading.Tasks;
using XarChat.Backend.Common;
using XarChat.Backend.Features.AppDataFolder;

namespace XarChat.Backend.Features.LocalDataCache.Sqlite
{
    internal class SqliteLocalDataCacheImpl : ILocalDataCache, IDisposable
    {
        public SqliteLocalDataCacheImpl(IAppDataFolder appDataFolder)
        {
            var fn = Path.Combine(appDataFolder.GetAppDataFolder(), "cacheddata.db");

            _cnn = new Microsoft.Data.Sqlite.SqliteConnection($"Data Source={fn};Mode=ReadWriteCreate;Cache=Private;");
            _cnn.Open();

            CheckForSchema();
        }

        public void Dispose()
        {
            _disposeCts.Dispose();
        }

        private void CheckForSchema()
        {
            object? executeScalar(string sql)
            {
                using var cmd = _cnn.CreateCommand();
                cmd.CommandText = sql;
                return cmd.ExecuteScalar();
            }
            void executeNonQuery(string sql)
            {
                using var cmd = _cnn.CreateCommand();
                cmd.CommandText = sql;
                cmd.ExecuteNonQuery();
            }

            var exists = Convert.ToInt32(executeScalar("SELECT COUNT(1) FROM sqlite_master WHERE type='table' AND name='cacheddata'"));
            if (exists == 0)
            {
                executeNonQuery(@"
                    create table cacheddata (
                        cachekey text primary key,
                        val text not null,
                        updatedat integer not null
                    )
                ");
            }
        }

        private readonly CancellationTokenSource _disposeCts = new CancellationTokenSource();

        private readonly SemaphoreSlim _lock = new SemaphoreSlim(1);
        private IImmutableDictionary<string, CacheEntry> _memoryCache = ImmutableDictionary<string, CacheEntry>.Empty;
        private readonly SqliteConnection _cnn;

        public async Task<T> GetOrCreateAsync<T>(
            string cacheKey, 
            Func<CancellationToken, Task<T>> asyncCreationFunc, 
            TimeSpan maxAge, 
            JsonTypeInfo<T> jsonTypeInfo,
            CancellationToken cancellationToken)
        {
            var now = DateTime.UtcNow;
            var since = now - maxAge;
            TaskCompletionSource<string>? tcs = null;
            CacheEntry ce;

            if (!_memoryCache.TryGetValue(cacheKey, out ce) || ce.UpdatedAt >= since)
            {
                await _lock.WaitAsync(cancellationToken);
                try
                {
                    if (!_memoryCache.TryGetValue(cacheKey, out ce) || ce.UpdatedAt >= since)
                    {
                        var dce = await GetFromDatabaseAsync(cacheKey, since, cancellationToken);
                        if (dce == null)
                        {
                            tcs = new TaskCompletionSource<string>();
                            ce = new CacheEntry(cacheKey, tcs.Task, now);
                        }
                        else
                        {
                            ce = dce!;
                        }
                        _memoryCache = _memoryCache.SetItem(cacheKey, ce);
                    }
                }
                finally
                {
                    _lock.Release();
                }
            }

            if (tcs != null)
            {
                _ = Task.Run(async () =>
                {
                    try
                    {
                        var genResult = (await asyncCreationFunc(_disposeCts.Token))!;
                        var jsonResult = JsonUtilities.Serialize(genResult, jsonTypeInfo);
                        tcs.SetResult(jsonResult);
                        try
                        {
                            await WriteToDatabaseAsync(cacheKey, jsonResult, now, cancellationToken);
                        }
                        catch { }
                    }
                    catch (Exception ex)
                    {
                        await _lock.WaitAsync(cancellationToken);
                        try
                        {
                            if (Object.Equals(_memoryCache[cacheKey], ce))
                            {
                                _memoryCache = _memoryCache.Remove(cacheKey);
                            }
                        }
                        finally
                        {
                            _lock.Release();
                        }
                        tcs.SetException(ex);
                    }
                });
            }

            var completedTask = await Task.WhenAny(Task.Delay(-1, cancellationToken), ce.ValueTask);
            if (cancellationToken.IsCancellationRequested)
            {
                throw new OperationCanceledException(cancellationToken);
            }

            var str = await ce.ValueTask;
            var result = JsonUtilities.Deserialize<T>(str, jsonTypeInfo)!;
            return result;
        }

        private async Task WriteToDatabaseAsync(string cacheKey, string value, DateTime updatedAt, CancellationToken cancellationToken)
        {
            using (var cmd = _cnn.CreateCommand())
            {
                cmd.CommandText = "delete from cacheddata where cachekey = @cachekey";
                cmd.Parameters.Add("@cachekey", SqliteType.Text).Value = cacheKey;
                await cmd.ExecuteNonQueryAsync(cancellationToken);
            }
            using (var cmd = _cnn.CreateCommand())
            {
                cmd.CommandText = "insert into cacheddata(cachekey, val, updatedat) values (@cachekey, @text, @updatedat)";
                cmd.Parameters.Add("@cachekey", SqliteType.Text).Value = cacheKey;
                cmd.Parameters.Add("@text", SqliteType.Text).Value = value;
                cmd.Parameters.Add("@updatedat", SqliteType.Integer).Value = new DateTimeOffset(updatedAt).ToUnixTimeMilliseconds();
                await cmd.ExecuteNonQueryAsync(cancellationToken);
            }
        }

        private async Task<CacheEntry?> GetFromDatabaseAsync(string cacheKey, DateTime ifUpdatedSince, CancellationToken cancellationToken)
        {
            using var cmd = _cnn.CreateCommand();
            cmd.CommandText = "select val, updatedat from cacheddata where cachekey = @cachekey and updatedat >= @updatedat";
            cmd.Parameters.Add("@cachekey", SqliteType.Text).Value = cacheKey;
            cmd.Parameters.Add("@updatedat", SqliteType.Integer).Value = new DateTimeOffset(ifUpdatedSince).ToUnixTimeMilliseconds();
            using var dr = await cmd.ExecuteReaderAsync(cancellationToken);
            if (await dr.ReadAsync(cancellationToken))
            {
                var text = Convert.ToString(dr["val"])!;
                var updatedAt = Convert.ToInt64(dr["updatedat"]);
                var updatedAtDT = DateTimeOffset.FromUnixTimeMilliseconds(updatedAt).UtcDateTime;
                if (updatedAtDT > ifUpdatedSince)
                {
                    return new CacheEntry(cacheKey, Task.FromResult(text), updatedAtDT);
                }
                else
                {
                    return null;
                }
            }
            else
            {
                return null;
            }
        }

        private class CacheEntry
        {
            public CacheEntry(string cacheKey, Task<string> valueTask, DateTime updatedAt)
            {
                this.CacheKey = cacheKey;
                this.ValueTask = valueTask;
                this.UpdatedAt = updatedAt;
            }

            public string CacheKey { get; }

            public Task<string> ValueTask { get; }

            public DateTime UpdatedAt { get; }
        }
    }
}
