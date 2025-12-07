using XarChat.FList2.FList2Api;

namespace XarChat.FList2.FList2Connection.Implementation
{
    internal class DefaultFList2ConnectionFactory : IFList2ConnectionFactory
    {
        private readonly IFList2ApiFactory _fList2ApiFactory;

        public DefaultFList2ConnectionFactory(
            IFList2ApiFactory fList2ApiFactory)
        {
            _fList2ApiFactory = fList2ApiFactory;
        }

        async Task<IFList2Connection> IFList2ConnectionFactory.CreateAsync(FList2ConnectionOptions options, CancellationToken cancellationToken)
            => await this.CreateAsync(options, cancellationToken);

        public async Task<DefaultFList2Connection> CreateAsync(FList2ConnectionOptions options, CancellationToken cancellationToken)
        {
            var completedSuccessfully = false;
            IFList2Api? api = null;
            try
            {
                api = await _fList2ApiFactory.CreateAsync(
                    new()
                    {
                        BaseUri = options.BaseUri ?? new Uri("https://test.f-list.net")
                    },
                    new()
                    {
                        Username = options.Username,
                        Password = options.Password
                    },
                    cancellationToken);

                var result = new DefaultFList2Connection(api);

                var tcs = new TaskCompletionSource();
                using var waitForConnectedHandler = result.AddConnectionStateChangedHandler(oldNew => { 
                    if (oldNew.NewValue == ConnectionState.Connected)
                    {
                        tcs.TrySetResult();
                    }
                });
                if (result.ConnectionState == ConnectionState.Connected)
                {
                    tcs.TrySetResult();
                }

                await tcs.Task;

                completedSuccessfully = true;
                return result;
            }
            finally
            {
                if (!completedSuccessfully)
                {
                    if (api is not null)
                    {
                        await api.DisposeAsync();
                    }
                }
            }
        }
    }
}
