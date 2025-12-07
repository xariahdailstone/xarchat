using System;
using System.Collections.Generic;
using System.Text;
using XarChat.FList2.FList2Api.Entities;
using XarChat.FList2.FList2Api.Implementation.Firehose;

namespace XarChat.FList2.FList2Api.Implementation.Wrappers
{
    internal class FList2ApiWrapperBase : IFList2Api
    {
        public FList2ApiWrapperBase(IFList2Api inner)
        {
            this.Inner = inner;
        }

        protected IFList2Api Inner { get; set; }

        protected virtual async Task InvokeInnerApiAsync(
            Func<IFList2Api, Task> asyncInnerInvocationFunc,
            CancellationToken cancellationToken)
        {
            await asyncInnerInvocationFunc(Inner);
        }

        protected virtual async Task InvokeInnerApiAsync<TArg0>(
            TArg0 args,
            Func<IFList2Api, TArg0, Task> asyncInnerInvocationFunc,
            CancellationToken cancellationToken)
        {
            await asyncInnerInvocationFunc(Inner, args);
        }

        protected virtual async Task<TResult> InvokeInnerApiAsync<TResult>(
            Func<IFList2Api, Task<TResult>> asyncInnerInvocationFunc,
            CancellationToken cancellationToken)
        {
            var result = await asyncInnerInvocationFunc(Inner);
            return result;
        }

        protected virtual async Task<TResult> InvokeInnerApiAsync<TArg0, TResult>(
            TArg0 args, 
            Func<IFList2Api, TArg0, Task<TResult>> asyncInnerInvocationFunc,
            CancellationToken cancellationToken)
        {
            var result = await asyncInnerInvocationFunc(Inner, args);
            return result;
        }

        public virtual IFirehose Firehose => Inner.Firehose;

        public virtual Task AcceptPendingFriendRequestAsync(AcceptPendingFriendRequestArgs args, CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                args,
                (api, arg0) => api.AcceptPendingFriendRequestAsync(arg0, cancellationToken),
                cancellationToken);
        }

        public virtual Task AddChatIgnore(int targetCharacterId, CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                targetCharacterId,
                (api, arg0) => api.AddChatIgnore(arg0, cancellationToken),
                cancellationToken);
        }

        public virtual Task ChangeChatCharacterPresenceAsync(ChangeCharacterPresenceArgs args, CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                args,
                (api, arg0) => api.ChangeChatCharacterPresenceAsync(arg0, cancellationToken),
                cancellationToken);
        }

        public virtual Task ChangeOpenChannelOrderAsync(ChangeOpenChannelOrderArgs args, CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                args,
                (api, arg0) => api.ChangeOpenChannelOrderAsync(arg0, cancellationToken),
                cancellationToken);
        }

        public virtual Task<GetChannelActiveCharactersResponse> GetChannelActiveCharactersAsync(GetChannelActiveCharactersArgs args, CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                args,
                (api, arg0) => api.GetChannelActiveCharactersAsync(arg0, cancellationToken),
                cancellationToken);
        }

        public virtual Task CloseChatPMConversationAsync(CloseChatPMConversationArgs args, CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                args,
                (api, arg0) => api.CloseChatPMConversationAsync(arg0, cancellationToken),
                cancellationToken);
        }

        public virtual Task<CreatePublicChannelResponse> CreatePublicChannelAsync(CreatePublicChannelArgs args, CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                args,
                (api, arg0) => api.CreatePublicChannelAsync(arg0, cancellationToken),
                cancellationToken);
        }

        public virtual Task DeleteEIconAsync(DeleteEIconArgs args, CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                args,
                (api, arg0) => api.DeleteEIconAsync(arg0, cancellationToken),
                cancellationToken);
        }

        public virtual Task DeleteInlineImageAsync(DeleteInlineImageArgs args, CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                args,
                (api, arg0) => api.DeleteInlineImageAsync(arg0, cancellationToken),
                cancellationToken);
        }

        public virtual Task DenyPendingFriendRequestAsync(DenyPendingFriendRequestArgs args, CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                args,
                (api, arg0) => api.DenyPendingFriendRequestAsync(arg0, cancellationToken),
                cancellationToken);
        }

        public virtual ValueTask DisposeAsync()
        {
            return Inner.DisposeAsync();
        }

        public virtual Task JoinChannelAsync(JoinChannelArgs args, CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                args,
                (api, arg0) => api.JoinChannelAsync(arg0, cancellationToken),
                cancellationToken);
        }

        public virtual Task LeaveChannelAsync(LeaveChannelArgs args, CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                args,
                (api, arg0) => api.LeaveChannelAsync(arg0, cancellationToken),
                cancellationToken);
        }

        public virtual Task<GetChannelListResponse> GetChannelListAsync(GetChannelListArgs args, CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                args,
                (api, arg0) => api.GetChannelListAsync(arg0, cancellationToken),
                cancellationToken);
        }

        public virtual Task<GetChannelMessageHistoryResponse> GetChannelMessageHistoryAsync(GetChannelMessageHistoryArgs args, CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                args,
                (api, arg0) => api.GetChannelMessageHistoryAsync(arg0, cancellationToken),
                cancellationToken);
        }

        public virtual Task<CharacterPresence> GetChatCharacterPresenceAsync(GetCharacterPresenceArgs args, CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                args,
                (api, arg0) => api.GetChatCharacterPresenceAsync(arg0, cancellationToken),
                cancellationToken);
        }

        public virtual Task<IList<ChatEnabledCharacters>> GetChatEnabledCharactersAsync(CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                (api) => api.GetChatEnabledCharactersAsync(cancellationToken),
                cancellationToken);
        }

        public virtual Task SetChatEnabledCharactersAsync(SetChatEnabledCharactersArgs args, CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                args,
                (api, arg0) => api.SetChatEnabledCharactersAsync(arg0, cancellationToken),
                cancellationToken);
        }

        public virtual Task<ChatIgnoreList> GetChatIgnoreList(CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                (api) => api.GetChatIgnoreList(cancellationToken),
                cancellationToken);
        }

        public virtual Task<GetJoinedChannelsResponse> GetChatJoinedChannelsAsync(CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                (api) => api.GetChatJoinedChannelsAsync(cancellationToken),
                cancellationToken);
        }

        public virtual Task<GetOpenPMConvosResponse> GetChatOpenPMConversationsAsync(CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                (api) => api.GetChatOpenPMConversationsAsync(cancellationToken),
                cancellationToken);
        }

        public virtual Task<PMConversationHistoryResponse> GetChatPMConversationHistoryAsync(GetChatPMConversationHistoryArgs args, CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                args,
                (api, arg0) => api.GetChatPMConversationHistoryAsync(arg0, cancellationToken),
                cancellationToken);
        }

        public virtual Task<IReadOnlyList<PMConversationUnreadResponseItem>> GetChatPMConversationUnreadsAsync(CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                (api) => api.GetChatPMConversationUnreadsAsync(cancellationToken),
                cancellationToken);
        }

        public virtual Task<GetFriendsListResponse> GetFriendsListAsync(CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                (api) => api.GetFriendsListAsync(cancellationToken),
                cancellationToken);
        }

        public virtual Task<GetInlineImagesResponseItem[]> GetInlineImagesAsync(CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                (api) => api.GetInlineImagesAsync(cancellationToken),
                cancellationToken);
        }

        public virtual Task<GetMyEIconsResponseItem[]> GetMyEIconsAsync(CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                (api) => api.GetMyEIconsAsync(cancellationToken),
                cancellationToken);
        }

        public virtual Task<GetNotificationsResponse> GetNotificationsAsync(GetNotificationsArgs args, CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                args,
                (api, arg0) => api.GetNotificationsAsync(arg0, cancellationToken),
                cancellationToken);
        }

        public virtual Task<GetPendingFriendRequestsResponse> GetPendingFriendRequestsAsync(CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                (api) => api.GetPendingFriendRequestsAsync(cancellationToken),
                cancellationToken);
        }
        
        public virtual Task<GetCharacterProfileResponse> GetCharacterProfileAsync(GetCharacterProfileArgs args, CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                args,
                (api, arg0) => api.GetCharacterProfileAsync(arg0, cancellationToken),
                cancellationToken);
        }

        public virtual Task<GetUnreadNotificationsCountResponse> GetUnreadNotificationsCountAsync(CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                (api) => api.GetUnreadNotificationsCountAsync(cancellationToken),
                cancellationToken);
        }

        public virtual Task<UserCharacters> GetUserCharacters(CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                (api) => api.GetUserCharacters(cancellationToken),
                cancellationToken);
        }

        public virtual Task<UserDetails> GetUserDetails(CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                (api) => api.GetUserDetails(cancellationToken),
                cancellationToken);
        }

        public virtual Task<LoginResponse> LoginAsync(LoginArgs args, CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                args,
                (api, arg0) => api.LoginAsync(arg0, cancellationToken),
                cancellationToken);
        }

        public virtual Task MarkAllNotificationsReadAsync(CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                (api) => api.MarkAllNotificationsReadAsync(cancellationToken),
                cancellationToken);
        }

        public virtual Task MarkNotificationReadAsync(MarkNotificationReadArgs args, CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                args,
                (api, arg0) => api.MarkNotificationReadAsync(arg0, cancellationToken),
                cancellationToken);
        }

        public virtual Task OpenChatPMConversationAsync(OpenChatPMConversationArgs args, CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                args,
                (api, arg0) => api.OpenChatPMConversationAsync(arg0, cancellationToken),
                cancellationToken);
        }

        public virtual Task PingAsync(CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                (api) => api.PingAsync(cancellationToken),
                cancellationToken);
        }

        public virtual Task RemoveChatIgnore(int targetCharacterId, CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                targetCharacterId,
                (api, arg0) => api.RemoveChatIgnore(arg0, cancellationToken),
                cancellationToken);
        }

        public virtual Task RemoveChatPMConversationUnread(PMConversationUnreadResponseItem args, CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                args,
                (api, arg0) => api.RemoveChatPMConversationUnread(arg0, cancellationToken),
                cancellationToken);
        }

        public virtual Task RenameEIconAsync(RenameEIconArgs args, CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                args,
                (api, arg0) => api.RenameEIconAsync(arg0, cancellationToken),
                cancellationToken);
        }

        public virtual Task<SearchEIconsResponse> SearchEIconsAsync(SearchEIconsArgs args, CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                args,
                (api, arg0) => api.SearchEIconsAsync(arg0, cancellationToken),
                cancellationToken);
        }

        public virtual Task SendFriendRequestAsync(SendFriendRequestArgs args, CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                args,
                (api, arg0) => api.SendFriendRequestAsync(arg0, cancellationToken),
                cancellationToken);
        }

        public virtual Task UploadEIconAsync(UploadEIconArgs args, CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                args,
                (api, arg0) => api.UploadEIconAsync(arg0, cancellationToken),
                cancellationToken);
        }

        public virtual Task UploadInlineImageAsync(UploadInlineImageArgs args, CancellationToken cancellationToken)
        {
            return InvokeInnerApiAsync(
                args,
                (api, arg0) => api.UploadInlineImageAsync(arg0, cancellationToken),
                cancellationToken);
        }
    }
}
