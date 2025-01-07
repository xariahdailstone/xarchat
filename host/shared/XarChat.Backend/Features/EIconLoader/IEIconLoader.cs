using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Net.Http.Headers;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using System.Web;
using XarChat.Backend.Features.EIconUpdateSubmitter;
using XarChat.Backend.UrlHandlers.ImageProxy;
using static XarChat.Backend.UrlHandlers.EIconLoader.EIconLoaderManager;

namespace XarChat.Backend.Features.EIconLoader
{
    internal interface IEIconLoader
    {
        Task<EIconLoadResponse> ProxyEIconLoadAsync(
            string name, 
            CancellationToken cancellationToken);
    }

    internal record EIconLoadResponse(
        int StatusCode,
        string ContentType,
        Stream Stream, 
        List<KeyValuePair<string, string>> Headers);

    internal class EIconLoaderImpl : IEIconLoader
    {
        private readonly IProxiedImageCache2 _proxiedImageCache2;
        private readonly ILogger<EIconLoaderImpl> _logger;
        private readonly IDataUpdateSubmitter _eIconUpdateSubmitter;
        private readonly IHostApplicationLifetime _hostApplicationLifetime;

        private static readonly HttpClient _httpClient = new HttpClient(new SocketsHttpHandler()
        {
            AutomaticDecompression = System.Net.DecompressionMethods.All,
            MaxConnectionsPerServer = 80,
            PooledConnectionIdleTimeout = TimeSpan.FromSeconds(60),
            PooledConnectionLifetime = TimeSpan.FromMinutes(10),
            EnableMultipleHttp2Connections = true,
            InitialHttp2StreamWindowSize = 5 * 1024 * 1024,
        });

        public EIconLoaderImpl(
            IProxiedImageCache2 proxiedImageCache2,
            ILogger<EIconLoaderImpl> logger,
            IDataUpdateSubmitter eIconUpdateSubmitter,
            IHostApplicationLifetime hostApplicationLifetime)
        {
            _proxiedImageCache2 = proxiedImageCache2;
            _logger = logger;
            _eIconUpdateSubmitter = eIconUpdateSubmitter;
            _hostApplicationLifetime = hostApplicationLifetime;
        }

        public async Task<EIconLoadResponse> ProxyEIconLoadAsync(
            string name,
            CancellationToken cancellationToken)
        {
            var requestHandlerStartedAt = DateTimeOffset.UtcNow;

            name = name.ToLowerInvariant();
            var url = $"https://static.f-list.net/images/eicon/{HttpUtility.UrlEncode(name)}.gif";
            url = url.Replace("+", "%20");

            var findResult = await _proxiedImageCache2.GetOrCreateAsync(
                cacheKey: url,
                cancellationToken: cancellationToken,
                createFuncAsync: async () =>
                {
                    try
                    {
                        _logger.LogInformation("EIcon not found in cache: {name}", name);

                        var sw = Stopwatch.StartNew();
                        var (stream, headers) = await GetEIconFromFListAsync(url, requestHandlerStartedAt,
                            DateTimeOffset.UtcNow,
                            cancellationToken);
                        sw.Stop();
                        _logger.LogInformation("Got uncached EIcon response {name}: {time}ms", name, sw.ElapsedMilliseconds);

                        if (headers.TryGetValue("ETag", out var etagHeader) &&
                            headers.TryGetValue("Content-Length", out var contentLengthHeader) &&
                            Int64.TryParse(contentLengthHeader, out var contentLengthLong))
                        {
                            _ = Task.Run(async () =>
                            {
                                await _eIconUpdateSubmitter.SubmitHardLoadedEIconInfoAsync(
                                    name, etagHeader, contentLengthLong, _hostApplicationLifetime.ApplicationStopping);
                            });
                        }

                        var expiresAt = DateTime.UtcNow + TimeSpan.FromMinutes(15);
                        // TODO: get expiration from headers?
                        //if (headers.TryGetValue("Expires", out var hdrExpires))
                        //{
                        //    DateTime.TryParseExact(hdrExpires, "R", null, System.Globalization.DateTimeStyles.AssumeUniversal, out expiresAt);
                        //}

                        var expiresIn = expiresAt - DateTime.UtcNow;
                        if (expiresIn < TimeSpan.FromSeconds(30))
                        {
                            expiresIn = TimeSpan.FromSeconds(30);
                        }

                        var popSW = Stopwatch.StartNew();
                        var popStream = new DisposeWrappedStream(stream, () =>
                        {
                            popSW.Stop();
                            _logger.LogInformation("Uncached EIcon stream read {name}: {time}ms", name, popSW.ElapsedMilliseconds);
                        });

                        return (headers, popStream, expiresIn);
                    }
                    catch (Exception ex)
                    {
                        var ms = new MemoryStream();
                        ms.Write(System.Text.Encoding.UTF8.GetBytes(ex.ToString()));
                        ms.Position = 0;

                        return (new Dictionary<string, string>()
                            {
                            { "Failed", "true" }
                            }, ms, TimeSpan.FromSeconds(30));
                    }
                });

            if (findResult.Headers.TryGetValue("Failed", out var znf) && znf == "true")
            {
                //var errRes = new ContentResult();
                //errRes.StatusCode = 500;
                //errRes.ContentType = "text/plain";
                //errRes.Content = await new StreamReader(findResult.Stream).ReadToEndAsync();
                //return new ActionResultResult(errRes);
                return new EIconLoadResponse(
                    StatusCode: 500,
                    ContentType: "text/plain",
                    Stream: findResult.Stream,
                    Headers: new List<KeyValuePair<string, string>>());
                //return Results.Content(
                //    content: await new StreamReader(findResult.Stream).ReadToEndAsync(),
                //    contentType: "text/plain",
                //    statusCode: 500);

            }
            if (findResult.Headers.TryGetValue("Not-Found", out var nf) && nf == "true")
            {
                findResult.Stream.Dispose();
                return new EIconLoadResponse(
                    StatusCode: 404,
                    ContentType: "text/plain",
                    Stream: new MemoryStream(),
                    Headers: new List<KeyValuePair<string, string>>());
                //return Results.NotFound();
            }

            var resultHeaders = new List<KeyValuePair<string, string>>();

            void includeHeader(string headerName)
            {
                if (findResult.Headers.TryGetValue(headerName, out var hdrValue))
                {
                    resultHeaders.Add(new(headerName, hdrValue));
                    //httpContext.Response.Headers[headerName] = hdrValue;
                }
            }

            //includeHeader("Date");
            resultHeaders.Add(new("Date", DateTime.UtcNow.ToString("R")));
            //httpContext.Response.Headers["Date"] = DateTime.UtcNow.ToString("R");
            includeHeader("Last-Modified");
            includeHeader("ETag");
            includeHeader("Cache-Control");
            includeHeader("X-Backend-Request-ID");
            includeHeader("X-Backend-Request-Duration");
            includeHeader("X-Backend-Request-Timestamp");
            includeHeader("X-Backend-Request-Handler-StartTimestamp");
            includeHeader("X-Backend-Request-Pipeline-StartTimestamp");
            includeHeader("Expires");

            var streamSW = Stopwatch.StartNew();
            var respStream = new DisposeWrappedStream(findResult.Stream, () =>
            {
                streamSW.Stop();
                _logger.LogInformation("Stream transmission took {time}ms", streamSW.ElapsedMilliseconds);
            });
            return new EIconLoadResponse(
                StatusCode: 200,
                ContentType: findResult.Headers["Content-Type"],
                Stream: respStream,
                Headers: resultHeaders);
            //return Results.Stream(respStream, findResult.Headers["Content-Type"]);
        }

        private static int _nextBackendRequestId = 1;
        private static async Task<(Stream Stream, Dictionary<string, string> Headers)> GetEIconFromFListAsync(
            string url, DateTimeOffset requestHandlerStartedAt, DateTimeOffset requestPipelineStartedAt, CancellationToken cancellationToken)
        {
            var myBackendRequestId = Interlocked.Increment(ref _nextBackendRequestId);
            var uri = new Uri(url);

            var hc = _httpClient;

            var req = new HttpRequestMessage(HttpMethod.Get, url);
            req.Version = HttpVersion.Version30;
            req.VersionPolicy = HttpVersionPolicy.RequestVersionOrLower;
            req.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36");
            req.Headers.Add("Sec-Ch-Ua", "\"Not/A)Brand\";v=\"99\", \"Google Chrome\";v=\"115\", \"Chromium\";v=\"115\"");
            req.Headers.Add("Sec-Ch-Ua-Mobile", "?0");
            req.Headers.Add("Sec-Ch-Ua-Platform", "\"Windows\"");
            req.Headers.Add("Accept", "image/*,*/*;q=0.8");
            req.Headers.Add("Accept-Encoding", "gzip, deflate, br");
            req.Headers.Add("Accept-Language", "en-US,en;q=0.9");
            req.Headers.Add("Cache-Control", "no-cache");
            req.Headers.Add("Dnt", "1");
            req.Headers.Add("Pragma", "no-cache");
            req.Headers.Add("Sec-Fetch-Dest", "image");
            req.Headers.Add("Sec-Fetch-Mode", "no-cors");
            req.Headers.Add("Sec-Fetch-Site", "same-site");
            req.Headers.Add("Referer", uri.Scheme + "://" + uri.Host + "/");

            HttpResponseMessage? resp = null;
            var requestStartedAt = DateTime.UtcNow;
            var requestDuration = Stopwatch.StartNew();
            try
            {
                try
                {
                    resp = await hc.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, CancellationToken.None);
                    var usedVersion = resp.Version;
                }
                catch (Exception e)
                {
                    requestDuration.Stop();
                    var ms = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(e.ToString()));
                    return (ms, new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                    {
                        { "Failed", "true" }
                    });
                }
                if (!resp.IsSuccessStatusCode)
                {
                    requestDuration.Stop();
                    var ms = new MemoryStream(new byte[0]);
                    return (ms, new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                    {
                        { "Not-Found", "true" }
                    });
                }
                else
                {
                    using var stream = await resp.Content.ReadAsStreamAsync(cancellationToken);
                    var ms = new MemoryStream();
                    await stream.CopyToAsync(ms, cancellationToken);
                    ms.Seek(0, SeekOrigin.Begin);
                    requestDuration.Stop();
                    var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                    {
                        { "Content-Type", resp.Content.Headers.ContentType!.ToString() }
                    };
                    foreach (var hdr in resp.Headers)
                    {
                        headers[hdr.Key] = hdr.Value.First();
                    }
                    foreach (var hdr in resp.Content.Headers)
                    {
                        headers[hdr.Key] = hdr.Value.First();
                    }
                    headers["X-Backend-Request-ID"] = myBackendRequestId.ToString();
                    headers["X-Backend-Request-Duration"] = requestDuration.ElapsedMilliseconds.ToString();
                    headers["X-Backend-Request-Timestamp"] = new DateTimeOffset(requestStartedAt, TimeSpan.Zero).ToString("R");
                    headers["X-Backend-Request-Handler-StartTimestamp"] = requestHandlerStartedAt.ToString("R");
                    headers["X-Backend-Request-Pipeline-StartTimestamp"] = requestPipelineStartedAt.ToString("R");

                    return (ms, headers);
                }
            }
            finally
            {
                if (resp != null)
                {
                    resp.Dispose();
                }
            }
        }
    }
}
