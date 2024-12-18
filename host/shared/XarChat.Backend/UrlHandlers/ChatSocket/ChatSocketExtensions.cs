using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Hosting;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using XarChat.Backend.Common;
using XarChat.Backend.Features.AppConfiguration;
using XarChat.Backend.Features.FListApi;

namespace XarChat.Backend.UrlHandlers.ChatSocket
{
    internal static class ChatSocketExtensions
    {
        public static void UseChatSocketProxy(this WebApplication app, string urlBase)
        {
            app.Map(urlBase, ChatSocketAsyncNew);
        }

        private static async Task<IResult> ChatSocketAsyncNew(
            HttpContext context,
            [FromServices] IFListApi flistApi,
            [FromServices] IAppConfiguration appConfiguration,
            [FromServices] IHostApplicationLifetime hostApplicationLifetime,
            [FromServices] IFalsifiedClientTicketManager fctm,
            CancellationToken cancellationToken)
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(
                cancellationToken, hostApplicationLifetime.ApplicationStopping);
            cancellationToken = cts.Token;

            try
            {
                if (context.WebSockets.IsWebSocketRequest)
                {
                    using var clientWebSocket = await context.WebSockets.AcceptWebSocketAsync();
                    try
                    {
                        using var connectionCTS = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);

                        // Get IDN from client
                        var idnMsg = await ReadTextMessageAsync(clientWebSocket, 1024, cancellationToken);
                        if (!idnMsg.StartsWith("IDN "))
                        {
                            throw new ApplicationException("Expected IDN message");
                        }
                        var body = JsonSerializer.Deserialize<JsonObject>(idnMsg.Substring(4),
                            SourceGenerationContext.Default.JsonObject);
                        if (body is null) { throw new ApplicationException("body is null"); }
                        var method = body["method"]?.ToString() ?? throw new ApplicationException("method expected");
                        if (method != "ticket") { throw new ApplicationException("method not 'ticket'"); }
                        var account = body["account"]?.ToString() ?? throw new ApplicationException("account expected");
                        var character = body["character"]?.ToString() ?? throw new ApplicationException("character expected");
                        var ticket = body["ticket"]?.ToString() ?? throw new ApplicationException("ticket expected");
                        if (!fctm.TryVerifyFalsifiedClientTicket(account, ticket)) { throw new ApplicationException("invalid ticket"); }
                        var cname = body["cname"]?.ToString() ?? throw new ApplicationException("cname expected");
                        var cversion = body["cversion"]?.ToString() ?? throw new ApplicationException("cversion expected");

                        var (maybeFChatWebSocket, initialMessage) = await GetIdentifiedChatWebSocketAsync(
                            flistApi, appConfiguration,
                            method, account, character, cname, cversion, cancellationToken);

                        await clientWebSocket.SendAsync(System.Text.Encoding.UTF8.GetBytes(initialMessage),
                            WebSocketMessageType.Text, true, cancellationToken);

                        if (maybeFChatWebSocket is not null)
                        {
                            using var fchatWebSocket = maybeFChatWebSocket;

                            var stcLoop = SocketToSocketLoop(fchatWebSocket, clientWebSocket, connectionCTS.Token);
                            var ctsLoop = SocketToSocketLoop(clientWebSocket, fchatWebSocket, connectionCTS.Token);

                            await Task.WhenAny(stcLoop, ctsLoop);

                            connectionCTS.Cancel();

                            await Task.WhenAll(stcLoop, ctsLoop);
                        }
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

        private static async Task<(ClientWebSocket?, string)> GetIdentifiedChatWebSocketAsync(
            IFListApi fListApi, IAppConfiguration appConfiguration,
            string method, string account, string character, string cname, string cversion,
            CancellationToken cancellationToken)
        {
            try
            {
                var authApi = await fListApi.GetAlreadyAuthenticatedFListApiAsync(account, cancellationToken);
                var gatResp = await authApi.GetApiTicketAsync(cancellationToken);
                var canRetry = true;
                while (gatResp.CameFromCache && canRetry)
                {
                    var fchatWebSocket = new ClientWebSocket();
                    var fchatWebSocketReturned = false;
                    try
                    {
                        await fchatWebSocket.ConnectAsync(new Uri(appConfiguration.WebSocketPath), cancellationToken);

                        var jobj = new JsonObject();
                        jobj.Add("method", "ticket");
                        jobj.Add("account", account);
                        jobj.Add("character", character);
                        jobj.Add("ticket", gatResp.Value.Ticket);
                        jobj.Add("cname", cname);
                        jobj.Add("cversion", cversion);
                        var idnToSend = "IDN " + JsonSerializer.Serialize(jobj,
                                SourceGenerationContextUnindented.Default.JsonObject);
                        await fchatWebSocket.SendAsync(
                            System.Text.Encoding.UTF8.GetBytes(idnToSend),
                            WebSocketMessageType.Text,
                            true, cancellationToken);

                        // Get IDN response
                        var idnRespMsg = await ReadTextMessageAsync(fchatWebSocket, 1024, cancellationToken);
                        if (idnRespMsg.StartsWith("IDN "))
                        {
                            // Success!
                            fchatWebSocketReturned = true;
                            return (fchatWebSocket, idnRespMsg);
                        }
                        else if (gatResp.CameFromCache && canRetry)
                        {
                            // Failure, but we can retry
                            await authApi.InvalidateApiTicketAsync(gatResp.Value.Ticket, cancellationToken);
                            gatResp = await authApi.GetApiTicketAsync(cancellationToken);
                            canRetry = false;
                        }
                        else
                        {
                            // Failure, retry not possible
                            return (null, idnRespMsg);
                        }
                    }
                    finally
                    {
                        if (!fchatWebSocketReturned)
                        {
                            fchatWebSocket.Dispose();
                        }
                    }
                }

                var ejobj = new JsonObject();
                ejobj.Add("message", $"XarChat was unable to connect to F-Chat.");
                return (null, "ERR " + JsonSerializer.Serialize(ejobj, SourceGenerationContextUnindented.Default.JsonObject));
            }
            catch (Exception ex)
            {
                var ejobj = new JsonObject();
                ejobj.Add("message", $"XarChat was unable to connect to F-Chat: {ex.Message}");
                return (null, "ERR " + JsonSerializer.Serialize(ejobj, SourceGenerationContextUnindented.Default.JsonObject));
            }
        }

        private static async Task<string> ReadTextMessageAsync(
            WebSocket clientWebSocket, int maxLengthBytes, CancellationToken cancellationToken)
        {
            var rbytes = 0;
            var buf = new byte[maxLengthBytes];
            while (true)
            {
                if (rbytes >= buf.Length)
                {
                    throw new ApplicationException("Message too large");
                }
                var rmsg = await clientWebSocket.ReceiveAsync(new ArraySegment<byte>(buf, rbytes, buf.Length - rbytes), cancellationToken);
                switch (rmsg.MessageType)
                {
                    default:
                    case WebSocketMessageType.Binary:
                        throw new ApplicationException("Unexpected binary message received");
                    case WebSocketMessageType.Close:
                        throw new ApplicationException("Connection closed");
                    case WebSocketMessageType.Text:
                        rbytes += rmsg.Count;
                        if (rmsg.EndOfMessage)
                        {
                            return System.Text.Encoding.UTF8.GetString(buf, 0, rbytes);
                        }
                        break;
                }
            }
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
