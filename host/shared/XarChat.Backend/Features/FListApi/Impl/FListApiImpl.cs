using Microsoft.Extensions.DependencyInjection;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Security.Principal;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using XarChat.Backend.Caching;
using XarChat.Backend.Common;
using XarChat.Backend.Features.EIconUpdateSubmitter;

namespace XarChat.Backend.Features.FListApi.Impl
{
    public class FListApiImpl : IFListApi
    {
        private readonly HttpClient _httpClient;
        private readonly IServiceProvider _serviceProvider;

		public FListApiImpl(
            IHttpClientFactory httpClientFactory,
            IServiceProvider serviceProvider)
        {
            _httpClient = httpClientFactory.CreateClient(nameof(IFListApi));
            _serviceProvider = serviceProvider;
		}

        private readonly AsyncCache _cache = new AsyncCache(TimeSpan.FromSeconds(120), TimeSpan.FromSeconds(5));

        public async Task<KinksList> GetKinksListAsync(CancellationToken cancellationToken)
        {
            var cacheKey = "GetKinksListAsync";
            var result = await _cache.GetOrCreateAsync(cacheKey, async () =>
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(120));

                var hc = this.GetHttpClient();
                var url = this.ApiUrlBase + "api/kink-list.php";
                var req = GetHttpRequestMessage(HttpMethod.Get, url);
                var resp = await hc.SendAsync(req, cts.Token);
                var json = await resp.Content.ReadAsStringAsync(cts.Token);
                var result = JsonUtilities.Deserialize<KinksList>(json, SourceGenerationContext.Default.KinksList)!;
                return new AsyncCacheCreationResult<KinksList>(result, TimeSpan.FromHours(2));
            }, cancellationToken);
            return result.Value;
        }

        public async Task<PartnerSearchFieldsDefinitions> GetPartnerSearchFieldsDefinitionsAsync(CancellationToken cancellationToken)
        {
            var cacheKey = "GetPartnerSearchFieldsDefinitionsAsync";
            var result = await _cache.GetOrCreateAsync(cacheKey, async () =>
            {
                var q =
                    from n in Assembly.GetExecutingAssembly().GetManifestResourceNames()
                    where n.EndsWith(".ChatSearchFields.json")
                    select Assembly.GetExecutingAssembly().GetManifestResourceStream(n);

                using var stream = q.First();
                using var sr = new StreamReader(stream);
                var json = await sr.ReadToEndAsync(CancellationToken.None);

                var result = JsonUtilities.Deserialize<PartnerSearchFieldsDefinitions>(json, SourceGenerationContext.Default.PartnerSearchFieldsDefinitions)!;
                return new AsyncCacheCreationResult<PartnerSearchFieldsDefinitions>(result, TimeSpan.FromHours(2));
            }, cancellationToken);
            return result.Value;
        }

        public async Task<MappingList> GetMappingListAsync(CancellationToken cancellationToken)
        {
            var cacheKey = "GetMappingListAsync";
            var result = await _cache.GetOrCreateAsync(cacheKey, async () =>
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(120));

                var hc = this.GetHttpClient();
                var url = this.ApiUrlBase + "api/mapping-list.php";
                var req = GetHttpRequestMessage(HttpMethod.Get, url);
                var resp = await hc.SendAsync(req, cts.Token);
                var json = await resp.Content.ReadAsStringAsync(cts.Token);
                var result = JsonUtilities.Deserialize<MappingList>(json, SourceGenerationContext.Default.MappingList)!;
                return new AsyncCacheCreationResult<MappingList>(result, TimeSpan.FromHours(2));
            }, cancellationToken);
            return result.Value;
        }

        public async Task<ProfileFieldsInfoList> GetProfileFieldsInfoListAsync(CancellationToken cancellationToken)
        {
            var cacheKey = "GetProfileFieldsInfoListAsync";
            var result = await _cache.GetOrCreateAsync(cacheKey, async () =>
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(120));

                var hc = this.GetHttpClient();
                var url = this.ApiUrlBase + "api/info-list.php";
                var req = GetHttpRequestMessage(HttpMethod.Get, url);
                var resp = await hc.SendAsync(req, cts.Token);
                var json = await resp.Content.ReadAsStringAsync(cts.Token);
                var result = JsonUtilities.Deserialize<ProfileFieldsInfoList>(json, SourceGenerationContext.Default.ProfileFieldsInfoList)!;
                return new AsyncCacheCreationResult<ProfileFieldsInfoList>(result, TimeSpan.FromHours(2));
            }, cancellationToken);
            return result.Value;
        }

        async Task<IAuthenticatedFListApi> IFListApi.GetAuthenticatedFListApiAsync(string account, string password, CancellationToken cancellationToken)
            => await this.GetAuthenticatedFListApiAsync(account, password, cancellationToken);

        private AuthenticatedFListApiImpl CreateAuthenticatedFListApiImpl(string account)
        {
            var result = ActivatorUtilities.CreateInstance<AuthenticatedFListApiImpl>(
                _serviceProvider, 
                new AuthenticatedFListApiImpl.CreationArgs(this, account));
			return result;
		}

		public async Task<AuthenticatedFListApiImpl> GetAuthenticatedFListApiAsync(string account, string password, CancellationToken cancellationToken)
        {
            var apiTicket = await GetApiTicketAsync(account, password, false, cancellationToken);
            var result = CreateAuthenticatedFListApiImpl(account);
            return result;
        }

        async Task<IAuthenticatedFListApi> IFListApi.GetAlreadyAuthenticatedFListApiAsync(string account, CancellationToken cancellationToken)
            => await this.GetAlreadyAuthenticatedFListApiAsync(account, cancellationToken);

        public async Task<AuthenticatedFListApiImpl> GetAlreadyAuthenticatedFListApiAsync(string account, CancellationToken cancellationToken)
        {
            var apiTicket = await GetApiTicketAsync(account, null, false, cancellationToken);
			var result = CreateAuthenticatedFListApiImpl(account);
			return result;
        }

        internal HttpClient GetHttpClient() => _httpClient;

        internal HttpRequestMessage GetHttpRequestMessage(HttpMethod method, string url)
        {
            var req = new HttpRequestMessage(method, url);
            req.Headers.Add("User-Agent", "XarChat-dev/0.1");  // TODO:
            return req;
        }

        internal async Task DumpRequestResponseDetails(HttpRequestMessage req, HttpResponseMessage resp)
        {
            var fn = $"httpdump-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}.log";
            using var f = File.CreateText(fn);
            f.WriteLine("===== REQUEST ====");
            f.WriteLine($"{req.Method} {req.RequestUri?.ToString()}");
            foreach (var hdr in req.Headers)
            {
                foreach (var hdrv in hdr.Value)
                {
                    try
                    {
                        f.WriteLine($"{hdr.Key}: {hdrv}");
                    }
                    catch { }
                }
            }
            if (req.Content != null)
            {
                foreach (var hdr in req.Content.Headers)
                {
                    foreach (var hdrv in hdr.Value)
                    {
                        try
                        {
                            f.WriteLine($"{hdr.Key}: {hdrv}");
                        }
                        catch { }
                    }
                }
            }
            f.WriteLine();
            if (req.Content != null)
            {
                try
                {
                    using var reqBodyStream = req.Content.ReadAsStream();
                    using var reqBodyStreamReader = new StreamReader(reqBodyStream);
                    var reqBodyStr = reqBodyStreamReader.ReadToEnd();
                    f.WriteLine(reqBodyStr);
                }
                catch (Exception e)
                {
                    f.WriteLine($"FAILED TO LOG: {e}");
                }
            }

            f.WriteLine();
            f.WriteLine("===== RESPONSE =====");
            f.WriteLine($"{(int)resp.StatusCode} {resp.ReasonPhrase}");
            foreach (var hdr in resp.Headers)
            {
                foreach (var hdrv in hdr.Value)
                {
                    try
                    {
                        f.WriteLine($"{hdr.Key}: {hdrv}");
                    }
                    catch { }
                }
            }
            if (resp.Content != null)
            {
                foreach (var hdr in resp.Content.Headers)
                {
                    foreach (var hdrv in hdr.Value)
                    {
                        try
                        {
                            f.WriteLine($"{hdr.Key}: {hdrv}");
                        }
                        catch { }
                    }
                }
            }
            f.WriteLine();
            if (resp.Content != null)
            {
                try
                {
                    using var respBodyStream = resp.Content.ReadAsStream();
                    using var respBodyStreamReader = new StreamReader(respBodyStream);
                    var respBodyStr = respBodyStreamReader.ReadToEnd();
                    f.WriteLine(respBodyStr);
                }
                catch (Exception e)
                {
                    f.WriteLine($"FAILED TO LOG: {e}");
                }
            }
        }

        internal string ApiUrlBase => "https://www.f-list.net/json/";

        internal string WebsiteUrlBase => "https://www.f-list.net/";

        internal async Task<ValueWithCameFromCache<ApiTicket>> GetApiTicketAsync(
            string account, string? password, bool verifyTicket, CancellationToken cancellationToken)
        {
        TRYAGAIN:
            var cte = await _cache.GetOrCreateAsync<CachedApiTicketEntry>($"apiTicket-{account.ToLower()}", async () =>
            {
                if (password != null)
                {
                    var newEntry = await CachedApiTicketEntry.CreateAsync(this, account, password);
                    return new AsyncCacheCreationResult<CachedApiTicketEntry>(newEntry, TimeSpan.FromDays(99999));
                }
                else
                {
                    throw new Exception("Credentials not set yet");
                }
            }, cancellationToken);

            var apiTicket = await cte.Value.Task;

            if (verifyTicket && cte.CameFromCache)
            {
                try
                {
                    await VerifyApiTicketAsync(cte.Value.Account, apiTicket, cancellationToken);
                }
                catch
                {
                    await InvalidateApiTicketAsync(cte.Value.Account, apiTicket.Ticket, cancellationToken);
                    goto TRYAGAIN;
                }
            }

            return new ValueWithCameFromCache<ApiTicket>(apiTicket, cte.CameFromCache);
        }

        private async Task VerifyApiTicketAsync(string account, ApiTicket apiTicket, CancellationToken cancellationToken)
        {
            var hc = GetHttpClient();

            var req = GetHttpRequestMessage(HttpMethod.Post, ApiUrlBase + "api/request-list.php");
            req.Content = new FormUrlEncodedContent(new List<KeyValuePair<string, string>>
                {
                    new KeyValuePair<string, string>("account", account),
                    new KeyValuePair<string, string>("ticket", apiTicket.Ticket)
                });

            System.Diagnostics.Debug.WriteLine("Verifying api ticket...");
            var resp = await hc.SendAsync(req, cancellationToken);
            resp.EnsureSuccessStatusCode();

            var json = await resp.Content.ReadAsStringAsync();

            var dynObj = JsonUtilities.Deserialize<JsonObject>(json, SourceGenerationContext.Default.JsonObject);

            if (dynObj == null)
            {
                throw new ApplicationException($"Verify ticket call failed, server returned null.");
            }

            var errMsg = (dynObj?.ContainsKey("error") ?? false) ? dynObj["error"]?.ToString() : "";
            if (!String.IsNullOrEmpty(errMsg))
            {
                throw new FListApiErrorException(errMsg);
            }
        }

        internal async Task InvalidateApiTicketAsync(string account, string ifTicket, CancellationToken cancellationToken)
        {
            var cte = await _cache.GetOrCreateAsync<CachedApiTicketEntry>($"apiTicket-{account.ToLower()}", async () =>
            {
                throw new Exception("Credentials not set yet");
            }, cancellationToken);

            await cte.Value.InvalidateApiTicketAsync(ifTicket, cancellationToken);
        }

#if DEBUG
        internal async Task DebugBreakTicketAsync(string account, CancellationToken cancellationToken)
        {
            var cte = await _cache.GetOrCreateAsync<CachedApiTicketEntry>($"apiTicket-{account.ToLower()}", async () =>
            {
                throw new Exception("Credentials not set yet");
            }, cancellationToken);

            cte.Value.BreakTicketAsync(cancellationToken);
        }
#endif


        private class CachedApiTicketEntry
        {
            public static async Task<CachedApiTicketEntry> CreateAsync(FListApiImpl owner, string account, string password)
            {
                var r = new CachedApiTicketEntry(owner, account, password);
                await r.Task;
                return r;
            }

            private CachedApiTicketEntry(FListApiImpl owner, string account, string password)
            {
                _owner = owner;
                this._password = null!;
                this._cachedResult = null;
                this.Account = account;
                this.Password = password;
            }

            private readonly FListApiImpl _owner;
            private SemaphoreSlim _stateLock = new SemaphoreSlim(1);
            private string _password;
            private Task<ApiTicket>? _cachedResult;
            private DateTimeOffset _cachedResultExpiresAt;

            public string Account { get; }

            public string Password
            {
                get => _password;
                set
                {
                    _stateLock.Wait();
                    try
                    {
                        if (_password != value)
                        {
                            _password = value;
                            _cachedResultExpiresAt = DateTimeOffset.UtcNow + TimeSpan.FromSeconds(120);
                            _cachedResult = AcquireApiTicketAsync(this.Account, value, CancellationToken.None);
                        }
                    }
                    finally
                    {
                        _stateLock.Release();
                    }
                }
            }

            public Task<ApiTicket> Task
            {
                get
                {
                    _stateLock.Wait();
                    try
                    {
                        if (_cachedResultExpiresAt < DateTimeOffset.UtcNow)
                        {
                            _cachedResultExpiresAt = DateTimeOffset.UtcNow + TimeSpan.FromMinutes(28);
                            _cachedResult = AcquireApiTicketAsync(this.Account, this.Password, CancellationToken.None);
                        }
                        return _cachedResult!;
                    }
                    finally
                    {
                        _stateLock.Release();
                    }
                }
            }

            internal async Task InvalidateApiTicketAsync(string ifTicket, CancellationToken cancellationToken)
            {
                await _stateLock.WaitAsync();
                try
                {
                    if (_cachedResult != null && _cachedResult.IsCompleted)
                    {
                        var t = _cachedResult.Result;
                        if (t.Ticket == ifTicket)
                        {
                            _cachedResult = null;
                            _cachedResultExpiresAt = DateTimeOffset.UtcNow - TimeSpan.FromSeconds(1);
                        }
                    }
                }
                finally
                {
                    _stateLock.Release();
                }
            }

#if DEBUG
            internal async Task BreakTicketAsync(CancellationToken cancellationToken)
            {
                await _stateLock.WaitAsync();
                try
                {
                    if (_cachedResult != null && _cachedResult.IsCompleted)
                    {
                        var t = _cachedResult.Result;
                        t.Ticket = t.Ticket.Substring(0, t.Ticket.Length - 1) + "z";
                    }
                }
                finally
                {
                    _stateLock.Release();
                }
            }
#endif

            private async Task<ApiTicket> AcquireApiTicketAsync(string account, string password, CancellationToken cancellationToken)
            {
                var task = System.Threading.Tasks.Task.Run(async () =>
                {
                    var hc = _owner.GetHttpClient();

                    var req = _owner.GetHttpRequestMessage(HttpMethod.Post, _owner.ApiUrlBase + "getApiTicket.php");
                    req.Content = new FormUrlEncodedContent(new List<KeyValuePair<string, string>>
                    {
                        new KeyValuePair<string, string>("account", account),
                        new KeyValuePair<string, string>("password", password),
                        new KeyValuePair<string, string>("new_character_list", "true"),
                    });

                    System.Diagnostics.Debug.WriteLine("Acquiring new api ticket...");
                    var resp = await hc.SendAsync(req, cancellationToken);
                    resp.EnsureSuccessStatusCode();

                    var json = await resp.Content.ReadAsStringAsync();

                    var dynObj = JsonUtilities.Deserialize<JsonObject>(json, SourceGenerationContext.Default.JsonObject);

                    if (dynObj == null)
                    {
                        throw new ApplicationException($"GetApiTicket call failed, server returned null.");
                    }

                    var errMsg = (dynObj?.ContainsKey("error") ?? false) ? dynObj["error"]?.ToString() : "";
                    if (!String.IsNullOrEmpty(errMsg))
                    {
                        throw new FListApiErrorException(errMsg);
                    }

                    var result = dynObj.Deserialize<ApiTicket>(SourceGenerationContext.Default.ApiTicket)!;
                    System.Diagnostics.Debug.WriteLine($"Acquired new api ticket: {result.Ticket}");
                    return result;
                });

                _ = task.ContinueWith(async t =>
                {
                    _stateLock.Wait();
                    try
                    {
                        if (_cachedResult == task)
                        {
                            if (t.IsCompletedSuccessfully)
                            {
                                _cachedResultExpiresAt = DateTimeOffset.UtcNow + TimeSpan.FromMinutes(55);
                            }
                            else
                            {

                                _cachedResultExpiresAt = DateTimeOffset.UtcNow;
                            }
                        }
                    }
                    finally
                    {
                        _stateLock.Release();
                    }
                });

                return await task;
            }
        }
    }
}
