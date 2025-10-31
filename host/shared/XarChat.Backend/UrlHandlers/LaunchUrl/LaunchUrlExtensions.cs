using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Web;
using XarChat.Backend.Common;
using XarChat.Backend.Features.AppConfiguration;
using XarChat.Backend.Network;

namespace XarChat.Backend.UrlHandlers.LaunchUrl
{
    internal static class LaunchUrlExtensions
    {
        public static void UseLaunchUrlHandler(this WebApplication app, string urlBase)
        {
            app.MapGet("/api/launchUrl", LaunchUrlAsync);
        }

        private static readonly Regex ProcessLaunchPattern = new Regex(
            @"^(?<arglist>\s*(?<arg>(""(\\""|[^""])*"")|(\S+))\s*)+$", RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.ExplicitCapture);

        private static async Task<IResult> LaunchUrlAsync(
            [FromQuery] string url,
            [FromQuery] bool? forceExternal,
            [FromServices] IAppConfiguration appConfiguration,
            [FromServices] IHttpClientProvider httpClientProvider,
            CancellationToken cancellationToken)
        {
            if (!url.StartsWith("http:") && !url.StartsWith("https:"))
            {
                return Results.Ok();
            }

            if (!(forceExternal ?? false) && appConfiguration.LaunchImagesInternally && await IsImageUrlAsync(url, httpClientProvider, TimeSpan.FromSeconds(1), cancellationToken))
            {
                var iurl = new Uri(url);
                var iurlpath = iurl.LocalPath;
                var lastPathPart = iurlpath.Replace("\\", "/").Split("/").Last();
                var targetUrl = $"/api/proxyImageUrl/{HttpUtility.UrlEncode(lastPathPart)}?url={HttpUtility.UrlEncode(url)}&loadAs=ssimage";
                return CustomResults.NewtonsoftJsonResult(new JsonObject() 
                {
                    { "loadInternally", true },
                    { "url", targetUrl }
                }, SourceGenerationContext.Default.JsonObject);
            }
            else
            {
                await LaunchUrlExternallyAsync(url, appConfiguration, cancellationToken);
            }

            return Results.Ok();
        }

        private static async Task LaunchUrlExternallyAsync(
            string url,
            IAppConfiguration appConfiguration,
            CancellationToken cancellationToken)
        {
            var urlLaunchExecutable = appConfiguration.UrlLaunchExecutable;

            if (String.Equals("shell:", urlLaunchExecutable, StringComparison.OrdinalIgnoreCase))
            {
                var psi = new ProcessStartInfo(url);
                psi.UseShellExecute = true;
                psi.FileName = url;
                Process.Start(psi);
            }
            else
            {
                var m = ProcessLaunchPattern.Match(urlLaunchExecutable);

                string StripQuotes(string raw)
                {
                    if (raw != null && raw.StartsWith("\"") && raw.EndsWith("\""))
                    {
                        return raw.Substring(1, raw.Length - 2);
                    }
                    else
                    {
                        return raw;
                    }
                }

                var args = m.Groups["arg"].Captures
                    .Cast<Capture>()
                    .Select(c => StripQuotes(c.Value).Replace("\\\"", "\"")).ToList();

                var uri = new Uri(url);

                var psi = new ProcessStartInfo();
                psi.UseShellExecute = false;
                psi.FileName = args[0];
                foreach (var v in args.Skip(1))
                {
                    if (v.Contains("%s"))
                    {
                        psi.ArgumentList.Add(v.Replace("%s", url));
                    }
                    else
                    {
                        psi.ArgumentList.Add(v);
                    }
                }

                Process.Start(psi);
            }
        }

        private static async Task<bool> IsImageUrlAsync(string url, IHttpClientProvider httpClientProvider, TimeSpan timeout, CancellationToken cancellationToken)
        {
            var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(timeout);
            try
            {
                using var hc = httpClientProvider.GetHttpClient(HttpClientType.InlineImageLoad);
                var req = new HttpRequestMessage(HttpMethod.Head, url);
                using var resp = await hc.SendAsync(req, cts.Token);
                if (resp.Content.Headers.ContentType?.MediaType?.StartsWith("image/") ?? false)
                {
                    return true;
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine(ex);
            }

            return false;
        }

        //private static async Task<bool> CanLoadUrlInternallyAsync(
        //    string url,
        //    IAppConfiguration appConfiguration,
        //    CancellationToken cancellationToken)
        //{

        //}
    }
}
