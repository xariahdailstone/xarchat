using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Hosting;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using XarChat.Backend.Common;
using XarChat.Backend.Features.AppConfiguration;
using XarChat.Backend.Features.EIconIndexing;

namespace XarChat.Backend.Features.EIconUpdateSubmitter.Impl
{
    internal class SubmitQueueItem
    { 
        public required DateTimeOffset AsOf { get; set; }
    }

	internal class EIconSubmitQueueItem : SubmitQueueItem
    { 
        public required string EIconName { get; set; }

        public required string ETag { get; set; }

        public required long ContentLength { get; set; }
    }

	internal class ProfileSubmitQueueItem : SubmitQueueItem
    {
		public required string CharacterName { get; set; }

		public required string ProfileData { get; set; }
	}

	internal class DataUpdateSubmitter : BackgroundService, IDataUpdateSubmitter
    {
        private readonly IHostApplicationLifetime _hostApplicationLifetime;
        private readonly IAppConfiguration _appConfiguration;
		private readonly IMemoryCache _memoryCache;

		private readonly IEIconIndex _eIconIndex;

        private readonly SemaphoreSlim _submitQueueSem = new SemaphoreSlim(1);
        private List<SubmitQueueItem> _submitQueue = new List<SubmitQueueItem>();
        private readonly ManualResetEventSlim _submitQueueHasItemsEvent = new ManualResetEventSlim(false);

        public DataUpdateSubmitter(
            IHostApplicationLifetime hostApplicationLifetime,
            IAppConfiguration appConfiguration,
            IMemoryCache memoryCache,
            IEIconIndex eIconIndex)
        {
            _hostApplicationLifetime = hostApplicationLifetime;
            _appConfiguration = appConfiguration;
			_memoryCache = memoryCache;
			_eIconIndex = eIconIndex;
        }

		private record EIconDataSubmitCacheKey(
			DataUpdateSubmitter DateUpdateSubmitter,
			string EIconName,
			string ETag,
            long ContentLength);

		private record ProfileDataSubmitCacheKey(
			DataUpdateSubmitter DateUpdateSubmitter,
            string CharacterName,
            string ProfileDataJsonHash);

        public async Task SubmitHardLoadedProfileDataAsync(string characterName, string profileBodyJson, CancellationToken cancellationToken)
        {
            var cacheKey = new ProfileDataSubmitCacheKey(this, characterName, GetProfileDataJsonHash(profileBodyJson));
            if (_memoryCache.TryGetValue(cacheKey, out _))
            {
                return;
            }

            _memoryCache.Set(cacheKey, new object(), TimeSpan.FromMinutes(60));

            await AddSubmitQueueItemAsync(
                new ProfileSubmitQueueItem()
                {
                    CharacterName = characterName,
                    ProfileData = profileBodyJson,
                    AsOf = DateTimeOffset.UtcNow
                },
                cancellationToken);
        }

        private string GetProfileDataJsonHash(string profileBodyJson) 
        {
            var hash = SHA256.Create().ComputeHash(System.Text.Encoding.UTF8.GetBytes(profileBodyJson));
            var sb = new StringBuilder(hash.Length * 2);
            foreach (var b in hash)
            {
                sb.Append(b.ToString("x"));
            }
            return sb.ToString();
        }

		public async Task SubmitHardLoadedEIconInfoAsync(string eiconName, string etag, long contentLength, CancellationToken cancellationToken)
        {
            var cacheKey = new EIconDataSubmitCacheKey(this, eiconName, etag, contentLength);
			if (_memoryCache.TryGetValue(cacheKey, out _))
			{
				return;
			}

			_memoryCache.Set(cacheKey, new object(), TimeSpan.FromMinutes(60));

			_ = HandleHardLoadedEIconInfoAsync(eiconName, etag, contentLength, _hostApplicationLifetime.ApplicationStopping);
        }

        private async Task HandleHardLoadedEIconInfoAsync(
            string eiconName, string etag, long contentLength, CancellationToken cancellationToken)
        {
            var extInfo = await _eIconIndex.GetEIconInfoExtendedAsync(eiconName, cancellationToken);
            if (extInfo is null || extInfo.ETag != etag || extInfo.ContentLength != contentLength)
            {
                await AddSubmitQueueItemAsync(new EIconSubmitQueueItem
                {
                    EIconName = eiconName,
                    ETag = etag,
                    ContentLength = contentLength,
                    AsOf = DateTimeOffset.UtcNow,
                },
                    cancellationToken);
            }
        }

		private async Task AddSubmitQueueItemAsync(
            SubmitQueueItem submitQueueItem, 
            CancellationToken cancellationToken)
		{
            if (_appConfiguration.EnableIndexDataCollection)
            {
                await _submitQueueSem.WaitAsync(cancellationToken);
                try
                {
                    _submitQueue.Add(submitQueueItem);
                    _submitQueueHasItemsEvent.Set();
                }
                finally
                {
                    _submitQueueSem.Release();
                }
            }
		}

		protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            try
            {
                while (true)
                {
                    await WaitOnWaitHandle(_submitQueueHasItemsEvent.WaitHandle, stoppingToken);
                    await SendSubmitQueueAsync(stoppingToken);
                }
            }
            catch when (stoppingToken.IsCancellationRequested)
            {
            }
        }

        private async Task SendSubmitQueueAsync(CancellationToken cancellationToken)
        {
            List<SubmitQueueItem> toSend;

            await _submitQueueSem.WaitAsync(cancellationToken);
            try
            {
                toSend = _submitQueue;
                _submitQueue = new List<SubmitQueueItem>();
                _submitQueueHasItemsEvent.Reset();
            }
            finally
            {
                _submitQueueSem.Release();
            }

            if (toSend.Count > 0)
            {
                using var hc = new HttpClient();

                var retriesRetaining = 5;

                while (retriesRetaining > 0)
                {
                    try
                    {
                        var url = "https://xariah.net/eicons/Home/ClientSubmitIcons";

                        var items = new DataUpdateSubmitBody()
                        {
                            EIconItems = toSend
                                .OfType<EIconSubmitQueueItem>()
                                .Select(x => new EIconUpdateSubmitLineItem()
                                {
                                    EIconName = x.EIconName,
                                    ETag = x.ETag,
                                    ContentLength = x.ContentLength,
                                    AsOf = x.AsOf.ToUnixTimeMilliseconds()
                                }).ToList(),
                            ProfileDataItems = toSend
                                .OfType<ProfileSubmitQueueItem>()
                                .Select(x => new ProfileDataSubmitLineItem() 
                                { 
                                    CharacterName = x.CharacterName,
                                    ProfileData = x.ProfileData,
									AsOf = x.AsOf.ToUnixTimeMilliseconds()
								}).ToList()
                        };

                        var submitJson = JsonSerializer.Serialize(items, SourceGenerationContext.Default.DataUpdateSubmitBody);

                        var stringContent = new StringContent(submitJson, System.Text.Encoding.UTF8, "application/json");
                        var resp = await hc.PostAsync(url, stringContent);
                        resp.EnsureSuccessStatusCode();
                        return;
                    }
                    catch
                    {
                    }
                    await Task.Delay(TimeSpan.FromSeconds(30));
                    retriesRetaining--;
                }
            }
        }

        private async Task WaitOnWaitHandle(WaitHandle waitHandle, CancellationToken cancellationToken)
        {
            var tcs = new TaskCompletionSource();

            var registeredWait = ThreadPool.RegisterWaitForSingleObject(waitHandle, delegate
            {
                tcs.TrySetResult();
            }, null, -1, true);

            using var cancelReg = cancellationToken.Register(() =>
            {
                tcs.TrySetCanceled(cancellationToken);
                registeredWait.Unregister(waitHandle);
            });

            await tcs.Task;
        }

        private record struct SubmittedCacheKey(string EIconName, string ETag, long ContentLength);

        private record struct SubmittedCacheEntry(DateTime ExpiresAt);
    }

    public class DataUpdateSubmitBody
    {
        [JsonPropertyName("items")]
        public List<EIconUpdateSubmitLineItem>? EIconItems { get; set; } = null;

		[JsonPropertyName("profileDataItems")]
		public List<ProfileDataSubmitLineItem>? ProfileDataItems { get; set; } = null;
	}

    public class ProfileDataSubmitLineItem
    {
		[JsonPropertyName("c")]
		public required string CharacterName { get; set; }

		[JsonPropertyName("d")]
		public required string ProfileData { get; set; }

		[JsonPropertyName("t")]
		public required long AsOf { get; set; }
	}

    public class EIconUpdateSubmitLineItem
    {
        [JsonPropertyName("n")]
        public required string EIconName { get; set; }

        [JsonPropertyName("e")]
        public required string ETag { get; set; }

        [JsonPropertyName("l")]
        public required long ContentLength { get; set; } = 0;

		[JsonPropertyName("t")]
		public required long AsOf { get; set; }
	}
}
