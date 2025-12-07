using XarChat.FList2.FList2Api.Entities;
using XarChat.FList2.FList2Api.Implementation.Firehose;
using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http.Json;
using System.Reflection;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Web;
using System.Text.Json.Serialization;

namespace XarChat.FList2.FList2Api.Implementation
{
    internal class DefaultFList2Api : IFList2Api
    {
        public static async Task<DefaultFList2Api> CreateAsync(FList2ApiOptions options, CancellationToken cancellationToken)
        {
            var cookieContainer = new CookieContainer();
            var basicAuthHandler = new TestBasicAuthHandler(new SocketsHttpHandler() { CookieContainer = cookieContainer });
            var hc = new HttpClient(basicAuthHandler);
            hc.BaseAddress = options.BaseUri;
            try
            {

                cookieContainer.Add(options.BaseUri, new Cookie("age-verified", "1"));
                var result = new DefaultFList2Api(cookieContainer, hc);

                var csrfResp = await result.GetCsrfTokenAsync(cancellationToken);
                basicAuthHandler.CsrfHeader = new(csrfResp.HeaderName, csrfResp.Token);

                const string csrfCookieName = "XSRF-TOKEN";

                //System.Diagnostics.Debug.Assert(
                //    cookieContainer.GetCookies(options.BaseUri).Where(c => c.Name == csrfCookieName).Any(),
                //    $"Could not verify CSRF cookie {csrfCookieName}");

                return result;
            }
            catch
            {
                hc.Dispose();
                throw;
            }
        }

        private DefaultFList2Api(CookieContainer cookieContainer, HttpClient httpClient)
        {
            this.CookieContainer = cookieContainer;
            this.HttpClient = httpClient;
        }

        private bool _disposed = false;

        public async ValueTask DisposeAsync()
        {
            if (!this._disposed)
            {
                Console.WriteLine("disposing " + GetType().Name);
                this._disposed = true;
                if (this._firehoseManager is not null)
                {
                    await this._firehoseManager.DisposeAsync();
                }
            }
        }

        private void ThrowIfDisposed()
        {
            if (this._disposed)
            {
                throw new ObjectDisposedException(this.GetType().Name);
            }
        }

        private FirehoseManager? _firehoseManager = null;

        public IFirehose Firehose
        {
            get
            {
                ThrowIfDisposed();
                if (_firehoseManager is null)
                {
                    _firehoseManager = new FirehoseManager(this);
                }
                return _firehoseManager;
            }
        }

        internal CookieContainer CookieContainer { get; }

        internal HttpClient HttpClient { get; }

        private CsrfTokenResponse? _csrfToken;
        public CsrfTokenResponse CsrfToken 
        {
            get => _csrfToken ?? throw new InvalidOperationException("CSRF token not set");
            private set => _csrfToken = value;
        }

        public async Task PingAsync(CancellationToken cancellationToken)
        {
            await this.GetCsrfTokenAsync(cancellationToken);
        }

        private async Task<CsrfTokenResponse> GetCsrfTokenAsync(CancellationToken cancellationToken)
        {
            var csrfData = await this.PerformGetAsync<CsrfTokenResponse>("/api/csrf", cancellationToken);
            this.CsrfToken = csrfData;
            return csrfData;
        }

        private void VerifyJsonTypeInfo<T>()
        {
            var jsonTypeInfo = FList2ApiEntityJsonSerializerContext.Default.GetTypeInfo(typeof(T));
            if (jsonTypeInfo is null)
            {
                throw new ApplicationException($"No JsonTypeInfo for {typeof(T).Name}");
            }
        }

        private T JsonDeserialize<T>(string json)
        {
            VerifyJsonTypeInfo<T>();
            return JsonSerializer.Deserialize<T>(json, FList2ApiEntityJsonSerializerContext.Default.Options)!;
        }

        private string JsonSerialize<T>(T obj)
        {
            VerifyJsonTypeInfo<T>();
            return JsonSerializer.Serialize<T>(obj, FList2ApiEntityJsonSerializerContext.Default.Options)!;
        }

        private async Task<T> PerformGetAsync<T>(string url, CancellationToken cancellationToken)
        {
            var json = await this.HttpClient.GetStringAsync(url, cancellationToken);
            return JsonDeserialize<T>(json)!;
        }

        private async Task<TResult> PerformJsonPostAsync<TArgs, TResult>(string url, TArgs body, CancellationToken cancellationToken)
        {
            VerifyJsonTypeInfo<TArgs>();
            var resp = await this.HttpClient.PostAsJsonAsync(url, body, FList2ApiEntityJsonSerializerContext.Default.Options, cancellationToken);
            var json = await resp.Content.ReadAsStringAsync(cancellationToken);
            resp.EnsureSuccessStatusCode();
            return JsonDeserialize<TResult>(json)!;
        }

        private async Task<TResult> PerformJsonPatchAsync<TArgs, TResult>(string url, TArgs body, CancellationToken cancellationToken)
        {
            var req = new HttpRequestMessage(HttpMethod.Patch, url);
            req.Content = new StringContent(JsonSerialize(body));
            req.Content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/json");

            var resp = await this.HttpClient.SendAsync(req, cancellationToken);
            resp.EnsureSuccessStatusCode();
            var json = await resp.Content.ReadAsStringAsync(cancellationToken);
            return JsonDeserialize<TResult>(json)!;
        }

        private async Task<T> PerformDeleteAsync<T>(string url, CancellationToken cancellationToken)
        {
            var req = new HttpRequestMessage(HttpMethod.Delete, url);

            var resp = await this.HttpClient.SendAsync(req, cancellationToken);
            resp.EnsureSuccessStatusCode();
            var json = await resp.Content.ReadAsStringAsync(cancellationToken);
            return JsonDeserialize<T>(json)!;
        }

        private async Task<TResult> PerformDeleteAsync<TBody, TResult>(string url, TBody body, CancellationToken cancellationToken)
        {
            var req = new HttpRequestMessage(HttpMethod.Delete, url);
            req.Content = new StringContent(JsonSerialize(body));
            req.Content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/json");

            var resp = await this.HttpClient.SendAsync(req, cancellationToken);
            resp.EnsureSuccessStatusCode();
            var json = await resp.Content.ReadAsStringAsync(cancellationToken);
            return JsonDeserialize<TResult>(json)!;
        }

        private async Task<T> PerformFormPostAsync<T>(string url, List<KeyValuePair<string, object>> fields, CancellationToken cancellationToken)
        {
            var formContent = new MultipartFormDataContent();
            foreach (var fld in fields)
            {
                if (fld.Value is string vstring)
                {
                    formContent.Add(new StringContent(vstring), fld.Key);
                }
                else if (fld.Value is Stream vstream)
                {
                    formContent.Add(new StreamContent(vstream), fld.Key, "untitled.dat");
                }
                else if (fld.Value is NamedStream vnamedstream)
                {
                    formContent.Add(new StreamContent(vnamedstream.Stream), fld.Key, vnamedstream.Name);
                }
                else
                {
                    throw new ApplicationException("unknown field content type");
                }
            }

            var req = new HttpRequestMessage(HttpMethod.Post, url);
            req.Content = formContent;

            var resp = await this.HttpClient.SendAsync(req, cancellationToken);
            resp.EnsureSuccessStatusCode();
            var json = await resp.Content.ReadAsStringAsync(cancellationToken);
            return JsonDeserialize<T>(json)!;
        }

        public async Task<LoginResponse> LoginAsync(LoginArgs args, CancellationToken cancellationToken)
        {
            args.Username = args.Username?.ToLower() ?? "";

            var loginResponse = await this.PerformJsonPostAsync<LoginArgs, LoginResponse>("/api/login", args, cancellationToken);
            if (loginResponse.Message == "success")
            {
                return loginResponse;
            }
            else
            {
                throw new ApplicationException("Login failed: did not get message=success");
            }
        }

        public async Task<UserDetails> GetUserDetails(CancellationToken cancellationToken)
        {
            var resp = await this.PerformGetAsync<UserDetails>("/api/user/details", cancellationToken);
            return resp;
        }

        public async Task<UserCharacters> GetUserCharacters(CancellationToken cancellationToken)
        {
            var resp = await this.PerformGetAsync<UserCharacters>("/api/user/character", cancellationToken);
            return resp;
        }

        public async Task<IList<ChatEnabledCharacters>> GetChatEnabledCharactersAsync(CancellationToken cancellationToken)
        {
            var resp = await this.PerformGetAsync<List<ChatEnabledCharacters>>("/api/chat/enabled-characters", cancellationToken);
            return resp;
        }

        public async Task SetChatEnabledCharactersAsync(SetChatEnabledCharactersArgs args, CancellationToken cancellationToken)
        {
            await this.PerformJsonPostAsync<SetChatEnabledCharactersArgs, GenericResponse>(
                "/api/chat/enabled-characters", args, cancellationToken);
        }

        public async Task<CharacterPresence> GetChatCharacterPresenceAsync(GetCharacterPresenceArgs args, CancellationToken cancellationToken)
        {
            var resp = await this.PerformGetAsync<CharacterPresence>($"/api/chat/character/{args.CharacterId}/presence", cancellationToken);
            return resp;
        }

        public async Task ChangeChatCharacterPresenceAsync(
            ChangeCharacterPresenceArgs args, CancellationToken cancellationToken)
        {
            var resp = await this.PerformJsonPatchAsync<ChangeCharacterPresenceArgs, GenericResponse>(
                $"/api/chat/character/presence", args, cancellationToken);
        }

        public async Task<ChatIgnoreList> GetChatIgnoreList(CancellationToken cancellationToken)
        {
            var resp = await this.PerformGetAsync<ChatIgnoreList>("/api/chat/ignore", cancellationToken);
            return resp;
        }

        public async Task AddChatIgnore(int targetCharacterId, CancellationToken cancellationToken)
        {
            await this.PerformJsonPostAsync<GenericResponse, GenericResponse>($"/api/chat/ignore/character/{targetCharacterId}",
                new GenericResponse() { Message = "success", Error = null }, cancellationToken);
        }

        public async Task RemoveChatIgnore(int targetCharacterId, CancellationToken cancellationToken)
        {
            await this.PerformDeleteAsync<GenericResponse>($"/api/chat/ignore/character/{targetCharacterId}", cancellationToken);
        }

        public async Task<GetOpenPMConvosResponse> GetChatOpenPMConversationsAsync(CancellationToken cancellationToken)
        {
            var resp = await this.PerformGetAsync<GetOpenPMConvosResponse>("/api/chat/private/visible", cancellationToken);
            return resp;
        }

        public async Task OpenChatPMConversationAsync(OpenChatPMConversationArgs args, CancellationToken cancellationToken)
        {
            await this.PerformJsonPostAsync<OpenChatPMConversationArgs, GenericResponse>("/api/chat/private/visible", args, cancellationToken);
        }

        public async Task CloseChatPMConversationAsync(CloseChatPMConversationArgs args, CancellationToken cancellationToken)
        {
            await this.PerformDeleteAsync<CloseChatPMConversationArgs, GenericResponse>("/api/chat/private/visible", args, cancellationToken);
        }

        public async Task<PMConversationHistoryResponse> GetChatPMConversationHistoryAsync(
            GetChatPMConversationHistoryArgs args, CancellationToken cancellationToken)
        {
            if (args.CursorLocation is not null)
            {
                var dirStr = args.CursorDirection == CursorDirection.Newer ? "newer" : "older";
                var resp = await this.PerformGetAsync<PMConversationHistoryResponse>(
                    $"/api/private-message-history/{args.MyCharacterId}/{args.InterlocutorCharacterId}?cursor={HttpUtility.UrlEncode(args.CursorLocation)}&order={HttpUtility.UrlEncode(dirStr)}", cancellationToken);
                return resp;
            }
            else
            {
                var resp = await this.PerformGetAsync<PMConversationHistoryResponse>(
                    $"/api/private-message-history/{args.MyCharacterId}/{args.InterlocutorCharacterId}", cancellationToken);
                return resp;
            }
        }

        public async Task<IReadOnlyList<PMConversationUnreadResponseItem>> GetChatPMConversationUnreadsAsync(CancellationToken cancellationToken)
        {
            var resp = await this.PerformGetAsync<List<PMConversationUnreadResponseItem>>("/api/chat/private/unread", cancellationToken);
            return resp;
        }

        public async Task JoinChannelAsync(JoinChannelArgs args, CancellationToken cancellationToken)
        {
            await this.PerformJsonPostAsync<JoinChannelArgs, GenericResponse>(
                "/api/channel/subscription", args, cancellationToken);
        }

        public async Task LeaveChannelAsync(LeaveChannelArgs args, CancellationToken cancellationToken)
        {
            await this.PerformDeleteAsync<LeaveChannelArgs, GenericResponse>(
                "/api/channel/subscription", args, cancellationToken);
        }

        public async Task<GetChannelListResponse> GetChannelListAsync(GetChannelListArgs args, CancellationToken cancellationToken)
        {
            var resp = await this.PerformGetAsync<GetChannelListResponse>(args.ChannelListType == ChannelListType.OfficialChannels
                ? "/api/official-channel"
                : "/api/channel", 
                cancellationToken);
            return resp;
        }

        public async Task RemoveChatPMConversationUnread(PMConversationUnreadResponseItem args, CancellationToken cancellationToken)
        {
            await this.PerformDeleteAsync<PMConversationUnreadResponseItem, GenericResponse>("/api/chat/private/unread",
                args, cancellationToken);
        }

        public async Task<GetJoinedChannelsResponse> GetChatJoinedChannelsAsync(CancellationToken cancellationToken)
        {
            var resp = await this.PerformGetAsync<GetJoinedChannelsResponse>("/api/channel/subscription", cancellationToken);
            return resp;
        }

        public async Task<GetChannelMessageHistoryResponse> GetChannelMessageHistoryAsync(
            GetChannelMessageHistoryArgs args, CancellationToken cancellationToken)
        {
            if (args.CursorLocation is not null)
            {
                var dirStr = args.CursorDirection == CursorDirection.Newer ? "newer" : "older";
                var resp = await this.PerformGetAsync<GetChannelMessageHistoryResponse>(
                    $"/api/message-history/{HttpUtility.UrlEncode(args.ChannelId.Value)}?cursor={HttpUtility.UrlEncode(args.CursorLocation)}&direction={HttpUtility.UrlEncode(dirStr)}", cancellationToken);
                return resp;
            }
            else 
            {
                var resp = await this.PerformGetAsync<GetChannelMessageHistoryResponse>(
                    $"/api/message-history/{HttpUtility.UrlEncode(args.ChannelId.Value)}", cancellationToken);
                return resp;
            }

        }

        public async Task<CreatePublicChannelResponse> CreatePublicChannelAsync(CreatePublicChannelArgs args, CancellationToken cancellationToken)
        {
            var resp = await this.PerformJsonPostAsync<CreatePublicChannelArgs, CreatePublicChannelResponse>("/api/channel/public", args, cancellationToken);
            return resp;
        }

        public async Task ChangeOpenChannelOrderAsync(ChangeOpenChannelOrderArgs args, CancellationToken cancellationToken)
        {
            var resp = await this.PerformJsonPatchAsync<ChangeOpenChannelOrderArgs, GenericResponse>(
                $"/api/chat/channel/subscriptions/character/{args.CharacterId}", args, cancellationToken);
        }

        public async Task<GetChannelActiveCharactersResponse> GetChannelActiveCharactersAsync(
            GetChannelActiveCharactersArgs args, CancellationToken cancellationToken)
        {
            var resp = await this.PerformGetAsync<GetChannelActiveCharactersResponse>(
                $"/api/channel/{HttpUtility.UrlEncode(args.ChannelId.Value)}/active-characters", cancellationToken);
            return resp;
        }

        public async Task<GetUnreadNotificationsCountResponse> GetUnreadNotificationsCountAsync(CancellationToken cancellationToken)
        {
            var resp = await this.PerformGetAsync<GetUnreadNotificationsCountResponse>("/api/notifications/unread-count", cancellationToken);
            return resp;
        }

        public async Task<GetNotificationsResponse> GetNotificationsAsync(GetNotificationsArgs args, CancellationToken cancellationToken)
        {
            var resp = await this.PerformGetAsync<GetNotificationsResponse>($"/api/notifications?page={args.Page}&size={args.Size}", cancellationToken);
            return resp;
        }

        public async Task MarkNotificationReadAsync(MarkNotificationReadArgs args, CancellationToken cancellationToken)
        {
            var resp = await this.PerformDeleteAsync<GenericResponse>($"/api/notifications/{args.NotificationId}", cancellationToken);
        }

        public async Task MarkAllNotificationsReadAsync(CancellationToken cancellationToken)
        {
            var resp = await this.PerformDeleteAsync<GenericResponse>($"/api/notifications/all", cancellationToken);
        }

        public async Task SendFriendRequestAsync(SendFriendRequestArgs args, CancellationToken cancellationToken)
        {
            var resp = await this.PerformJsonPostAsync<SendFriendRequestArgs, GenericResponse>($"/api/characters/friend-request", args, cancellationToken);
        }

        public async Task<GetPendingFriendRequestsResponse> GetPendingFriendRequestsAsync(CancellationToken cancellationToken)
        {
            var resp = await this.PerformGetAsync<GetPendingFriendRequestsResponse>("/api/characters/friend-requests", cancellationToken);
            return resp;
        }

        public async Task AcceptPendingFriendRequestAsync(AcceptPendingFriendRequestArgs args, CancellationToken cancellationToken)
        {
            var resp = await this.PerformJsonPostAsync<AcceptPendingFriendRequestArgs, GenericResponse>(
                "/api/characters/friend-requests/accept", args, cancellationToken);
        }

        public async Task DenyPendingFriendRequestAsync(DenyPendingFriendRequestArgs args, CancellationToken cancellationToken)
        {
            var resp = await this.PerformJsonPostAsync<DenyPendingFriendRequestArgs, GenericResponse>(
                "/api/characters/friend-requests/deny", args, cancellationToken);
        }

        public async Task<GetFriendsListResponse> GetFriendsListAsync(CancellationToken cancellationToken)
        {
            var resp = await this.PerformGetAsync<GetFriendsListResponse>("/api/user/friends", cancellationToken);
            return resp;
        }

        public async Task<GetMyEIconsResponseItem[]> GetMyEIconsAsync(CancellationToken cancellationToken)
        {
            var resp = await this.PerformGetAsync<GetMyEIconsResponseItem[]>("/api/icon", cancellationToken);
            return resp;
        }

        public async Task RenameEIconAsync(RenameEIconArgs args, CancellationToken cancellationToken)
        {
            var resp = await this.PerformJsonPatchAsync<RenameEIconArgs, GenericResponse>($"/api/icon/{HttpUtility.UrlEncode(args.ExistingName)}", args, cancellationToken);
        }

        public async Task DeleteEIconAsync(DeleteEIconArgs args, CancellationToken cancellationToken)
        {
            var resp = await this.PerformDeleteAsync<GenericResponse>($"/api/icon/{args.EIconName}", cancellationToken);
        }

        public async Task UploadEIconAsync(UploadEIconArgs args, CancellationToken cancellationToken)
        {
            var resp = await this.PerformFormPostAsync<GenericResponse>("/api/icon/upload", [
                new("icon", args.EIconImageData),
                new("name", args.EIconName)
            ], cancellationToken);
        }

        public async Task<SearchEIconsResponse> SearchEIconsAsync(SearchEIconsArgs args, CancellationToken cancellationToken)
        {
            var resp = await this.PerformGetAsync<SearchEIconsResponse>(
                $"/api/icon/search?searchTerm={HttpUtility.UrlEncode(args.SearchTerm)}&page={args.Page}", cancellationToken);
            return resp;
        }

        public async Task<GetInlineImagesResponseItem[]> GetInlineImagesAsync(CancellationToken cancellationToken)
        {
            var resp = await this.PerformGetAsync<GetInlineImagesResponseItem[]>("/api/inline-image", cancellationToken);
            return resp;
        }

        public async Task UploadInlineImageAsync(UploadInlineImageArgs args, CancellationToken cancellationToken)
        {
            var resp = await this.PerformFormPostAsync<GenericResponse>("/api/inline-image/upload", [
                new("inline-image", args.InlineImageData),
                new("name", args.Name),
                new("nsfw", args.Nsfw ? "true" : "false")
            ], cancellationToken);
        }

        public async Task DeleteInlineImageAsync(DeleteInlineImageArgs args, CancellationToken cancellationToken)
        {
            var resp = await this.PerformDeleteAsync<GenericResponse>($"/api/inline-image/{args.InlineImageId}", cancellationToken);
        }

        public async Task<GetCharacterProfileResponse> GetCharacterProfileAsync(GetCharacterProfileArgs args, CancellationToken cancellationToken)
        {
            var resp = await this.PerformGetAsync<GetCharacterProfileResponse>(
                $"/api/character/{HttpUtility.UrlEncode(args.CharacterName.Value)}/profile", cancellationToken);
            return resp;
        }
    }

    [JsonSerializable(typeof(AcceptPendingFriendRequestArgs))]
    [JsonSerializable(typeof(ChangeCharacterPresenceArgs))]
    [JsonSerializable(typeof(ChangeOpenChannelOrderArgs))]
    [JsonSerializable(typeof(CharacterOpenPMConvos))]
    [JsonSerializable(typeof(CharacterPresence))]
    [JsonSerializable(typeof(CharacterPresenceStatusView))]
    [JsonSerializable(typeof(CharacterStatus))]
    [JsonSerializable(typeof(ChatIgnoreList))]
    [JsonSerializable(typeof(CloseChatPMConversationArgs))]
    [JsonSerializable(typeof(CreatePublicChannelArgs))]
    [JsonSerializable(typeof(CreatePublicChannelResponse))]
    [JsonSerializable(typeof(CsrfTokenResponse))]
    [JsonSerializable(typeof(DenyPendingFriendRequestArgs))]
    [JsonSerializable(typeof(GenericResponse))]
    [JsonSerializable(typeof(GetChannelMessageHistoryArgs))]
    [JsonSerializable(typeof(GetChannelMessageHistoryResponse))]
    [JsonSerializable(typeof(GetCharacterPresenceArgs))]
    [JsonSerializable(typeof(GetChatPMConversationHistoryArgs))]
    [JsonSerializable(typeof(List<PMConversationUnreadResponseItem>))]
    [JsonSerializable(typeof(GetNotificationsArgs))]
    [JsonSerializable(typeof(GetNotificationsResponse))]
    [JsonSerializable(typeof(GetOpenChannelInfo))]
    [JsonSerializable(typeof(GetOpenChannelsForCharacter))]
    [JsonSerializable(typeof(GetJoinedChannelsResponse))]
    [JsonSerializable(typeof(GetOpenPMConvosResponse))]
    [JsonSerializable(typeof(GetPendingFriendRequestsResponse))]
    [JsonSerializable(typeof(GetUnreadNotificationsCountResponse))]
    [JsonSerializable(typeof(LoginArgs))]
    [JsonSerializable(typeof(LoginResponse))]
    [JsonSerializable(typeof(MarkNotificationReadArgs))]
    [JsonSerializable(typeof(OpenChatPMConversationArgs))]
    [JsonSerializable(typeof(OpenPMConvo))]
    [JsonSerializable(typeof(PMConversationHistoryItem))]
    [JsonSerializable(typeof(PMConversationHistoryResponse))]
    [JsonSerializable(typeof(PMConversationUnreadResponseItem))]
    [JsonSerializable(typeof(SearchEIconsArgs))]
    [JsonSerializable(typeof(SendFriendRequestArgs))]
    [JsonSerializable(typeof(UpdateCharacterStatusArgs))]
    [JsonSerializable(typeof(UserCharacter))]
    [JsonSerializable(typeof(UserCharacters))]
    [JsonSerializable(typeof(UserDetails))]
    [JsonSerializable(typeof(List<ChatEnabledCharacters>))]
    [JsonSerializable(typeof(GetFriendsListResponse))]
    [JsonSerializable(typeof(GetChannelListArgs))]
    [JsonSerializable(typeof(GetChannelListResponse))]
    [JsonSerializable(typeof(GetChannelActiveCharactersArgs))]
    [JsonSerializable(typeof(GetChannelActiveCharactersResponse))]
    [JsonSerializable(typeof(GetCharacterProfileArgs))]
    [JsonSerializable(typeof(GetCharacterProfileResponse))]
    [JsonSerializable(typeof(JoinChannelArgs))]
    [JsonSerializable(typeof(LeaveChannelArgs))]
    [JsonSerializable(typeof(SetChatEnabledCharactersArgs))]
    public partial class FList2ApiEntityJsonSerializerContext : JsonSerializerContext
    {

    }
}
