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
            HttpContext httpContext,
            [FromRoute(Name = "name")] string name,
            [FromServices] IEIconLoader eiconLoader,
            CancellationToken cancellationToken)
        {
            try
            {
                var resp = await eiconLoader.ProxyEIconLoadAsync(name, cancellationToken);
                foreach (var hdr in resp.Headers)
                {
                    httpContext.Response.Headers.Append(hdr.Key, hdr.Value);
                }
                return new StreamContentTypeResult(
                    stream: resp.Stream,
                    statusCode: resp.StatusCode,
                    contentType: resp.ContentType);
            }
            catch when (cancellationToken.IsCancellationRequested)
            {
                return Results.Empty;
            }
        }

        private class StreamContentTypeResult : IResult
        {
            public StreamContentTypeResult(Stream stream, int statusCode, string contentType)
            {
                this.Stream = stream;
                this.StatusCode = statusCode;
                this.ContentType = contentType;
            }

            public Stream Stream { get; }

            public int StatusCode { get; }

            public string ContentType { get; }

            public async Task ExecuteAsync(HttpContext httpContext)
            {
                try
                {
                    httpContext.Response.ContentType = this.ContentType;
                    httpContext.Response.StatusCode = this.StatusCode;
                    await this.Stream.CopyToAsync(httpContext.Response.Body, httpContext.RequestAborted);
                }
                finally
                {
                    this.Stream.Dispose();
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
