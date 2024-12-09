using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Hosting;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.WebSockets;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Features.AppConfiguration;

namespace XarChat.Backend.UrlHandlers.ChatSocket
{
    internal static class ChatSocketExtensions
    {
        public static void UseChatSocketProxy(this WebApplication app, string urlBase)
        {
            app.Map(urlBase, ChatSocketAsync);
        }

        private static async Task<IResult> ChatSocketAsync(
            HttpContext context,
            [FromServices] IAppConfiguration appConfiguration,
            [FromServices] IHostApplicationLifetime hostApplicationLifetime,
            CancellationToken cancellationToken)
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(
                cancellationToken, hostApplicationLifetime.ApplicationStopping);
            cancellationToken = cts.Token;

            try
            {
                if (context.WebSockets.IsWebSocketRequest)
                {
                    using var fchatWebSocket = new ClientWebSocket();
                    await fchatWebSocket.ConnectAsync(new Uri(appConfiguration.WebSocketPath), cancellationToken);

                    using var clientWebSocket = await context.WebSockets.AcceptWebSocketAsync();
                    try
                    {
                        using var connectionCTS = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);

                        var stcLoop = SocketToSocketLoop(fchatWebSocket, clientWebSocket, connectionCTS.Token);
                        var ctsLoop = SocketToSocketLoop(clientWebSocket, fchatWebSocket, connectionCTS.Token);

                        await Task.WhenAny(stcLoop, ctsLoop);

                        connectionCTS.Cancel();

                        await Task.WhenAll(stcLoop, ctsLoop);
                    }
                    catch
                    {
                    }

                    return EmptyHttpResult.Instance;
                }
                else
                {
                    return Results.BadRequest();
                }
            }
            catch
            {
                return Results.StatusCode(500);
            }
        }

        private static async Task SocketToSocketLoop(WebSocket inSocket, WebSocket outSocket, CancellationToken cancellationToken)
        {
            var buf = new byte[4096];
            while (true)
            {
                var recvResult = await inSocket.ReceiveAsync(buf, cancellationToken);
                await outSocket.SendAsync(new ArraySegment<byte>(buf, 0, recvResult.Count), recvResult.MessageType,
                    recvResult.EndOfMessage, cancellationToken);

                if (recvResult.MessageType == WebSocketMessageType.Close && recvResult.EndOfMessage == true)
                {
                    return;
                }
            }
        }
    }

    public sealed class EmptyHttpResult : IResult
    {
        private EmptyHttpResult()
        {
        }

        /// <summary>
        /// Gets an instance of <see cref="EmptyHttpResult"/>.
        /// </summary>
        public static EmptyHttpResult Instance { get; } = new();

        /// <inheritdoc/>
        public Task ExecuteAsync(HttpContext httpContext)
        {
            ArgumentNullException.ThrowIfNull(httpContext);

            return Task.CompletedTask;
        }
    }
}
