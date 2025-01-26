using Microsoft.Data.Sqlite;
using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Linq;
using System.Text;
using System.Text.Json;
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

            _ = PurgeEntriesLoopAsync(_disposeCts.Token);

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
        private readonly SemaphoreSlim _databaseLock = new SemaphoreSlim(1);
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
                        var oldCe = ce;

                        var dce = await GetFromDatabaseAsync(cacheKey, since, maxAge, cancellationToken);
                        if (dce == null)
                        {
                            tcs = new TaskCompletionSource<string>();
                            ce = new CacheEntry(this, cacheKey, tcs.Task, now, now + maxAge);
                        }
                        else
                        {
                            ce = dce!;
                        }

                        if (oldCe != null)
                        {
                            oldCe.Dispose();
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
                                ce.Dispose();
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

        public async Task EvictAsync(string cacheKey, CancellationToken cancellationToken)
        {
            await RemoveFromDatabaseAsync(cacheKey, cancellationToken);
        }

        public async Task AssignAsync<T>(string cacheKey, T value, JsonTypeInfo<T> jsonTypeInfo, TimeSpan duration, CancellationToken cancellationToken)
        {
            var now = DateTime.UtcNow;

            await WriteToDatabaseAsync(cacheKey,
                JsonSerializer.Serialize(value, jsonTypeInfo),
                now, cancellationToken);
        }

        private async Task RemoveFromDatabaseAsync(string cacheKey, CancellationToken cancellationToken)
        {
            await _databaseLock.WaitAsync(cancellationToken);
            try
            {
                using (var cmd = _cnn.CreateCommand())
                {
                    cmd.CommandText = "delete from cacheddata where cachekey = @cachekey";
                    cmd.Parameters.Add("@cachekey", SqliteType.Text).Value = cacheKey;
                    await cmd.ExecuteNonQueryAsync(cancellationToken);
                }
            }
            finally
            {
                _databaseLock.Release();
            }
        }

        private async Task WriteToDatabaseAsync(string cacheKey, string value, DateTime updatedAt, CancellationToken cancellationToken)
        {
            await RemoveFromDatabaseAsync(cacheKey, cancellationToken);

            await _databaseLock.WaitAsync(cancellationToken);
            try
            {
                using (var cmd = _cnn.CreateCommand())
                {
                    cmd.CommandText = "insert into cacheddata(cachekey, val, updatedat) values (@cachekey, @text, @updatedat)";
                    cmd.Parameters.Add("@cachekey", SqliteType.Text).Value = cacheKey;
                    cmd.Parameters.Add("@text", SqliteType.Text).Value = value;
                    cmd.Parameters.Add("@updatedat", SqliteType.Integer).Value = new DateTimeOffset(updatedAt).ToUnixTimeMilliseconds();
                    await cmd.ExecuteNonQueryAsync(cancellationToken);
                }
            }
            finally
            { 
                _databaseLock.Release(); 
            }
        }

        private async Task<CacheEntry?> GetFromDatabaseAsync(
            string cacheKey, DateTime ifUpdatedSince, TimeSpan maxAge, CancellationToken cancellationToken)
        {
            await _databaseLock.WaitAsync(cancellationToken);
            try
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
                        return new CacheEntry(this, cacheKey, Task.FromResult(text), updatedAtDT, updatedAtDT + maxAge);
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
            finally
            {
                _databaseLock.Release();
            }
        }

        private async Task PurgeEntriesLoopAsync(CancellationToken cancellationToken)
        {
            try
            {
                while (!cancellationToken.IsCancellationRequested)
                {
                    var deleteBefore = new DateTimeOffset(DateTime.UtcNow - TimeSpan.FromHours(24)).ToUnixTimeMilliseconds();
                    await _databaseLock.WaitAsync(cancellationToken);
                    try
                    {
                        using (var cmd = _cnn.CreateCommand())
                        {
                            cmd.CommandText = "delete from cacheddata where updatedat < @updatedat";
                            cmd.Parameters.Add("@updatedat", SqliteType.Text).Value = deleteBefore;
                            await cmd.ExecuteNonQueryAsync(cancellationToken);
                        }
                    }
                    finally
                    {
                        _databaseLock.Release();
                    }

                    await Task.Delay(TimeSpan.FromHours(1), cancellationToken);
                }
            }
            catch when (cancellationToken.IsCancellationRequested) { }
        }

        private async void ExpireCacheEntry(CacheEntry entry)
        {
            await _lock.WaitAsync(CancellationToken.None);
            try
            {
                if (_memoryCache.TryGetValue(entry.CacheKey, out var ce) && ce == entry)
                {
                    _memoryCache = _memoryCache.Remove(entry.CacheKey);
                }
            }
            finally
            {
                _lock.Release();
            }
        }

        private class CacheEntry : IDisposable
        {
            private readonly CancellationTokenSource _disposeCts = new CancellationTokenSource();

            public CacheEntry(SqliteLocalDataCacheImpl owner,
                string cacheKey, Task<string> valueTask, DateTime updatedAt, DateTime expiresAt)
            {
                this.Owner = owner;
                this.CacheKey = cacheKey;
                this.ValueTask = valueTask;
                this.UpdatedAt = updatedAt;
                this.ExpiresAt = expiresAt;

                _ = Task.Run(async () =>
                {
                    try
                    {
                        var waitDuration = ExpiresAt - DateTime.UtcNow;
                        if (waitDuration < TimeSpan.Zero)
                        {
                            waitDuration = TimeSpan.FromSeconds(1);
                        }
                        await Task.Delay(waitDuration, _disposeCts.Token);
                        this.Owner.ExpireCacheEntry(this);
                    }
                    catch when (_disposeCts.IsCancellationRequested) { }
                });
            }

            public void Dispose()
            {
                _disposeCts.Cancel();
            }

            private SqliteLocalDataCacheImpl Owner { get; }

            public string CacheKey { get; }

            public Task<string> ValueTask { get; }

            public DateTime UpdatedAt { get; }

            private DateTime ExpiresAt { get; }
        }
    }
}
