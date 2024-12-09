using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace XarChat.Backend.Caching
{
    public class AsyncCache
    {
        private readonly TimeSpan _populateTimeout;
        private readonly TimeSpan _faultsCachedFor;

        public AsyncCache(TimeSpan populateTimeout, TimeSpan faultsCachedFor)
        {
            _populateTimeout = populateTimeout;
            _faultsCachedFor = faultsCachedFor;
        }

        private readonly SemaphoreSlim _lock = new SemaphoreSlim(1);
        private readonly Dictionary<string, CacheEntry> _cacheEntries = new Dictionary<string, CacheEntry>();

        public async Task<ValueWithCameFromCache<T>> GetOrCreateAsync<T>(string cacheKey,
            Func<Task<AsyncCacheCreationResult<T>>> createFunc, CancellationToken cancellationToken)
            where T : class
        {
            Task<ValueWithCameFromCache<T>>? creationFuncTask = null;
            TaskCompletionSource<object?>? tcs = null;
            CacheEntry? newCacheEntry = null;

            await _lock.WaitAsync();
            try
            {
                if (_cacheEntries.TryGetValue(cacheKey, out CacheEntry? entry) && entry.ExpiresAt > DateTimeOffset.UtcNow)
                {
                    creationFuncTask = entry.ValueTask.ContinueWith(t =>
                    {
                        var result = t.Result;
                        return new ValueWithCameFromCache<T>((result as T)!, true);
                    });
                }
                else
                {
                    tcs = new TaskCompletionSource<object?>();
                    newCacheEntry = new CacheEntry(cacheKey, tcs.Task, DateTimeOffset.UtcNow + _populateTimeout);
                    _cacheEntries[cacheKey] = newCacheEntry;
                }
            }
            finally
            {
                _lock.Release();
            }

            if (tcs != null)
            {
                var creationTask = createFunc();
                _ = creationTask.ContinueWith(t =>
                {
                    if (t.IsCompletedSuccessfully)
                    {
                        var result = t.Result;
                        newCacheEntry!.ExpiresAt = DateTimeOffset.UtcNow + result.ExpireAfter;
                        tcs.SetResult(result.Value);
                    }
                    else if (t.IsFaulted || t.IsCanceled)
                    {
                        newCacheEntry!.ExpiresAt = DateTimeOffset.UtcNow + _faultsCachedFor;
                        tcs.SetException(t.Exception!);
                    }
                });

                creationFuncTask = newCacheEntry!.ValueTask.ContinueWith(t =>
                {
                    var result = t.Result;
                    return new ValueWithCameFromCache<T>((result as T)!, false);
                });
            }

            var result = await creationFuncTask!;
            return result!;
        }

        private class CacheEntry
        {
            public CacheEntry(string cacheKey, Task<object?> valueTask, DateTimeOffset expiresAt)
            {
                this.CacheKey = cacheKey;
                this.ValueTask = valueTask;
                this.ExpiresAt = expiresAt;
            }

            public string CacheKey { get; }

            public Task<object?> ValueTask { get; }

            public DateTimeOffset ExpiresAt { get; set; }
        }
    }

    public class AsyncCacheCreationResult<T>
    {
        public AsyncCacheCreationResult(T value, TimeSpan expireAfter)
        {
            this.Value = value;
            this.ExpireAfter = expireAfter;
        }

        public T Value { get; }

        public TimeSpan ExpireAfter { get; }
    }

    public class ValueWithCameFromCache<T>
    {
        public ValueWithCameFromCache(T value, bool cameFromCache)
        {
            this.Value = value;
            this.CameFromCache = cameFromCache;
        }

        public T Value { get; set; }

        public bool CameFromCache { get; set; }
    }
}
