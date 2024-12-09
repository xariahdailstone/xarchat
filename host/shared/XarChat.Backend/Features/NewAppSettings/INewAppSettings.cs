using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization.Metadata;
using System.Threading.Tasks;

namespace XarChat.Backend.Features.NewAppSettings
{
    public interface INewAppSettings
    {
        Task<TValue> GetValueSnapshotAsync<TValue>(string settingName, 
            JsonTypeInfo<TValue> jsonTypeInfo,
            Func<TValue> defaultValueCreator,
            CancellationToken cancellationToken);

        Task<INewAppSettingsCheckout<TValue>> CheckoutValueAsync<TValue>(string settingName,
            JsonTypeInfo<TValue> jsonTypeInfo,
            Func<TValue> defaultValueCreator,
            CancellationToken cancellationToken);
    }

    public interface INewAppSettingsCheckout<T> : IAsyncDisposable
    {
        T Value { get; set; }

        Task SaveChangeAsync(CancellationToken cancellationToken);
    }
}
