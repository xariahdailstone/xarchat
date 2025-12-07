using XarChat.FList2.Common;
using XarChat.FList2.FList2Api;
using XarChat.FList2.FList2Api.Entities;
using XarChat.FList2.FList2Api.Implementation.Firehose;
using XarChat.FList2.FList2Api.Implementation.Firehose.Messages;
using XarChat.FList2.FList2Api.Implementation.Firehose.Messages.Incoming;
using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;
using System.Text;
using System.Threading.Channels;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Connection.Implementation
{
    internal class DefaultFList2Connection : IFList2Connection
    {
        private readonly IFList2Api _api;

        public IFList2Api FList2Api => _api;

        public DefaultFList2Connection(IFList2Api api)
        {
            _api = api;
            _mainLoopTask = MainLoopAsync(_disposeCTS.Token);
        }

        private readonly CancellationTokenSource _disposeCTS = new CancellationTokenSource();
        private readonly Task _mainLoopTask;
        private bool _disposed = false;

        public async ValueTask DisposeAsync()
        {
            if (!_disposed)
            {
                Console.WriteLine("disposing " + GetType().Name);
                _disposed = true;
                _disposeCTS.Cancel();

                
                await _api.DisposeAsync();
            }
        }

        private void ThrowIfDisposed()
        {
            if (this._disposed)
            {
                throw new ObjectDisposedException(GetType().Name);
            }
        }

        private readonly Channel<WorkItem> _mainLoopWorkItems = Channel.CreateUnbounded<WorkItem>();

        private class WorkItem
        {
            public WorkItem(Func<Task> func, CancellationToken cancellationToken)
            {
                this.Func = func;
                this.CancellationToken = cancellationToken;

                _cancelReg = cancellationToken.Register(() =>
                {
                    if (TryCommitToPerform())
                    {
                        _resultTcs.TrySetCanceled();
                    }
                });
            }

            public Func<Task> Func { get; }
            public CancellationToken CancellationToken { get; }

            private CancellationTokenRegistration _cancelReg;

            private TaskCompletionSource _resultTcs = new TaskCompletionSource();
            public Task ResultTask => _resultTcs.Task;

            private readonly object _lock = new object();
            private bool _isCommitted = false;

            public bool TryCommitToPerform()
            {
                lock (_lock)
                {
                    if (_isCommitted) { return false; }
                    _isCommitted = true;
                    _cancelReg.Unregister();
                }
                return true;
            }

            public void ExecutionCompleted()
                => _resultTcs.TrySetResult();

            public void ExecutionFailed(Exception ex)
                => _resultTcs.TrySetException(ex);
        }

        private readonly AsyncLocal<bool> _isInMainThread = new AsyncLocal<bool>();

        public async Task PerformOnMainThread(Func<Task> func, CancellationToken cancellationToken)
        {
            var wi = new WorkItem(func, cancellationToken);
            await _mainLoopWorkItems.Writer.WriteAsync(wi, cancellationToken);
            await wi.ResultTask;
        }

        private async Task MainLoopAsync(CancellationToken cancellationToken)
        {
            try
            {
                using var cleanupDisposables = new DisposablesSet();
                _isInMainThread.Value = true;

                this.ConnectionState = ConnectionState.Initializing;
                await this.RefreshChatStateAsync(cancellationToken);

                cleanupDisposables.Add(_api.Firehose.AddFirehoseStatusChangedHandler(async (oldNew) =>
                {
                    //_ = PerformOnMainThread(async () =>
                    //{
                        switch (oldNew.NewValue)
                        {
                            case FirehoseStatus.Disconnected:
                                {
                                    _ = this.DisposeAsync();
                                }
                                break;
                            case FirehoseStatus.Connected:
                                {
                                    await this.RefreshChatStateAsync(cancellationToken);
                                    this.ConnectionState = ConnectionState.Connected;
                                }
                                break;
                            case FirehoseStatus.Connecting:
                                {
                                    this.ConnectionState = ConnectionState.Connecting;
                                }
                                break;
                        }
                    //}, cancellationToken);
                }));

                _ = RunFirehoseReadLoopAsync(cancellationToken);

                this.ConnectionState = ConnectionState.Connected;
                while (!cancellationToken.IsCancellationRequested)
                {
                    var workItem = await _mainLoopWorkItems.Reader.ReadAsync(cancellationToken);
                    if (workItem.TryCommitToPerform())
                    {
                        try 
                        { 
                            await workItem.Func();
                            workItem.ExecutionCompleted();
                        }
                        catch (Exception ex)
                        {
                            workItem.ExecutionFailed(ex);
                        }
                    }
                }
            }
            catch when (cancellationToken.IsCancellationRequested) { }
            catch 
            {
                // TODO: log me?
                throw;
            }
            finally
            {
                this.ConnectionState = ConnectionState.Disconnected;
                _isInMainThread.Value = false;
            }
        }

        private async Task RunFirehoseReadLoopAsync(CancellationToken cancellationToken)
        {
            try
            {
                while (!cancellationToken.IsCancellationRequested)
                {
                    var incomingMsg = await _api.Firehose.ReadAsync(cancellationToken);
                    if (incomingMsg is FirehoseBrokenMessage fbm)
                    {
                        await HandleFirehoseBrokenMessageReceivedAsync(fbm, cancellationToken);
                    }
                    if (incomingMsg is ChannelMessageReceived cmr)
                    {
                        await HandleChannelMessageReceivedAsync(cmr, cancellationToken);
                    }
                    else if (incomingMsg is PMConvoMessageReceived pmmr)
                    {
                        await HandlePMConvoMessageReceivedAsync(pmmr, cancellationToken);
                    }
                }
            }
            catch when (cancellationToken.IsCancellationRequested)
            {
            }
        }

        private async Task HandleFirehoseBrokenMessageReceivedAsync(FirehoseBrokenMessage incomingMsg, CancellationToken cancellationToken)
        {
            await this.RefreshChatStateAsync(cancellationToken);
        }

        private async Task HandlePMConvoMessageReceivedAsync(PMConvoMessageReceived incomingMsg, CancellationToken cancellationToken)
        {
            if (this.ConnectedCharacters.TryGetById(incomingMsg.Recipient.Id, out var charChat))
            {
                if (charChat.OpenPMConversations.TryGetByInterlocutorId(incomingMsg.Author.Id, out var convo))
                {
                    var msg = new DefaultPMConversationMessage(
                        convo, incomingMsg.Id, incomingMsg.Timestamp.UtcDateTime, incomingMsg.OptimisticId,
                        incomingMsg.Author, incomingMsg.Body, incomingMsg.IsMeMessage, incomingMsg.GenderColor);
                    convo.Messages.Add(msg);
                }
            }
        }

        private async Task HandleChannelMessageReceivedAsync(ChannelMessageReceived incomingMsg, CancellationToken cancellationToken)
        {
            var channelId = incomingMsg.ChannelId;
                
            foreach (var charChan in this.ConnectedCharacters)
            {
                if (charChan.JoinedChannels.TryGetById(channelId, out var chan))
                {
                    var cmsg = new DefaultChannelMessage(chan, incomingMsg.Body, incomingMsg.IsMeMessage, incomingMsg.Author, incomingMsg.GenderColor);
                    chan.Messages.Add(cmsg);
                }
            }
        }

        public ConnectionState ConnectionState 
        {
            get => field;
            private set
            {
                if (value != field)
                {
                    var oldValue = field;
                    field = value;
                    _connectionStateChangedCallbacks.Invoke(new(field, value));
                }
            }
        }

        private readonly CallbackSet<OldNew<ConnectionState>> _connectionStateChangedCallbacks = new();
        public IDisposable AddConnectionStateChangedHandler(Action<OldNew<ConnectionState>> handler)
            => _connectionStateChangedCallbacks.Add(handler);




        private UserCharacters _userCharsInfo = null!;
        private IList<ChatEnabledCharacters> _chatEnabledCharsInfo = null!;
        private GetJoinedChannelsResponse _openChannelsInfo = null!;
        private GetOpenPMConvosResponse _openPMConvosInfo = null!;
        private UserDetails _userDetails = null!;

        public async Task RefreshChatStateAsync(CancellationToken cancellationToken)
        {
            var getUserCharactersTask = this.RefreshUserCharactersAsync(cancellationToken);
            var getChatEnabledCharactersTask = this.RefreshChatEnabledCharactersAsync(cancellationToken);
            var getChatOpenChannelsTask = this.RefreshOpenChannelsAsync(cancellationToken);
            var getChatOpenPMConvosTask = this.RefreshOpenPMConversationsAsync(cancellationToken);
            var getUserDetailsTask = this.RefreshUserDetailsAsync(cancellationToken);

            await Task.WhenAll(getUserCharactersTask, getChatEnabledCharactersTask, getChatOpenChannelsTask,
                getChatOpenPMConvosTask, getUserDetailsTask);

            var connectedCharsById = new HashSet<CharacterId>();
            foreach (var cc in _chatEnabledCharsInfo)
            {
                connectedCharsById.Add(cc.CharacterId);
                if (!this.ConnectedCharacters.TryGetById(cc.CharacterId, out var charChat))
                {
                    charChat = new DefaultJoinedCharacterChat(this, cc.CharacterId, cc.CharacterName,
                        cc.AvatarUrlPath, cc.GenderColor);
                    this.ConnectedCharacters.Add(charChat);
                }
            }
            foreach (var charChat in this.ConnectedCharacters.ToArray())
            {
                if (!connectedCharsById.Contains(charChat.CharacterId))
                {
                    this.ConnectedCharacters.Remove(charChat);
                }
            }


            foreach (var chanCharInfo in this._openChannelsInfo.Items)
            {
                if (this.ConnectedCharacters.TryGetById(chanCharInfo.CharacterId, out var charChat))
                {
                    SyncCharChannels(charChat, chanCharInfo);
                }
            }
            foreach (var convoCharInfo in this._openPMConvosInfo.List)
            {
                if (this.ConnectedCharacters.TryGetById(convoCharInfo.CharacterId, out var charChat))
                {
                    SyncPMConversations(charChat, convoCharInfo);
                }
            }
        }

        private void SyncPMConversations(DefaultJoinedCharacterChat charChat, CharacterOpenPMConvos convoCharInfo)
        {
            var openPMConversationsByInterlocutorId = new HashSet<CharacterId>();
            foreach (var x in convoCharInfo.List)
            {
                var interlocutorCharId = x.RecipientId;
                openPMConversationsByInterlocutorId.Add(interlocutorCharId);
                if (!charChat.OpenPMConversations.TryGetByInterlocutorId(interlocutorCharId, out var convo))
                {
                    convo = new DefaultOpenPMConversation(charChat, new CharacterInfo()
                    {
                        Id = interlocutorCharId,
                        Name = x.RecipientName,
                        AvatarPath = x.RecipientAvatarPath
                    });
                    charChat.OpenPMConversations.Add(convo);
                }
                // TODO: sync values onto convo
            }

            foreach (var convo in charChat.OpenPMConversations.ToArray())
            {
                if (!openPMConversationsByInterlocutorId.Contains(convo.Interlocutor.Id))
                {
                    charChat.OpenPMConversations.Remove(convo);
                }
            }
        }

        private void SyncCharChannels(DefaultJoinedCharacterChat charChat, GetOpenChannelsForCharacter chanChar)
        {
            var joinedChannelsById = new HashSet<ChannelId>();
            foreach (var x in chanChar.OpenChannels)
            {
                var channelId = x.ChannelId;
                joinedChannelsById.Add(channelId);
                if (!charChat.JoinedChannels.TryGetById(channelId, out var channel))
                {
                    channel = new DefaultJoinedChannel(charChat, channelId, x.ChannelName);
                    charChat.JoinedChannels.Add(channel);
                }
                // TODO: sync values onto channel
            }

            foreach (var channel in charChat.JoinedChannels.ToArray())
            {
                if (!joinedChannelsById.Contains(channel.ChannelId))
                {
                    charChat.JoinedChannels.Remove(channel);
                }
            }
        }

        private async Task RefreshUserCharactersAsync(CancellationToken cancellationToken)
        {
            ThrowIfDisposed();
            var userChars = await _api.GetUserCharacters(cancellationToken);
            this._userCharsInfo = userChars;
        }

        private async Task RefreshChatEnabledCharactersAsync(CancellationToken cancellationToken)
        {
            ThrowIfDisposed();
            var chatEnabledChars = await _api.GetChatEnabledCharactersAsync(cancellationToken);
            this._chatEnabledCharsInfo = chatEnabledChars;
        }

        private async Task RefreshOpenChannelsAsync(CancellationToken cancellationToken)
        {
            ThrowIfDisposed();
            var openChannels = await _api.GetChatJoinedChannelsAsync(cancellationToken);
            this._openChannelsInfo = openChannels;
        }

        private async Task RefreshOpenPMConversationsAsync(CancellationToken cancellationToken)
        {
            ThrowIfDisposed();
            var openPmConvos = await _api.GetChatOpenPMConversationsAsync(cancellationToken);
            this._openPMConvosInfo = openPmConvos;
        }

        private async Task RefreshUserDetailsAsync(CancellationToken cancellationToken)
        {
            ThrowIfDisposed();
            var userDetails = await _api.GetUserDetails(cancellationToken);
            this._userDetails = userDetails;
        }

        public DefaultJoinedCharacterChatList ConnectedCharacters { get; } = new DefaultJoinedCharacterChatList();

        IJoinedCharacterChatList IFList2Connection.ConnectedCharacters => this.ConnectedCharacters;
    }
}
