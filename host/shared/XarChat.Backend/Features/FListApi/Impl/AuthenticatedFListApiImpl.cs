using XarChat.Backend.Caching;
using System.Text.Json.Nodes;
using System.Text.Json;
using XarChat.Backend.Common;
using System.Text.Json.Serialization.Metadata;
using XarChat.Backend.Features.EIconUpdateSubmitter;
using System.Web;
using HtmlAgilityPack;
using Microsoft.AspNetCore.Mvc.RazorPages;
using XarChat.Backend.Features.LocalDataCache;
using System.Xml.Linq;

namespace XarChat.Backend.Features.FListApi.Impl
{
    public class AuthenticatedFListApiImpl : IAuthenticatedFListApi
    {
        private readonly FListApiImpl _flistApi;
        private readonly string _account;
        private readonly IDataUpdateSubmitter _dataUpdateSubmitter;
        private readonly ILocalDataCache _localDataCache;

        public record CreationArgs(FListApiImpl Owner, string Account);

        public AuthenticatedFListApiImpl(
            CreationArgs creationArgs,
            IDataUpdateSubmitter dataUpdateSubmitter,
            ILocalDataCache localDataCache)
        {
            this._flistApi = creationArgs.Owner;
            this._account = creationArgs.Account;
            this._dataUpdateSubmitter = dataUpdateSubmitter;
            this._localDataCache = localDataCache;
        }

        public string Account => _account;

        private Task<T> PerformAuthenticatedRequest<T>(string urlPath,
            IEnumerable<KeyValuePair<string, string>> formData,
            JsonTypeInfo<T> jsonTypeInfo,
            CancellationToken cancellationToken)
            => PerformAuthenticatedRequest<T>(urlPath, formData, jsonTypeInfo, null, cancellationToken);

        private async Task<T> PerformAuthenticatedRequest<T>(string urlPath,
            IEnumerable<KeyValuePair<string, string>> formData,
            JsonTypeInfo<T> jsonTypeInfo,
            Func<string, Task>? rawResponseTapFunc,
            CancellationToken cancellationToken)
        {
            var hc = _flistApi.GetHttpClient();
            var apiTicket = await this.GetApiTicketAsync(false, cancellationToken);
            if (apiTicket.CameFromCache)
            {
                try
                {
                    System.Diagnostics.Debug.WriteLine($"Performing authenticated request with cached ticket {apiTicket.Value.Ticket}");
                    var xresult = await PerformAuthenticatedRequestInternal<T>(urlPath, formData,
                        hc, apiTicket.Value.Ticket, jsonTypeInfo, rawResponseTapFunc, cancellationToken);
                    return xresult;
                }
                catch (InvalidTicketException)
                {
                    System.Diagnostics.Debug.WriteLine($"Detected invalid ticket: {apiTicket.Value.Ticket}");
                }

                System.Diagnostics.Debug.WriteLine($"Invalidating ticket {apiTicket.Value.Ticket}");
                await this.InvalidateApiTicketAsync(apiTicket.Value.Ticket, cancellationToken);
                apiTicket = await this.GetApiTicketAsync(false, cancellationToken);
            }

            System.Diagnostics.Debug.WriteLine($"Performing authenticated request with fresh ticket {apiTicket.Value.Ticket}");
            var result = await PerformAuthenticatedRequestInternal<T>(urlPath, formData,
                        hc, apiTicket.Value.Ticket, jsonTypeInfo, rawResponseTapFunc, cancellationToken);
            return result;
        }

        private async Task<T> PerformAuthenticatedRequestInternal<T>(string urlPath,
            IEnumerable<KeyValuePair<string, string>> formData,
            HttpClient hc, string ticket,
            JsonTypeInfo<T> jsonTypeInfo,
            Func<string, Task>? rawResponseTapFunc,
            CancellationToken cancellationToken)
        {
            var in405Retry = false;
        TRYAGAIN:
            var kvpList = new List<KeyValuePair<string, string>>(formData);
            kvpList.Add(new KeyValuePair<string, string>("account", _account));
            kvpList.Add(new KeyValuePair<string, string>("ticket", ticket));

            var url = _flistApi.ApiUrlBase + urlPath;
            var req = _flistApi.GetHttpRequestMessage(HttpMethod.Post, url);
            req.Content = new FormUrlEncodedContent(kvpList);
            System.Diagnostics.Debug.WriteLine($"Performing authenticated request url={urlPath}");
            var resp = await hc.SendAsync(req, cancellationToken);
            if (resp.StatusCode == System.Net.HttpStatusCode.MethodNotAllowed)
            {
                // sometimes the API returns this?!
                if (!in405Retry)
                {
                    await _flistApi.DumpRequestResponseDetails(req, resp);
                    System.Diagnostics.Debug.WriteLine($"API returned error 405 - retrying");
                    in405Retry = true;
                    await Task.Delay(500);
                    goto TRYAGAIN;
                }
                else
                {
                    System.Diagnostics.Debug.WriteLine($"API returned error 405 - 2nd fail");
                    throw new InvalidTicketException();
                }
            }
            resp.EnsureSuccessStatusCode();
            var json = await resp.Content.ReadAsStringAsync();
            var jobj = JsonUtilities.Deserialize<JsonObject>(json, SourceGenerationContext.Default.JsonObject);
            if (jobj == null)
            {
                System.Diagnostics.Debug.WriteLine($"API returned null");
                throw new ApplicationException("API returned null");
            }
            var errStr = (jobj != null && jobj.ContainsKey("error")) ? jobj["error"]?.ToString() : null;
            if (!String.IsNullOrWhiteSpace(errStr))
            {
                if (errStr.ToLower().Contains("ticket"))
                {
                    System.Diagnostics.Debug.WriteLine($"API returned invalid ticket");
                    throw new InvalidTicketException();
                }
                await (rawResponseTapFunc is not null ? rawResponseTapFunc(json) : Task.CompletedTask);
                throw new FListApiException(errStr);
            }

            //try
            //{
                await (rawResponseTapFunc is not null ? rawResponseTapFunc(json) : Task.CompletedTask);
                var result = jobj.Deserialize<T>(jsonTypeInfo)!; // jobj!.ToObject<T>()!;
                System.Diagnostics.Debug.WriteLine($"API returned result");
                return result;
            //}
            //catch (Exception ex)
            //{
            //    throw;
            //}
        }

        public async Task AddBookmarkAsync(string name, CancellationToken cancellationToken)
        {
            var formData = new Dictionary<string, string>
            {
                { "name", name }
            };

            System.Diagnostics.Debug.WriteLine($"addbookmark {name}");
            await PerformAuthenticatedRequest<JsonObject>("api/bookmark-add.php", formData, SourceGenerationContext.Default.JsonObject, cancellationToken);
        }

        public Task<ValueWithCameFromCache<ApiTicket>> GetApiTicketAsync(bool verifyTicket, CancellationToken cancellationToken)
            => _flistApi.GetApiTicketAsync(_account, null, verifyTicket, cancellationToken);

        public async Task<ProfileInfo> GetCharacterProfileAsync(string name, bool bypassCache, CancellationToken cancellationToken)
        {
            var formData = new Dictionary<string, string>
            {
                { "name", name }
            };
            var result = await PerformAuthenticatedRequest<ProfileInfo>("api/character-data.php", formData,
                SourceGenerationContext.Default.ProfileInfo,
                async (profileJson) =>
                {
                    await _dataUpdateSubmitter.SubmitHardLoadedProfileDataAsync(name, profileJson, cancellationToken);
                },
                cancellationToken);

            if (result.Memo is not null)
            {
                await _localDataCache.EvictAsync(GetMemoCacheKey(name), cancellationToken);
                await _localDataCache.AssignAsync(GetMemoCacheKey(name), result.Memo.Memo,
                    SourceGenerationContext.Default.String,
                    TimeSpan.FromHours(1), cancellationToken);
            }
            return result;
        }

        public async Task<FriendsList> GetFriendsListAsync(CancellationToken cancellationToken)
        {
            var formData = new Dictionary<string, string>
            {
                { "bookmarklist", "true" },
                { "friendlist", "true" },
                { "requestlist", "true" },
                { "requestpending", "true" },
            };
            var result = await PerformAuthenticatedRequest<FriendsList>("api/friend-bookmark-lists.php", formData,
                SourceGenerationContext.Default.FriendsList, cancellationToken);
            return result;
        }

        public Task InvalidateApiTicketAsync(string ticket, CancellationToken cancellationToken)
            => _flistApi.InvalidateApiTicketAsync(_account, ticket, cancellationToken);

#if DEBUG
        public async Task DebugBreakTicketAsync(CancellationToken cancellationToken)
            => _flistApi.DebugBreakTicketAsync(_account, cancellationToken);
#endif

        public async Task RemoveBookmarkAsync(string name, CancellationToken cancellationToken)
        {
            var formData = new Dictionary<string, string>
            {
                { "name", name }
            };

            System.Diagnostics.Debug.WriteLine($"removebookmark {name}");
            await PerformAuthenticatedRequest<JsonObject>("api/bookmark-remove.php", formData,
                SourceGenerationContext.Default.JsonObject, cancellationToken);
        }

        public async Task<SendFriendRequestResponse> AddFriendRequestAsync(
            string myCharName, string theirCharName, CancellationToken cancellationToken)
        {
            var formData = new Dictionary<string, string>
            {
                { "source", myCharName },
                { "target", theirCharName },
            };


            System.Diagnostics.Debug.WriteLine($"addfriendrequest {myCharName} -> {theirCharName}");
            var result = await PerformAuthenticatedRequest<SendFriendRequestResponse>("api/request-send2.php", formData,
                SourceGenerationContext.Default.SendFriendRequestResponse, cancellationToken);
            return result;
        }

        public async Task CancelFriendRequestAsync(int friendRequestId, CancellationToken cancellationToken)
        {
            var formData = new Dictionary<string, string>
            {
                { "request_id", friendRequestId.ToString() }
            };

            System.Diagnostics.Debug.WriteLine($"cancelfriendrequest {friendRequestId}");
            await PerformAuthenticatedRequest<JsonObject>("api/request-cancel.php", formData,
                SourceGenerationContext.Default.JsonObject, cancellationToken);
        }

        public async Task AcceptIncomingFriendRequestAsync(int friendRequestId, CancellationToken cancellationToken)
        {
            var formData = new Dictionary<string, string>
            {
                { "request_id", friendRequestId.ToString() }
            };

            System.Diagnostics.Debug.WriteLine($"acceptfriendrequest {friendRequestId}");
            await PerformAuthenticatedRequest<JsonObject>("api/request-accept.php", formData,
                SourceGenerationContext.Default.JsonObject, cancellationToken);
        }

        public async Task RejectIncomingFriendRequestAsync(int friendRequestId, CancellationToken cancellationToken)
        {
            var formData = new Dictionary<string, string>
            {
                { "request_id", friendRequestId.ToString() }
            };

            System.Diagnostics.Debug.WriteLine($"denyfriendrequest {friendRequestId}");
            await PerformAuthenticatedRequest<JsonObject>("api/request-deny.php", formData,
                SourceGenerationContext.Default.JsonObject, cancellationToken);
        }

        public async Task RemoveFriendAsync(string myCharName, string theirCharName, CancellationToken cancellationToken)
        {
            var formData = new Dictionary<string, string>
            {
                { "source_name", myCharName },
                { "dest_name", theirCharName },
            };

            System.Diagnostics.Debug.WriteLine($"removefriend {myCharName} / {theirCharName}");
            await PerformAuthenticatedRequest<JsonObject>("api/friend-remove.php", formData,
                SourceGenerationContext.Default.JsonObject, cancellationToken);
        }

        public async Task<SaveMemoResponse> SaveMemoAsync(string name, string memo, CancellationToken cancellationToken)
        {
            var formData = new Dictionary<string, string>
            {
                { "target_name", name },
                { "note", memo }
            };

            System.Diagnostics.Debug.WriteLine($"savememo {name}");
            var result = await PerformAuthenticatedRequest<SaveMemoResponse>("api/character-memo-save.php", formData,
                SourceGenerationContext.Default.SaveMemoResponse, cancellationToken);

            await _localDataCache.AssignAsync(GetMemoCacheKey(name), result.Note,
                SourceGenerationContext.Default.String,
                TimeSpan.FromHours(1), cancellationToken);

            return result;
        }

        public async Task<SubmitReportResponse> SubmitReportAsync(
            string reportSubmitCharacter,
            string reportText,
            string log,
            string channel,
            string? reportTargetCharacter,
            CancellationToken cancellationToken)
        {
            var formData = new Dictionary<string, string>
            {
                { "character", reportSubmitCharacter },
                { "reportText", reportText },
                { "log", log },
                { "channel", channel },
                { "text", "true" },
            };
            if (!String.IsNullOrWhiteSpace(reportTargetCharacter))
            {
                formData["reportUser"] = reportTargetCharacter;
            }

            System.Diagnostics.Debug.WriteLine($"submitreport {reportSubmitCharacter}->{reportTargetCharacter}");
            var result = await PerformAuthenticatedRequest<SubmitReportResponse>("api/report-submit.php", formData,
                SourceGenerationContext.Default.SubmitReportResponse, cancellationToken);
            //var result = new SubmitReportResponse() { LogId = null };

            return result;
        }

        public async Task<ProfileFriendsInfo> GetCharacterFriendsAsync(string name, CancellationToken cancellationToken)
        {
            var formData = new Dictionary<string, string>
            {
                { "name", name }
            };

            try
            {
                var result = await PerformAuthenticatedRequest<ProfileFriendsInfo>("api/character-friends.php", formData,
                    SourceGenerationContext.Default.ProfileFriendsInfo, cancellationToken);

                return result;
            }
            catch (FListApiException ex) when (ex.Message == "This user has disabled their friends tab.")
            {
                return new ProfileFriendsInfo() { Friends = [] };
            }
        }

        public async Task<GuestbookPageInfo> GetCharacterGuestbookPageAsync(
            string name, int page, CancellationToken cancellationToken)
        {
            var formData = new Dictionary<string, string>
            {
                { "name", name },
                { "page", page.ToString() }
            };

            var result = await PerformAuthenticatedRequest<GuestbookPageInfo>("api/character-guestbook.php", formData,
                SourceGenerationContext.Default.GuestbookPageInfo, cancellationToken);

            return result;
        }

        private string GetMemoCacheKey(string name) => $"Memo::{this.Account}::{name}";

        public async Task<GetAllMemosResponseItem> GetMemoAsync(string name, CancellationToken cancellationToken)
        {
            var cacheKey = GetMemoCacheKey(name);
            var memoText = await _localDataCache.GetOrCreateAsync(
                cacheKey: cacheKey,
                asyncCreationFunc: async (cancellationToken) =>
                {
                    var formData = new Dictionary<string, string>
                    {
                        { "target", name }
                    };

                    var result = await PerformAuthenticatedRequest<GetAllMemosResponseItem>("api/character-memo-get2.php", formData,
                        SourceGenerationContext.Default.GetAllMemosResponseItem, cancellationToken);

                    return result.MemoText;
                },
                maxAge: TimeSpan.FromHours(1),
                jsonTypeInfo: SourceGenerationContext.Default.String,
                cancellationToken: cancellationToken);

            return new GetAllMemosResponseItem()
            {
                CharacterName = name,
                MemoText = memoText
            };
        }
    }
}
