using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Net;
using System.Text;
using System.Threading.Tasks;
using System.Web;
using XarChat.Backend.Features.EIconUpdateSubmitter;
using XarChat.Backend.UrlHandlers.ImageProxy;

namespace XarChat.Backend.UrlHandlers.EIconLoader
{
    internal static class EIconLoaderManager
    {
        internal class EIconLoaderManagerIdentity { }

        private static readonly HttpClient _httpClient = new HttpClient(new SocketsHttpHandler()
        {
            AutomaticDecompression = System.Net.DecompressionMethods.All,
            MaxConnectionsPerServer = 80,
            PooledConnectionIdleTimeout = TimeSpan.FromSeconds(60),
            PooledConnectionLifetime = TimeSpan.FromMinutes(10),
            EnableMultipleHttp2Connections = true,
            InitialHttp2StreamWindowSize = 5 * 1024 * 1024,
        });

        private static readonly NamedLockSet _nls = new NamedLockSet();

        public static void UseEIconLoader(this WebApplication app, string urlBase)
        {
            app.MapGet(urlBase.TrimEnd('/') + "/{name}", ProxyEIconLoadAsync);
        }

        private static async Task<IResult> ProxyEIconLoadAsync(
            [FromRoute(Name = "name")] string name,
            HttpContext httpContext,
            [FromServices] IProxiedImageCache2 proxiedImageCache2,
            [FromServices] ILogger<EIconLoaderManagerIdentity> logger,
            [FromServices] IDataUpdateSubmitter eIconUpdateSubmitter,
            [FromServices] IHostApplicationLifetime hostApplicationLifetime,
            CancellationToken cancellationToken)
        {
            try
            {
                var requestHandlerStartedAt = DateTimeOffset.UtcNow;

                name = name.ToLowerInvariant();
                var url = $"https://static.f-list.net/images/eicon/{HttpUtility.UrlEncode(name)}.gif";
                url = url.Replace("+", "%20");

                var findResult = await proxiedImageCache2.GetOrCreateAsync(
                    cacheKey: url,
                    cancellationToken: cancellationToken,
                    createFuncAsync: async () =>
                    {
                        try
                        {
                            logger.LogInformation("EIcon not found in cache: {name}", name);

                            var sw = Stopwatch.StartNew();
                            var (stream, headers) = await GetEIconFromFListAsync(url, requestHandlerStartedAt,
                                (DateTimeOffset)httpContext.Items["RequestStartAt"]!,
                                cancellationToken);
                            sw.Stop();
                            logger.LogInformation("Got uncached EIcon response {name}: {time}ms", name, sw.ElapsedMilliseconds);

                            if (headers.TryGetValue("ETag", out var etagHeader) &&
                                headers.TryGetValue("Content-Length", out var contentLengthHeader) &&
                                Int64.TryParse(contentLengthHeader, out var contentLengthLong))
                            {
                                _ = Task.Run(async () =>
                                {
                                    await eIconUpdateSubmitter.SubmitHardLoadedEIconInfoAsync(
                                        name, etagHeader, contentLengthLong, hostApplicationLifetime.ApplicationStopping);
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
                                logger.LogInformation("Uncached EIcon stream read {name}: {time}ms", name, popSW.ElapsedMilliseconds);
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
                    return Results.Content(
                        content: await new StreamReader(findResult.Stream).ReadToEndAsync(),
                        contentType: "text/plain",
                        statusCode: 500);

                }
                if (findResult.Headers.TryGetValue("Not-Found", out var nf) && nf == "true")
                {
                    findResult.Stream.Dispose();
                    return Results.NotFound();
                }

                void includeHeader(string headerName)
                {
                    if (findResult.Headers.TryGetValue(headerName, out var hdrValue))
                    {
                        httpContext.Response.Headers[headerName] = hdrValue;
                    }
                }

                //includeHeader("Date");
                httpContext.Response.Headers["Date"] = DateTime.UtcNow.ToString("R");
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
                    logger.LogInformation("Stream transmission took {time}ms", streamSW.ElapsedMilliseconds);
                });
                return Results.Stream(respStream, findResult.Headers["Content-Type"]);
            }
            catch when (cancellationToken.IsCancellationRequested)
            {
                return Results.Empty;
            }
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

        private class ActionResultResult : IResult
        {
            private readonly IActionResult _actionResult;

            public ActionResultResult(IActionResult actionResult)
            {
                _actionResult = actionResult;
            }

            public async Task ExecuteAsync(HttpContext httpContext)
            {
                await _actionResult.ExecuteResultAsync(new ActionContext()
                {
                    HttpContext = httpContext
                });
            }
        }
    }
}
