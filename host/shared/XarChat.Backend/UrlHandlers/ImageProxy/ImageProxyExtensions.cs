using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace XarChat.Backend.UrlHandlers.ImageProxy
{
    internal static class ImageProxyExtensions
    {
        class LoggerInstance { }

        public static void UseImageProxyHandler(this WebApplication app, string urlBase)
        {
            app.MapGet(urlBase, ProxyImageUrlAsync);
        }

        private static async Task<IResult> ProxyImageUrlAsync(
            [FromQuery] string url,
            [FromQuery] string loadAs,
            [FromServices] IProxiedImageCache2 proxiedImageCache2,
            [FromServices] ILogger<ImageProxyExtensions.LoggerInstance> logger,
            CancellationToken cancellationToken)
        {
            var findResult = await proxiedImageCache2.GetOrCreateAsync(
                cacheKey: url,
				cancellationToken: cancellationToken,
                createFuncAsync: async () => 
                {
                    try
                    {
                        logger.LogInformation($"Proxied image cache miss: {url}");
                        var (stream, headers) = await ProxyImageUrlInternalAsync(url, loadAs, CancellationToken.None);
                        return (headers, stream, TimeSpan.FromSeconds(30));
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
                var errRes = new ContentResult();
                errRes.StatusCode = 500;
                errRes.ContentType = "text/plain";
                errRes.Content = await new StreamReader(findResult.Stream).ReadToEndAsync();
                return new ActionResultResult(errRes);
            }
            if (findResult.Headers.TryGetValue("Not-Found", out var nf) && nf == "true")
            {
                findResult.Stream.Dispose();
                return Results.NotFound();
            }

            return Results.Stream(findResult.Stream, findResult.Headers["Content-Type"]);
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

        private static async Task<(Stream stream, Dictionary<string, string> headers)> ProxyImageUrlInternalAsync(
            string url, string loadAs, CancellationToken cancellationToken)
        { 
            var uri = new Uri(url);

            var hc = new HttpClient(new HttpClientHandler()
            {
                AutomaticDecompression = System.Net.DecompressionMethods.All
            });
            var req = new HttpRequestMessage(HttpMethod.Get, url);
            req.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36");
            req.Headers.Add("Sec-Ch-Ua", "\"Not/A)Brand\";v=\"99\", \"Google Chrome\";v=\"115\", \"Chromium\";v=\"115\"");
            req.Headers.Add("Sec-Ch-Ua-Mobile", "?0");
            req.Headers.Add("Sec-Ch-Ua-Platform", "\"Windows\"");

            if (loadAs == "document")
            {
                req.Headers.Add("Sec-Fetch-Dest", "document");
                req.Headers.Add("Sec-Fetch-Mode", "navigate");
                req.Headers.Add("Sec-Fetch-Site", "same-origin");
                req.Headers.Add("Sec-Fetch-User", "?1");
                req.Headers.Add("Referer", url.ToString());
            }
            else if (loadAs == "ssimage")
            {
                req.Headers.Add("Accept", "image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8");
                req.Headers.Add("Accept-Encoding", "gzip, deflate, br");
                req.Headers.Add("Accept-Language", "en-US,en;q=0.9");
                req.Headers.Add("Cache-Control", "no-cache");
                req.Headers.Add("Dnt", "1");
                req.Headers.Add("Pragma", "no-cache");
                req.Headers.Add("Sec-Fetch-Dest", "image");
                req.Headers.Add("Sec-Fetch-Mode", "no-cors");
                req.Headers.Add("Sec-Fetch-Site", "same-site");
                req.Headers.Add("Referer", uri.Scheme + "://" + uri.Host + "/");
            }
            else
            {
                req.Headers.Add("Referer", url.ToString());
            }
            HttpResponseMessage resp;
            try
            {
                resp = await hc.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, CancellationToken.None);
            }
            catch (Exception e)
            {
                var ms = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(e.ToString()));
                return (ms, new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    { "Failed", "true" }
                });
            }
            if (!resp.IsSuccessStatusCode)
            {
                var ms = new MemoryStream(new byte[0]);
                return (ms, new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    { "Not-Found", "true" }
                });
            }
            else
            {
                var stream = await resp.Content.ReadAsStreamAsync(cancellationToken);
                return (stream, new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    { "Content-Type", resp.Content.Headers.ContentType!.ToString() }
                });
            }
        }
    }
}
