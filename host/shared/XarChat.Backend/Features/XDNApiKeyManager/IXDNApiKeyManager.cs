using System;
using System.Collections.Generic;
using System.Text;

namespace XarChat.Backend.Features.XDNApiKeyManager
{
    public interface IXDNApiKeyManager
    {
        Task<string?> TryGetApiKeyAsync(CancellationToken cancellationToken);

        IDisposable RegisterApiKeyProvider(IXDNApiKeyProvider provider);
    }

    public interface IXDNApiKeyProvider
    {
        Task<string?> GetApiKeyAsync(CancellationToken cancellationToken);
    }
}
