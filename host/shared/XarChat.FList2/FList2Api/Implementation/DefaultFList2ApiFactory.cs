using Microsoft.Extensions.Logging;
using System.Collections.Immutable;
using System.Runtime.InteropServices;
using XarChat.FList2.FList2Api.Entities;
using XarChat.FList2.FList2Api.Implementation.Wrappers.DisposeWrapper;
using XarChat.FList2.FList2Api.Implementation.Wrappers.RetryingWrapper;

namespace XarChat.FList2.FList2Api.Implementation
{
    public class DefaultFList2ApiFactory : IFList2ApiFactory
    {
        private static readonly TimeSpan ExpireEntriesAfter = TimeSpan.FromSeconds(20);

        private readonly ILogger<DefaultFList2ApiFactory> _logger;

        public DefaultFList2ApiFactory(
            ILogger<DefaultFList2ApiFactory> logger)
        {
            _logger = logger;
        }

        private class CachedApiEntry : IDisposable
        {
            private readonly DefaultFList2ApiFactory _owner;
            private readonly FList2ApiOptions _options;
            private readonly LoginArgs _loginArgs;
            private readonly IFList2Api _api;

            public CachedApiEntry(DefaultFList2ApiFactory owner, FList2ApiOptions options, LoginArgs args, IFList2Api api)
            {
                _owner = owner;
                _options = options;
                _loginArgs = args;
                _api = api;
            }

            public void Dispose()
            {
                _ = _api.DisposeAsync();
            }

            public int RefCount { get; set; }

            public bool IsMatch(FList2ApiOptions options, LoginArgs args)
            {
                if (options.BaseUri == _options.BaseUri &&
                    args.Username == _loginArgs.Username &&
                    args.Password == _loginArgs.Password)
                {
                    return true;
                }
                else
                {
                    return false;
                }
            }

            public IFList2Api CreateNewRef()
            {
                this.RefCount++;
                var dw = new DisposeWrappedFList2Api(_api);
                dw.Disposed += async (o, e) =>
                {
                    _ = _owner.DecrementRefCountAsync(this);
                };
                return dw;
            }
        }

        private readonly SemaphoreSlim _cachedApiEntriesSem = new SemaphoreSlim(1);
        private readonly List<CachedApiEntry> _cachedApiEntries = new List<CachedApiEntry>();

        public async Task<IFList2Api> CreateAsync(FList2ApiOptions options, LoginArgs args, CancellationToken cancellationToken)
        {
            args.Username = args.Username.ToLower();

            await _cachedApiEntriesSem.WaitAsync(cancellationToken);
            try
            {
                foreach (var tcae in _cachedApiEntries)
                {
                    if (tcae.IsMatch(options, args))
                    {
                        _logger.LogInformation("Returning new ref to existing API instance");
                        return tcae.CreateNewRef();
                    }
                }

                _logger.LogInformation("Creating new API instance");
                Func<CancellationToken, Task<IFList2Api>> innerFactory = async (cancellationToken) =>
                {
                    var result = await DefaultFList2Api.CreateAsync(options, cancellationToken);
                    await result.LoginAsync(args, cancellationToken);
                    return result;
                };

                var inner = await innerFactory(cancellationToken);

                var api = new RetryingFList2Api(
                    inner,
                    recreateInnerFunc: innerFactory,
                    retryDelay: TimeSpan.FromSeconds(2));

                var cae = new CachedApiEntry(this, options, args, api);
                _cachedApiEntries.Add(cae);
                return cae.CreateNewRef();
            }
            finally
            {
                _cachedApiEntriesSem.Release();
            }
        }

        private async Task DecrementRefCountAsync(CachedApiEntry cae)
        {
            await _cachedApiEntriesSem.WaitAsync(CancellationToken.None);
            try
            {
                cae.RefCount--;
                _logger.LogInformation($"Decremented ref to API instance. Refs={cae.RefCount}");
                if (cae.RefCount == 0)
                {
                    _ = Task.Run(async () =>
                    {
                        await Task.Delay(ExpireEntriesAfter);
                        await _cachedApiEntriesSem.WaitAsync(CancellationToken.None);
                        try
                        {
                            if (cae.RefCount == 0)
                            {
                                _logger.LogInformation($"Zero ref API instance timed out");
                                _cachedApiEntries.Remove(cae);
                                cae.Dispose();
                            }
                        }
                        finally
                        {
                            _cachedApiEntriesSem.Release();
                        }
                    });
                }
            }
            finally
            {
                _cachedApiEntriesSem.Release();
            }
        }
    }
}
