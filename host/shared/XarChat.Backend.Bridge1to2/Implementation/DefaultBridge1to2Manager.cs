using System;
using System.Collections.Generic;
using System.Text;
using XarChat.FList2.FList2Api;

namespace XarChat.Backend.Bridge1to2.Implementation
{
    public class DefaultBridge1to2Manager : IBridge1to2Manager
    {
        private readonly SemaphoreSlim _stateSem = new SemaphoreSlim(1);
        private readonly HashSet<DefaultBridgeConnection> _openConnections = new HashSet<DefaultBridgeConnection>();

        private bool _disposed = false;

        public DefaultBridge1to2Manager(
            IFList2ApiInstanceManager apiInstanceManager)
        {
            this.FList2ApiInstanceManager = apiInstanceManager;
        }

        public IFList2ApiInstanceManager FList2ApiInstanceManager { get; }

        public async ValueTask DisposeAsync()
        {
            DefaultBridgeConnection[]? cnnsToClose = null;

            await _stateSem.WaitAsync(CancellationToken.None);
            try
            {
                if (!_disposed)
                {
                    _disposed = true;
                    cnnsToClose = _openConnections.ToArray();
                }
            }
            finally
            {
                _stateSem.Release();
            }

            if (cnnsToClose is not null)
            {
                var tasks = new List<ValueTask>();
                foreach (var cnn in cnnsToClose)
                {
                    tasks.Add(cnn.DisposeAsync());
                }
                await Task.WhenAll(tasks.Select(vt => vt.AsTask()));
            }
        }

        public async Task<IBridgeConnection> CreateConnectionAsync(CancellationToken cancellationToken)
        {
            await _stateSem.WaitAsync(cancellationToken);
            try
            {
                var cnn = new DefaultBridgeConnection(this);
                _openConnections.Add(cnn);
                return cnn;
            }
            finally
            {
                _stateSem.Release();
            }
        }

        internal async ValueTask ConnectionClosedAsync(DefaultBridgeConnection cnn)
        {
            await _stateSem.WaitAsync(CancellationToken.None);
            try
            {
                _openConnections.Remove(cnn);
            }
            finally
            {
                _stateSem.Release();
            }
        }
    }

    public interface IFList2ApiInstanceManager
    {
        Task<IFlist2ApiReference> GetOrCreateFList2ApiAsync(string account, string password, CancellationToken cancellationToken);
    }

    public interface IFlist2ApiReference : IAsyncDisposable
    {
        IFList2Api FList2Api { get; }
    }

    public class DefaultFList2ApiInstanceManager : IFList2ApiInstanceManager
    {
        private record struct AccountAndPassword(string Account, string Password);

        private class CachedApiEntry
        {
            public CachedApiEntry(IFList2Api api)
            {
                this.Flist2Api = api;
            }

            public IFList2Api Flist2Api { get; }

            public int RefCount { get; set; }
        }

        private class FList2ApiReference : IFlist2ApiReference
        {
            private bool _disposed = false;

            public FList2ApiReference(
                DefaultFList2ApiInstanceManager instanceManager, 
                AccountAndPassword accountAndPassword,
                IFList2Api api)
            {
                this.InstanceManager = instanceManager;
                this.AccountAndPassword = accountAndPassword;
                this.FList2Api = api;
            }

            public async ValueTask DisposeAsync()
            {
                if (!_disposed)
                {
                    _disposed = true;
                    await InstanceManager.DecrementRefCountAsync(this.AccountAndPassword);
                }
            }

            public DefaultFList2ApiInstanceManager InstanceManager { get; }
            public AccountAndPassword AccountAndPassword { get; }
            public IFList2Api FList2Api { get; }
        }

        private readonly SemaphoreSlim _stateSem = new SemaphoreSlim(1);
        private readonly IFList2ApiFactory _apiFactory;
        private readonly Dictionary<AccountAndPassword, CachedApiEntry> _activeApis
            = new Dictionary<AccountAndPassword, CachedApiEntry>();

        public DefaultFList2ApiInstanceManager(IFList2ApiFactory apiFactory)
        {
            _apiFactory = apiFactory;
        }

        public async Task<IFlist2ApiReference> GetOrCreateFList2ApiAsync(string account, string password, CancellationToken cancellationToken)
        {
            await _stateSem.WaitAsync(cancellationToken);
            try
            {
                if (!_activeApis.TryGetValue(new(account, password), out var apiEntry))
                {
                    var api = await _apiFactory.CreateAsync(new FList2ApiOptions()
                        {
                            BaseUri = new Uri("https://test.f-list.net/")
                        }, new FList2.FList2Api.Entities.LoginArgs()
                        {
                            Username = account,
                            Password = password
                        },
                        cancellationToken);
                    apiEntry = new CachedApiEntry(api);
                    _activeApis.Add(new(account, password), apiEntry);
                }
                apiEntry.RefCount++;
                return new FList2ApiReference(this, new(account, password), apiEntry.Flist2Api);
            }
            finally
            {
                _stateSem.Release();
            }
        }

        private async Task DecrementRefCountAsync(AccountAndPassword accountAndPassword)
        {
            await _stateSem.WaitAsync(CancellationToken.None);
            try
            {
                if (_activeApis.TryGetValue(accountAndPassword, out var apiEntry))
                {
                    apiEntry.RefCount--;
                    if (apiEntry.RefCount == 0)
                    {
                        _activeApis.Remove(accountAndPassword);
                        await apiEntry.Flist2Api.DisposeAsync();
                    }
                }
            }
            finally
            {
                _stateSem.Release();
            }
        }
    }
}
