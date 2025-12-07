using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SQLitePCL;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using XarChat.Backend.Bridge1to2;
using XarChat.Backend.Bridge1to2.Messages.Client;
using XarChat.Backend.Bridge1to2.Messages.Server;
using XarChat.Backend.Common;
using XarChat.Backend.Features.AppConfiguration;
using XarChat.Backend.Features.FListApi;

namespace XarChat.Backend.UrlHandlers.ChatSocket
{
    internal class ChatSocketExtensionsClass { }

    internal static class ChatSocketExtensions
    {
        public static void UseChatSocketProxy(this WebApplication app, string urlBase)
        {
            //app.Map(urlBase, ChatSocketAsyncNew);
            app.Map(urlBase, ChatSocketFL2Async);
        }

        private static async Task<IResult> ChatSocketFL2Async(
            HttpContext context,
            [FromServices] IBridge1to2Manager bridge1to2Manager,
            [FromServices] IFChatMessageSerializer<FChatServerMessage> srvMsgSerializer,
            [FromServices] IFChatMessageDeserializer<FChatClientMessage> cliMsgDeserializer,
            [FromServices] IFListApi flistApi,
            [FromServices] IAppConfiguration appConfiguration,
            [FromServices] IHostApplicationLifetime hostApplicationLifetime,
            [FromServices] ILogger<ChatSocketExtensionsClass> logger,
            CancellationToken cancellationToken)
        {
            Guid connectionGuid = Guid.NewGuid();
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(
                cancellationToken, hostApplicationLifetime.ApplicationStopping);
            cancellationToken = cts.Token;

            try
            {
                if (context.WebSockets.IsWebSocketRequest)
                {
                    try
                    {
                        using var clientWebSocket = await context.WebSockets.AcceptWebSocketAsync();
                        try
                        {
                            logger.LogInformation("Chat proxy connection from UI opened (guid={guid})", connectionGuid);

                            using var connectionCTS = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);

                            await using var bridgeConn = await bridge1to2Manager.CreateConnectionAsync(cancellationToken);
                            var outgoingLoopTask = bridgeConn.RunOutgoingMessageLoopAsync(async (msg, cancellationToken) =>
                            {
                                try
                                {
                                    var serMsg = srvMsgSerializer.Serialize(msg);
                                    await clientWebSocket.SendAsync(System.Text.Encoding.UTF8.GetBytes(serMsg),
                                        WebSocketMessageType.Text, true, cancellationToken);
                                }
                                catch (Exception ex)
                                {
                                    Console.WriteLine(ex.ToString());
                                    throw;
                                }
                            }, connectionCTS.Token);
                            var incomingLoopTask = Task.Run(async () =>
                            {
                                var cancellationToken = connectionCTS.Token;
                                try
                                {
                                    while (!cancellationToken.IsCancellationRequested)
                                    {
                                        var buf = new byte[65536];
                                        var recvResult = await clientWebSocket.ReceiveAsync(buf, cancellationToken);
                                        var bufStr = System.Text.Encoding.UTF8.GetString(buf, 0, recvResult.Count);
                                        var cliMsg = cliMsgDeserializer.Deserialize(bufStr);
                                        await bridgeConn.IngestIncomingMessageAsync(cliMsg, cancellationToken);
                                    }
                                }
                                catch when (cancellationToken.IsCancellationRequested) { }
                            });

                            await Task.WhenAny(outgoingLoopTask, incomingLoopTask);
                            connectionCTS.Cancel();
                            await Task.WhenAll(outgoingLoopTask, incomingLoopTask);
                        }
                        catch when (cancellationToken.IsCancellationRequested) { }
                        catch (Exception ex)
                        {
                            logger.LogError(ex, "Error during chat proxy connection (guid={guid}, msg={msg}", connectionGuid, ex.Message);
                        }

                        logger.LogInformation("Chat proxy connection closed (guid={guid})", connectionGuid);
                    }
                    catch { }
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

        private static async Task<IResult> ChatSocketAsyncNew(
            HttpContext context,
            [FromServices] IFListApi flistApi,
            [FromServices] IAppConfiguration appConfiguration,
            [FromServices] IHostApplicationLifetime hostApplicationLifetime,
            [FromServices] IFalsifiedClientTicketManager fctm,
            [FromServices] ILogger<ChatSocketExtensionsClass> logger,
            CancellationToken cancellationToken)
        {
            Guid connectionGuid = Guid.NewGuid();
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
                        logger.LogInformation("Chat proxy connection from UI opened (guid={guid})", connectionGuid);

                        using var connectionCTS = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);

                        // Get IDN from client
                        var idnMsg = await ReadTextMessageAsync(clientWebSocket, 1024, cancellationToken) ?? "";
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

                        logger.LogInformation("Chat proxy connection getting identified websocket (guid={guid})...", connectionGuid);
                        var (maybeFChatWebSocket, initialMessage) = await GetIdentifiedChatWebSocketAsync(
                            flistApi, appConfiguration,
                            method, account, character, cname, cversion,
                            logger, connectionGuid, cancellationToken);

                        logger.LogInformation("Chat proxy connection got identified websocket (guid={guid})", connectionGuid);

                        await clientWebSocket.SendAsync(System.Text.Encoding.UTF8.GetBytes(initialMessage),
                            WebSocketMessageType.Text, true, cancellationToken);

                        if (maybeFChatWebSocket is not null)
                        {
                            using var fchatWebSocket = maybeFChatWebSocket;

                            var stcLoop = SocketToSocketLoop(fchatWebSocket, clientWebSocket, $"{connectionGuid}-S2C", logger, connectionCTS.Token);
                            var ctsLoop = SocketToSocketLoop(clientWebSocket, fchatWebSocket, $"{connectionGuid}-C2S", logger, connectionCTS.Token);

                            await Task.WhenAny(stcLoop, ctsLoop);

                            connectionCTS.Cancel();

                            await Task.WhenAll(stcLoop, ctsLoop);
                        }
                    }
                    catch (Exception ex)
                    {
                        logger.LogError(ex, "Error during chat proxy connection (guid={guid}, msg={msg}", connectionGuid, ex.Message);
                    }

                    logger.LogInformation("Chat proxy connection closed (guid={guid})", connectionGuid);
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
            ILogger logger, Guid connectionGuid,
            CancellationToken cancellationToken)
        {
            try
            {
                var authApi = await fListApi.GetAlreadyAuthenticatedFListApiAsync(account, cancellationToken);
                var gatResp = await authApi.GetApiTicketAsync(cancellationToken);
                logger.LogInformation("Using ApiTicket (guid={guid}, ticket={ticket}, cameFromCache={cameFromCache})", 
                    connectionGuid, gatResp.Value.Ticket, gatResp.CameFromCache);
                var canRetry = true;
                var canRetryAgain = true;
                while (gatResp.CameFromCache && canRetry)
                {
                    canRetry = canRetryAgain;
                    var fchatWebSocket = new ClientWebSocket();
                    var fchatWebSocketReturned = false;
                    try
                    {
                        logger.LogInformation("Opening server connection (guid={guid})...", connectionGuid);
                        await fchatWebSocket.ConnectAsync(new Uri(appConfiguration.WebSocketPath), cancellationToken);
                        logger.LogInformation("Opened server connection (guid={guid})", connectionGuid);

                        var jobj = new JsonObject();
                        jobj.Add("method", "ticket");
                        jobj.Add("account", account);
                        jobj.Add("character", character);
                        jobj.Add("ticket", gatResp.Value.Ticket);
                        jobj.Add("cname", cname);
                        jobj.Add("cversion", cversion);
                        var idnToSend = "IDN " + JsonSerializer.Serialize(jobj,
                                SourceGenerationContextUnindented.Default.JsonObject);

                        logger.LogInformation("Sending IDN (guid={guid}, ticket={ticket})...", connectionGuid, gatResp.Value.Ticket);
                        await fchatWebSocket.SendAsync(
                            System.Text.Encoding.UTF8.GetBytes(idnToSend),
                            WebSocketMessageType.Text,
                            true, cancellationToken);
                        logger.LogInformation("Sent IDN (guid={guid}, ticket={ticket})...", connectionGuid, gatResp.Value.Ticket);

                        // Get IDN response
                        var idnRespMsg = await ReadTextMessageAsync(fchatWebSocket, 1024, cancellationToken) ?? "";
                        logger.LogInformation("Got resp (guid={guid}, msg={msg})", connectionGuid, idnRespMsg);
                        if (idnRespMsg.StartsWith("IDN "))
                        {
                            // Success!
                            fchatWebSocketReturned = true;
                            return (fchatWebSocket, idnRespMsg);
                        }
                        else if (gatResp.CameFromCache && canRetry)
                        {
                            // Failure, but we can retry
                            logger.LogWarning("Failure, but we can retry (guid={guid})", connectionGuid);
                            await authApi.InvalidateApiTicketAsync(gatResp.Value.Ticket, cancellationToken);
                            gatResp = await authApi.GetApiTicketAsync(cancellationToken);
                            canRetryAgain = false;
                        }
                        else
                        {
                            // Failure, retry not possible
                            logger.LogWarning("Failure, retry not possible (guid={guid})", connectionGuid);
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

                logger.LogError("Failure, could not connect to F-Chat (guid={guid})", connectionGuid);
                var ejobj = new JsonObject();
                ejobj.Add("message", $"XarChat was unable to connect to F-Chat.");
                return (null, "ERR " + JsonSerializer.Serialize(ejobj, SourceGenerationContextUnindented.Default.JsonObject));
            }
            catch (Exception ex)
            {
                logger.LogError("Failure, unexpected exception (guid={guid}, msg={msg})", connectionGuid, ex.Message);
                var ejobj = new JsonObject();
                ejobj.Add("message", $"XarChat was unable to connect to F-Chat: {ex.Message}");
                return (null, "ERR " + JsonSerializer.Serialize(ejobj, SourceGenerationContextUnindented.Default.JsonObject));
            }
        }

        private static async Task<string?> ReadTextMessageAsync(
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
                        return null;
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

        private static async Task SocketToSocketLoop(
            WebSocket inSocket, WebSocket outSocket, string loopType, ILogger logger, CancellationToken cancellationToken)
        {
            try
            {
                var buf = new byte[128 * 1024];
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
            catch when (cancellationToken.IsCancellationRequested)
            {
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
