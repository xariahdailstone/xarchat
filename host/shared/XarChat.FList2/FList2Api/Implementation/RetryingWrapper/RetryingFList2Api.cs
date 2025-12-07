using XarChat.FList2.FList2Api.Entities;
using XarChat.FList2.FList2Api.Implementation.Firehose;
using System.Net;
using System.Threading;

namespace XarChat.FList2.FList2Api.Implementation.RetryingWrapper
{
    internal class RetryingFList2Api : IFList2Api, IAsyncDisposable
    {
        private readonly Func<Task<IFList2Api>> _innerFactory;
        private readonly TimeSpan _retryDelay;

        private readonly SemaphoreSlim _reprepSem = new SemaphoreSlim(1);
        private Task<IFList2Api>? _currentInner = null;
        private CancellationTokenSource _currentInnerCTS = new CancellationTokenSource();

        public RetryingFList2Api(Func<Task<IFList2Api>> innerFactory, TimeSpan retryDelay)
        {
            _innerFactory = innerFactory;
            _retryDelay = retryDelay;
            this.Firehose = new RetryingFirehose(this);
        }

        private bool _isDisposed = false;
        private readonly CancellationTokenSource _disposeCTS = new CancellationTokenSource();

        public async ValueTask DisposeAsync()
        {
            await _reprepSem.WaitAsync(CancellationToken.None);
            try
            {
                if (!_isDisposed)
                {
                    Console.WriteLine("disposing " + GetType().Name);
                    _isDisposed = true;
                    _disposeCTS.Cancel();
                }
            }
            finally
            {
                _reprepSem.Release();
            }
        }

        private void ThrowIfDisposed()
        {
            if (this._isDisposed) { throw new ObjectDisposedException(GetType().Name); }
        }

        public async Task Test_DropAPI()
        {
            await _reprepSem.WaitAsync(CancellationToken.None);
            try
            {
                await DropCurrentAPI(null);
            }
            finally
            {
                _reprepSem.Release(); 
            }
            //await this.DoWithCurrentFList2Api(
            //    cancellationToken: CancellationToken.None,
            //    func: async (api, cancellationToken) => { return 0; });
        }

        public async Task Test_DropWebSocket()
        {
            var api = (DefaultFList2Api)(await this._currentInner!);
            ((FirehoseManager)api.Firehose).Test_DropWebSocket();
        }

        private async Task<(Task<IFList2Api> apiTask, CancellationTokenSource apiCTS)> GetCurrentAPI(CancellationToken cancellationToken)
        {
            await _reprepSem.WaitAsync(cancellationToken);
            try
            {
                ThrowIfDisposed();

                if (_currentInner is null)
                {
                    _currentInnerCTS.Cancel();

                    Console.WriteLine(">>>> initializing new API");
                    _currentInner = _innerFactory();
                    _currentInnerCTS = new CancellationTokenSource();

                    _ = Task.Run(() => ApiChanged.Invoke(this, EventArgs.Empty));
                }

                return (_currentInner, _currentInnerCTS);
            }
            finally
            {
                _reprepSem.Release();
            }
        }

        private async Task<bool> DropCurrentAPI(object? ifEqualTo = null)
        {
            if (ifEqualTo is null || _currentInner == ifEqualTo)
            {
                Console.WriteLine(">>>> destroying previous API");
                _currentInnerCTS.Cancel();

                if (_currentInner != null)
                {
                    var ciTask = _currentInner;
                    _ = Task.Run(async () =>
                    {
                        var ci = await ciTask;
                        await ci.DisposeAsync();
                    });
                }

                _currentInner = null;
                _currentInnerCTS = new CancellationTokenSource();
                return true;
            }
            return false;
        }

        private CancellationTokenSource CreateDisposeLinkedCTS(CancellationToken cancellationToken)
            => CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, _disposeCTS.Token);

        // public CsrfTokenResponse CsrfToken => _inner.CsrfToken;

        public RetryingFirehose Firehose { get; }

        IFirehose IFList2Api.Firehose => this.Firehose;

        internal async Task<T> DoWithCurrentFirehoseAsync<T>(Func<IFirehose, CancellationToken, Task<T>> func, CancellationToken cancellationToken)
        {
            using var combinedCTS = CreateDisposeLinkedCTS(cancellationToken);

            return await DoWithCurrentFList2Api(
                cancellationToken: combinedCTS.Token,
                func: async (api, cancellationToken) =>
                {
                    var result = await func(api.Firehose, cancellationToken);
                    return result;
                });
        }

        internal event EventHandler ApiChanged;

        private async Task<T> DoWithCurrentFList2Api<T>(
            Func<IFList2Api, CancellationToken, Task<T>> func,
            CancellationToken cancellationToken)
        {
            using var dcts = CreateDisposeLinkedCTS(cancellationToken);

        TRYAGAIN:
            var (apiTask, apiCTS) = await GetCurrentAPI(dcts.Token);

            try
            {
                using var combinedCTS = CancellationTokenSource.CreateLinkedTokenSource(dcts.Token, apiCTS.Token);
                await await Task.WhenAny(apiTask, Task.Delay(-1, combinedCTS.Token));
                var api = await apiTask;

                var result = await func(api, combinedCTS.Token);
                return result;
            }
            catch (NeedNewApiException)
            {
                await _reprepSem.WaitAsync(cancellationToken);
                try
                {
                    if (await DropCurrentAPI(ifEqualTo: apiTask))
                    {
                        await Task.Delay(_retryDelay, cancellationToken);
                    }
                }
                finally
                {
                    _reprepSem.Release();
                }
                goto TRYAGAIN;
            }
            catch when (apiCTS.IsCancellationRequested || _currentInner != apiTask)
            {
                goto TRYAGAIN;
            }
            catch (Exception ex)
            {
                throw;
            }
        }

        private class NeedNewApiException : ApplicationException { }

        private async Task PerformWithRetryAsync(Func<IFList2Api, CancellationToken, Task> executeFunc, CancellationToken cancellationToken)
        {
            await this.PerformWithRetryAsync<int>(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    await executeFunc(api, cancellationToken);
                    return 0;
                });
        }


        private async Task<T> PerformWithRetryAsync<T>(
            Func<IFList2Api, CancellationToken, Task<T>> executeFunc, 
            CancellationToken cancellationToken)
        {
            var isFirstTry = true;
            var result = await DoWithCurrentFList2Api(
                cancellationToken: cancellationToken,
                func: async (api, cancellationToken) =>
                {
                    try
                    {
                        var result = await executeFunc(api, cancellationToken);
                        return result;
                    }
                    catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.Unauthorized && isFirstTry)
                    {
                        isFirstTry = false;
                        throw new NeedNewApiException();
                    }
                });
            return result;

        }

        public async Task AcceptPendingFriendRequestAsync(AcceptPendingFriendRequestArgs args, CancellationToken cancellationToken)
        {
            await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    await api.AcceptPendingFriendRequestAsync(args, cancellationToken);
                });
        }

        public async Task AddChatIgnore(int targetCharacterId, CancellationToken cancellationToken)
        {
            await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    await api.AddChatIgnore(targetCharacterId, cancellationToken);
                });
        }

        public async Task ChangeChatCharacterPresenceAsync(ChangeCharacterPresenceArgs args, CancellationToken cancellationToken)
        {
            await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    await api.ChangeChatCharacterPresenceAsync(args, cancellationToken);
                });
        }

        public async Task ChangeOpenChannelOrderAsync(ChangeOpenChannelOrderArgs args, CancellationToken cancellationToken)
        {
            await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    await api.ChangeOpenChannelOrderAsync(args, cancellationToken);
                });
        }

        public async Task CloseChatPMConversationAsync(CloseChatPMConversationArgs args, CancellationToken cancellationToken)
        {
            await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    await api.CloseChatPMConversationAsync(args, cancellationToken);
                });
        }

        public async Task<CreatePublicChannelResponse> CreatePublicChannelAsync(CreatePublicChannelArgs args, CancellationToken cancellationToken)
        {
            return await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    return await api.CreatePublicChannelAsync(args, cancellationToken);
                });
        }

        public async Task DeleteEIconAsync(DeleteEIconArgs args, CancellationToken cancellationToken)
        {
            await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    await api.DeleteEIconAsync(args, cancellationToken);
                });
        }

        public async Task DeleteInlineImageAsync(DeleteInlineImageArgs args, CancellationToken cancellationToken)
        {
            await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    await api.DeleteInlineImageAsync(args, cancellationToken);
                });
        }

        public async Task DenyPendingFriendRequestAsync(DenyPendingFriendRequestArgs args, CancellationToken cancellationToken)
        {
            await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    await api.DenyPendingFriendRequestAsync(args, cancellationToken);
                });
        }

        public async Task<GetChannelMessageHistoryResponse> GetChannelMessageHistoryAsync(GetChannelMessageHistoryArgs args, CancellationToken cancellationToken)
        {
            return await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    return await api.GetChannelMessageHistoryAsync(args, cancellationToken);
                });
        }

        public async Task<CharacterPresence> GetChatCharacterPresenceAsync(GetCharacterPresenceArgs args, CancellationToken cancellationToken)
        {
            return await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    return await api.GetChatCharacterPresenceAsync(args, cancellationToken);
                });
        }

        public async Task<IList<ChatEnabledCharacters>> GetChatEnabledCharactersAsync(CancellationToken cancellationToken)
        {
            return await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    return await api.GetChatEnabledCharactersAsync(cancellationToken);
                });
        }

        public async Task<ChatIgnoreList> GetChatIgnoreList(CancellationToken cancellationToken)
        {
            return await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    return await api.GetChatIgnoreList(cancellationToken);
                });
        }

        public async Task<GetJoinedChannelsResponse> GetChatJoinedChannelsAsync(CancellationToken cancellationToken)
        {
            return await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    return await api.GetChatJoinedChannelsAsync(cancellationToken);
                });
        }

        public async Task<GetOpenPMConvosResponse> GetChatOpenPMConversationsAsync(CancellationToken cancellationToken)
        {
            return await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    return await api.GetChatOpenPMConversationsAsync(cancellationToken);
                });
        }

        public async Task<PMConversationHistoryResponse> GetChatPMConversationHistoryAsync(GetChatPMConversationHistoryArgs args, CancellationToken cancellationToken)
        {
            return await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    return await api.GetChatPMConversationHistoryAsync(args, cancellationToken);
                });
        }

        public async Task<IReadOnlyList<PMConversationUnreadResponseItem>> GetChatPMConversationUnreadsAsync(CancellationToken cancellationToken)
        {
            return await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    return await api.GetChatPMConversationUnreadsAsync(cancellationToken);
                });
        }

        public async Task<GetFriendsListResponse> GetFriendsListAsync(CancellationToken cancellationToken)
        {
            return await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    return await api.GetFriendsListAsync(cancellationToken);
                });
        }

        public async Task<GetInlineImagesResponseItem[]> GetInlineImagesAsync(CancellationToken cancellationToken)
        {
            return await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    return await api.GetInlineImagesAsync(cancellationToken);
                });
        }

        public async Task<GetMyEIconsResponseItem[]> GetMyEIconsAsync(CancellationToken cancellationToken)
        {
            return await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    return await api.GetMyEIconsAsync(cancellationToken);
                });
        }

        public async Task<GetNotificationsResponse> GetNotificationsAsync(GetNotificationsArgs args, CancellationToken cancellationToken)
        {
            return await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    return await api.GetNotificationsAsync(args, cancellationToken);
                });
        }

        public async Task SendFriendRequestAsync(SendFriendRequestArgs args, CancellationToken cancellationToken)
        {
            await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    await api.SendFriendRequestAsync(args, cancellationToken);
                });
        }

        public async Task<GetPendingFriendRequestsResponse> GetPendingFriendRequestsAsync(CancellationToken cancellationToken)
        {
            return await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    return await api.GetPendingFriendRequestsAsync(cancellationToken);
                });
        }

        public async Task<GetUnreadNotificationsCountResponse> GetUnreadNotificationsCountAsync(CancellationToken cancellationToken)
        {
            return await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    return await api.GetUnreadNotificationsCountAsync(cancellationToken);
                });
        }

        public async Task<UserCharacters> GetUserCharacters(CancellationToken cancellationToken)
        {
            return await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    return await api.GetUserCharacters(cancellationToken);
                });
        }

        public async Task<UserDetails> GetUserDetails(CancellationToken cancellationToken)
        {
            return await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    return await api.GetUserDetails(cancellationToken);
                });
        }

        public async Task<LoginResponse> LoginAsync(LoginArgs args, CancellationToken cancellationToken)
        {
            return await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    return await api.LoginAsync(args, cancellationToken);
                });
        }

        public async Task MarkAllNotificationsReadAsync(CancellationToken cancellationToken)
        {
            await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    await api.MarkAllNotificationsReadAsync(cancellationToken);
                });
        }

        public async Task MarkNotificationReadAsync(MarkNotificationReadArgs args, CancellationToken cancellationToken)
        {
            await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    await api.MarkNotificationReadAsync(args, cancellationToken);
                });
        }

        public async Task OpenChatPMConversationAsync(OpenChatPMConversationArgs args, CancellationToken cancellationToken)
        {
            await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    await api.OpenChatPMConversationAsync(args, cancellationToken);
                });
        }

        public async Task PingAsync(CancellationToken cancellationToken)
        {
            await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    await api.PingAsync(cancellationToken);
                });
        }

        public async Task RemoveChatIgnore(int targetCharacterId, CancellationToken cancellationToken)
        {
            await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    await api.RemoveChatIgnore(targetCharacterId, cancellationToken);
                });
        }

        public async Task<GetChannelListResponse> GetChannelListAsync(GetChannelListArgs args, CancellationToken cancellationToken)
        {
            return await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    return await api.GetChannelListAsync(args, cancellationToken);
                });
        }

        public async Task RemoveChatPMConversationUnread(PMConversationUnreadResponseItem args, CancellationToken cancellationToken)
        {
            await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    await api.RemoveChatPMConversationUnread(args, cancellationToken);
                });
        }

        public async Task RenameEIconAsync(RenameEIconArgs args, CancellationToken cancellationToken)
        {
            await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    await api.RenameEIconAsync(args, cancellationToken);
                });
        }

        public async Task<SearchEIconsResponse> SearchEIconsAsync(SearchEIconsArgs args, CancellationToken cancellationToken)
        {
            return await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    return await api.SearchEIconsAsync(args, cancellationToken);
                });
        }

        public async Task UploadEIconAsync(UploadEIconArgs args, CancellationToken cancellationToken)
        {
            await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    await api.UploadEIconAsync(args, cancellationToken);
                });
        }

        public async Task UploadInlineImageAsync(UploadInlineImageArgs args, CancellationToken cancellationToken)
        {
            await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                executeFunc: async (api, cancellationToken) =>
                {
                    await api.UploadInlineImageAsync(args, cancellationToken);
                });
        }
    }
}
