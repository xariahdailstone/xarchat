using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Text;
using XarChat.Backend.Common;

namespace XarChat.Backend.Features.XDNApiKeyManager.Impl
{
    internal class DefaultXDNApiKeyManager : IXDNApiKeyManager
    {
        private ImmutableDictionary<object, IXDNApiKeyProvider> _keyProviders
            = ImmutableDictionary<object, IXDNApiKeyProvider>.Empty;

        public IDisposable RegisterApiKeyProvider(IXDNApiKeyProvider provider)
        {
            var myKey = new object();
            if (ImmutableInterlocked.TryAdd(ref _keyProviders, myKey, provider))
            {
                return new ActionDisposable(() =>
                {
                    ImmutableInterlocked.TryRemove(ref _keyProviders, myKey, out var _);
                });
            }
            else
            {
                return ActionDisposable.Null;
            }
        }

        public async Task<string?> TryGetApiKeyAsync(CancellationToken cancellationToken)
        {
            var providers = _keyProviders;
            if (providers.Count == 0)
            {
                return null;
            }
            foreach (var provider in providers.Values)
            {
                try
                {
                    var result = await provider.GetApiKeyAsync(cancellationToken);
                    if (result != null)
                    {
                        return result;
                    }
                }
                catch { }
            }
            return null;
        }
    }
}
