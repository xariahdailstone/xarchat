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
using XarChat.Backend.Features.EIconLoader;
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
            [FromServices] IEIconLoader eiconLoader,
            CancellationToken cancellationToken)
        {
            var requestStartedAt = (DateTimeOffset)httpContext.Items["RequestStartAt"]!;
            var r = await eiconLoader.GetEIconAsync(name, requestStartedAt, cancellationToken);

            var contentType = "text/plain";
            foreach (var kvp in r.Headers ?? [])
            {
                if (String.Equals(kvp.Key, "content-type", StringComparison.OrdinalIgnoreCase))
                {
                    contentType = kvp.Value;
                }
                else
                {
                    httpContext.Response.Headers.Append(kvp.Key, kvp.Value);
                }
            }

            return Results.Stream(r.Content ?? new MemoryStream(), contentType);
        }
    }
}
