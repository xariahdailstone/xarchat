using XarChat.FList2.Common.StrongTypes;
using XarChat.FList2.FList2Api.Entities;
using XarChat.FList2.FList2Api.Implementation.Firehose;

namespace XarChat.FList2.FList2Api
{
    public interface IFList2ApiFactory
    {
        Task<IFList2Api> CreateAsync(FList2ApiOptions options, LoginArgs args, CancellationToken cancellationToken);
    }

    public class FList2ApiOptions
    {
        public Uri BaseUri { get; set; } = new Uri("https://test.f-list.net");

    }

    public interface IFList2Api : IAsyncDisposable
    {
        // CsrfTokenResponse CsrfToken { get; }

        IFirehose Firehose { get; }

        Task<LoginResponse> LoginAsync(LoginArgs args, CancellationToken cancellationToken);

        Task PingAsync(CancellationToken cancellationToken);

        #region Auth

        #region AccountVerification
        #endregion

        #region EmailChange
        #endregion

        #region PasswordReset
        #endregion

        #region User
        Task<UserDetails> GetUserDetails(CancellationToken cancellationToken);

        #endregion

        #endregion

        #region Character

        #region Avatar
        #endregion

        #region BannerImage
        #endregion

        #region Character

        // TODO: get character by ID

        Task<UserCharacters> GetUserCharacters(CancellationToken cancellationToken);

        #endregion

        #region CharacterImage
        #endregion

        #region CharacterSearch
        #endregion

        #region Friend

        Task AcceptPendingFriendRequestAsync(AcceptPendingFriendRequestArgs args, CancellationToken cancellationToken);

        Task DenyPendingFriendRequestAsync(DenyPendingFriendRequestArgs args, CancellationToken cancellationToken);

        // TODO: cancel friend request

        Task SendFriendRequestAsync(SendFriendRequestArgs args, CancellationToken cancellationToken);

        // TODO: delete friendship

        // TODO: get friendslist by characterid

        Task<GetFriendsListResponse> GetFriendsListAsync(CancellationToken cancellationToken);

        Task<GetPendingFriendRequestsResponse> GetPendingFriendRequestsAsync(CancellationToken cancellationToken);

        #endregion

        #region InlineImage
        #endregion

        #region Kink

        // TODO: get all kink groups

        #endregion

        #region Profile

        // TODO: get mini profile

        // TODO: get published profile
        Task<GetCharacterProfileResponse> GetCharacterProfileAsync(GetCharacterProfileArgs args, CancellationToken cancellationToken);

        Task<GetCharacterNameResponse> GetCharacterNameAsync(GetCharacterNameArgs args, CancellationToken cancellationToken);

        #endregion

        #region ProfileInfo
        #endregion

        #endregion

        #region Chat

        #region Channel

        Task JoinChannelAsync(JoinChannelArgs args, CancellationToken cancellationToken);

        Task LeaveChannelAsync(LeaveChannelArgs args, CancellationToken cancellationToken);

        Task<GetChannelListResponse> GetChannelListAsync(GetChannelListArgs args, CancellationToken cancellationToken);

        Task<GetJoinedChannelsResponse> GetChatJoinedChannelsAsync(CancellationToken cancellationToken);

        Task<CreatePublicChannelResponse> CreatePublicChannelAsync(CreatePublicChannelArgs args, CancellationToken cancellationToken);

        Task ChangeOpenChannelOrderAsync(ChangeOpenChannelOrderArgs args, CancellationToken cancellationToken);

        Task<GetChannelActiveCharactersResponse> GetChannelActiveCharactersAsync(GetChannelActiveCharactersArgs args, CancellationToken cancellationToken);

        #endregion

        #region CharacterPresence

        Task<CharacterPresence> GetChatCharacterPresenceAsync(GetCharacterPresenceArgs args, CancellationToken cancellationToken);

        Task ChangeChatCharacterPresenceAsync(ChangeCharacterPresenceArgs args, CancellationToken cancellationToken);

        #endregion

        #region ChatEnabledCharacter

        // TODO: edit chatenabledcharacters

        Task<IList<ChatEnabledCharacters>> GetChatEnabledCharactersAsync(CancellationToken cancellationToken);

        Task SetChatEnabledCharactersAsync(SetChatEnabledCharactersArgs args, CancellationToken cancellationToken);

        #endregion

        #region Message

        // TODO: hide/unhide message

        #endregion

        #region MessageHistory

        Task<GetChannelMessageHistoryResponse> GetChannelMessageHistoryAsync(GetChannelMessageHistoryArgs args, CancellationToken cancellationToken);

        Task<PMConversationHistoryResponse> GetChatPMConversationHistoryAsync(GetChatPMConversationHistoryArgs args, CancellationToken cancellationToken);

        #endregion

        #region PrivateChat

        Task<GetOpenPMConvosResponse> GetChatOpenPMConversationsAsync(CancellationToken cancellationToken);

        Task OpenChatPMConversationAsync(OpenChatPMConversationArgs args, CancellationToken cancellationToken);

        Task CloseChatPMConversationAsync(CloseChatPMConversationArgs args, CancellationToken cancellationToken);

        // TODO: reorder private chat list

        Task<IReadOnlyList<PMConversationUnreadResponseItem>> GetChatPMConversationUnreadsAsync(CancellationToken cancellationToken);

        Task RemoveChatPMConversationUnread(PMConversationUnreadResponseItem args, CancellationToken cancellationToken);

        #endregion

        #region ReadCursor

        // TODO: mark channel read

        #endregion

        #region Ignores

        Task<ChatIgnoreList> GetChatIgnoreList(CancellationToken cancellationToken);

        Task AddChatIgnore(int targetCharacterId, CancellationToken cancellationToken);

        Task RemoveChatIgnore(int targetCharacterId, CancellationToken cancellationToken);

        #endregion

        #endregion

        #region Icon

        #endregion

        #region News
        #endregion

        #region Notification

        Task<GetUnreadNotificationsCountResponse> GetUnreadNotificationsCountAsync(CancellationToken cancellationToken);

        Task<GetNotificationsResponse> GetNotificationsAsync(GetNotificationsArgs args, CancellationToken cancellationToken);

        Task MarkNotificationReadAsync(MarkNotificationReadArgs args, CancellationToken cancellationToken);

        Task MarkAllNotificationsReadAsync(CancellationToken cancellationToken);

        #endregion

        #region Subscription
        #endregion

        #region EIcons

        Task<GetMyEIconsResponseItem[]> GetMyEIconsAsync(CancellationToken cancellationToken);

        Task RenameEIconAsync(RenameEIconArgs args, CancellationToken cancellationToken);

        Task DeleteEIconAsync(DeleteEIconArgs args, CancellationToken cancellationToken);

        Task UploadEIconAsync(UploadEIconArgs args, CancellationToken cancellationToken);

        Task<SearchEIconsResponse> SearchEIconsAsync(SearchEIconsArgs args, CancellationToken cancellationToken);

        #endregion

        #region InlineImages

        Task<GetInlineImagesResponseItem[]> GetInlineImagesAsync(CancellationToken cancellationToken);

        Task UploadInlineImageAsync(UploadInlineImageArgs args, CancellationToken cancellationToken);

        Task DeleteInlineImageAsync(DeleteInlineImageArgs args, CancellationToken cancellationToken);

        #endregion
    }
}