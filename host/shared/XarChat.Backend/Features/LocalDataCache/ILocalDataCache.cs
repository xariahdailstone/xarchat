using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization.Metadata;
using System.Threading.Tasks;

namespace XarChat.Backend.Features.LocalDataCache
{
    public interface ILocalDataCache
    {
        Task<T> GetOrCreateAsync<T>(string cacheKey,
            Func<CancellationToken, Task<T>> asyncCreationFunc,
            TimeSpan maxAge,
            JsonTypeInfo<T> jsonTypeInfo,
            CancellationToken cancellationToken);

        Task EvictAsync(string cacheKey, CancellationToken cancellationToken);

        Task AssignAsync<T>(string cacheKey, T value, JsonTypeInfo<T> jsonTypeInfo, TimeSpan duration, CancellationToken cancellationToken);
    }
}
