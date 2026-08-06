using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Text;

namespace XarChat.Backend.Features.FListApi.Impl
{
    internal class GetFromCacheResult<TKey, TValue>
    {
        public static GetFromCacheResult<TKey, TValue> Success(TKey key, TValue value, TimeSpan expiresIn)
            => new GetFromCacheResult<TKey, TValue>(key, value, expiresIn);

        public static GetFromCacheResult<TKey, TValue> Failure(TKey key, Exception exception, TimeSpan expiresIn)
            => new GetFromCacheResult<TKey, TValue>(key, exception, expiresIn);

        private readonly TKey _key;
        private readonly bool _isSuccess;
        private readonly TValue? _value;
        private readonly Exception? _exception;
        private readonly DateTime _createdAt;
        private readonly DateTime _expiresAt;

        private GetFromCacheResult(TKey key, TValue value, TimeSpan expiresIn)
        {
            _key = key;
            _isSuccess = true;
            _value = value;
            _exception = null;
            _createdAt = DateTime.UtcNow;
            _expiresAt = DateTime.UtcNow + expiresIn;
        }

        private GetFromCacheResult(TKey key, Exception exception, TimeSpan expiresIn)
        {
            _key = key;
            _isSuccess = false;
            _value = default;
            _exception = exception;
            _createdAt = DateTime.UtcNow;
            _expiresAt = DateTime.UtcNow + expiresIn;
        }

        public TKey Key => _key;
        
        public bool IsSuccess => _isSuccess;

        public TValue Value => _isSuccess ? _value! : throw new InvalidOperationException("Cache entry is a failure");

        public Exception Exception => !_isSuccess ? _exception! : throw new InvalidOperationException("Cache entry is a success");

        public DateTime CreatedAt => _createdAt;

        public DateTime ExpiresAt => _expiresAt;
    }

    internal interface IAsyncPopulateCache<TKey, TValue>
    {
        Task<(GetFromCacheResult<TKey, TValue> Result, bool CameFromCache, Guid UniqueCacheEntryId)> GetOrCreateAsync(
            TKey key,
            Func<CancellationToken, Task<GetFromCacheResult<TKey, TValue>>> onCreateValueFunc,
            CancellationToken cancellationToken);

        Task<(GetFromCacheResult<TKey, TValue> Result, Guid UniqueCacheEntryId)?> TryGetAsync(TKey key, CancellationToken cancellationToken);

        Task EvictAsync(TKey key, CancellationToken cancellationToken);

        Task EvictIfEqualAsync(TKey key, Guid uniqueCacheEntryId, CancellationToken cancellationToken);
    }

    internal class AsyncPopulateCache<TKey, TValue> : IAsyncPopulateCache<TKey, TValue>
        where TKey : notnull
    {
        private readonly TimeSpan _cacheFailuresDuration;

        private readonly SemaphoreSlim _cachedEntriesSem = new SemaphoreSlim(1);
        private IImmutableDictionary<TKey, CacheEntry> _cachedEntries
            = ImmutableDictionary<TKey, CacheEntry>.Empty;

        public AsyncPopulateCache(
            TimeSpan cacheFailuresDuration)
        {
            _cacheFailuresDuration = cacheFailuresDuration;
        }

        private class CacheEntry
        {
            public required Guid UniqueId { get; init; }
            public required TKey Key { get; init; }
            public required Task<GetFromCacheResult<TKey, TValue>> GetFromCacheResult { get; init; }
        }

        public async Task EvictAsync(TKey key, CancellationToken cancellationToken)
        {
            await _cachedEntriesSem.WaitAsync(cancellationToken);
            try
            {
                _cachedEntries = _cachedEntries.Remove(key);
            }
            finally
            {
                _cachedEntriesSem.Release();
            }
        }

        public async Task EvictIfEqualAsync(
            TKey key, Guid uniqueCacheEntryId, CancellationToken cancellationToken)
        {
            if (_cachedEntries.TryGetValue(key, out var result))
            {
                await _cachedEntriesSem.WaitAsync(cancellationToken);
                try
                {
                    if (_cachedEntries.TryGetValue(key, out result))
                    {
                        if (result.UniqueId == uniqueCacheEntryId)
                        {
                            _cachedEntries = _cachedEntries.Remove(key);
                        }
                    }
                }
                finally
                {
                    _cachedEntriesSem.Release();
                }
            }
        }

        public async Task<(GetFromCacheResult<TKey, TValue> Result, bool CameFromCache, Guid UniqueCacheEntryId)> GetOrCreateAsync(
            TKey key, 
            Func<CancellationToken, Task<GetFromCacheResult<TKey, TValue>>> onCreateValueFunc, 
            CancellationToken cancellationToken)
        {
        READAGAIN:
            CacheEntry? firstCheckCachedEntry = null;

            if (firstCheckCachedEntry is not null || _cachedEntries.TryGetValue(key, out firstCheckCachedEntry))
            {
                var fromCache = firstCheckCachedEntry.GetFromCacheResult.IsCompleted;
                var gfcr = await firstCheckCachedEntry.GetFromCacheResult;
                if (gfcr.ExpiresAt > DateTime.UtcNow)
                {
                    return (gfcr, fromCache, firstCheckCachedEntry.UniqueId);
                }
            }

            CacheEntry ce;

            await _cachedEntriesSem.WaitAsync(cancellationToken);
            try
            {
                if (_cachedEntries.TryGetValue(key, out var secondCheckCachedEntry)
                    && secondCheckCachedEntry == firstCheckCachedEntry)
                {
                    _cachedEntries = _cachedEntries.Remove(key);
                }
                else if (secondCheckCachedEntry is not null)
                {
                    firstCheckCachedEntry = secondCheckCachedEntry;
                    goto READAGAIN;
                }

                Task<GetFromCacheResult<TKey, TValue>> CreateResult()
                {
                    var tcs = new TaskCompletionSource<GetFromCacheResult<TKey, TValue>>();
                    Task.Run(async () =>
                    {
                        GetFromCacheResult<TKey, TValue> res;
                        try
                        {
                            res = await onCreateValueFunc(cancellationToken);
                        }
                        catch (Exception ex)
                        {
                            res = GetFromCacheResult<TKey, TValue>.Failure(key, ex, _cacheFailuresDuration);
                        }
                        tcs.TrySetResult(res);
                    });
                    return tcs.Task;
                }

                ce = new CacheEntry()
                {
                    UniqueId = Guid.NewGuid(),
                    Key = key,
                    GetFromCacheResult = CreateResult()
                };
                _cachedEntries = _cachedEntries.SetItem(key, ce);
            }
            finally
            {
                _cachedEntriesSem.Release(); 
            }

            var ngfcr = await ce.GetFromCacheResult;
            return (ngfcr, false, ce.UniqueId);
        }

        public async Task<(GetFromCacheResult<TKey, TValue> Result, Guid UniqueCacheEntryId)?> TryGetAsync(TKey key, CancellationToken cancellationToken)
        {
            if (_cachedEntries.TryGetValue(key, out var cachedEntry))
            {
                var gfcr = await cachedEntry.GetFromCacheResult;
                if (gfcr.ExpiresAt > DateTime.UtcNow)
                {
                    return (gfcr, cachedEntry.UniqueId);
                }
            }
            return null;
        }
    }
}
