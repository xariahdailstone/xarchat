using XarChat.FList2.Common;
using XarChat.FList2.FList2Api.Implementation.Firehose.Messages;
using XarChat.FList2.FList2Api.Implementation.Firehose.Messages.Incoming;
using XarChat.FList2.Stomp;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using System.Threading.Channels;
using System.Threading.Tasks;

namespace XarChat.FList2.FList2Api.Implementation.Firehose
{
    internal class FirehoseManager : IFirehose, IAsyncDisposable
    {
        private readonly DefaultFList2Api _defaultFList2Api;

        public FirehoseManager(
            DefaultFList2Api defaultFList2Api)
        {
            _defaultFList2Api = defaultFList2Api;
            _processingLoopTask = ProcessingLoopAsync(_disposeCTS.Token);
        }

        private readonly CancellationTokenSource _disposeCTS = new CancellationTokenSource();
        private readonly Task _processingLoopTask;

        private bool _disposed = false;
        private Channel<IFirehoseIncomingMessage> _incomingMessageChannel = Channel.CreateUnbounded<IFirehoseIncomingMessage>();
        private Channel<IFirehoseOutgoingMessage> _outgoingMessageChannel = Channel.CreateUnbounded<IFirehoseOutgoingMessage>();

        public async ValueTask DisposeAsync()
        {
            if (!this._disposed)
            {
                Console.WriteLine("disposing " + GetType().Name);
                _disposed = true;
                _disposeCTS.Cancel();
                await _processingLoopTask;
            }
        }

        private void ThrowIfDisposed()
        {
            if (this._disposed)
            {
                throw new ObjectDisposedException(this.GetType().Name);
            }
        }

        public FirehoseStatus FirehoseStatus 
        {
            get => field;
            private set
            {
                if (value != field)
                {
                    var oldValue = field;
                    field = value;
                    _firehoseStatusChanged.Invoke(new(oldValue, value));
                }
            }
        } = FirehoseStatus.Connecting;

        private readonly CallbackSet<OldNew<FirehoseStatus>> _firehoseStatusChanged = new CallbackSet<OldNew<FirehoseStatus>>();

        private StompClient? _currentStompClient = null;
        public void Test_DropWebSocket()
        {
            _currentStompClient!.Test_DropWebSocket();
        }

        public IDisposable AddFirehoseStatusChangedHandler(Action<OldNew<FirehoseStatus>> callback)
            => _firehoseStatusChanged.Add(callback);

        private async Task ProcessingLoopAsync(CancellationToken cancellationToken)
        {
            string? previousSessionId = null;
            while (!cancellationToken.IsCancellationRequested)
            {
                using var thisClientCTS = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);

                Console.WriteLine("** Stomp loop iteration begin");
                this.FirehoseStatus = FirehoseStatus.Connecting;
                try
                {
                    var connectHeaders = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                    if (previousSessionId is not null)
                    {
                        connectHeaders.Add("X-Previous-Session-Id", previousSessionId);
                    }
                    //else
                    //{
                    //    connectHeaders.Add("X-Previous-Session-Id", Guid.NewGuid().ToString());
                    //}

                    Console.WriteLine("** Connecting Stomp Websocket");
                    using var sc = await StompClient.CreateAsync(new Uri($"wss://test.f-list.net/api/websocket-connect?csrf_token={_defaultFList2Api.CsrfToken.Token}"),
                            _defaultFList2Api.CookieContainer,
                            connectHeaders,
                            cancellationToken);
                    this._currentStompClient = sc;
                    Console.WriteLine("** Connected Stomp Websocket");

                    // Get CONNECTED frame
                    var connectedFrame = await sc.ReadAsync(cancellationToken);
                    if (connectedFrame is null) { throw new ApplicationException("no connected frame"); }

                    if (connectedFrame.Headers.TryGetValue("X-Spring-Session-Id", out var newSessionId))
                    {
                        if (newSessionId != previousSessionId)
                        {
                            // new session, need to emit firehose break message
                            await _incomingMessageChannel.Writer.WriteAsync(new FirehoseBrokenMessage(), cancellationToken);

                            // issue subscriptions
                            await sc.WriteAsync(new StompFrame()
                            {
                                Command = "SUBSCRIBE",
                                Headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                            {
                                { "auto-delete", "true" },
                                { "id", "sub-0" },
                                { "destination", "/user/queue/firehose" }
                            },
                                Body = null
                            }, cancellationToken);
                            await sc.WriteAsync(new StompFrame()
                            {
                                Command = "SUBSCRIBE",
                                Headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                            {
                                { "auto-delete", "true" },
                                { "id", "sub-1" },
                                { "destination", $"/user/queue/firehose-{newSessionId}" }
                            },
                                Body = null
                            }, cancellationToken);
                        }

                        previousSessionId = newSessionId;
                    }
                    else
                    {
                        throw new ApplicationException("Unable to get STOMP session id");
                    }

                    this.FirehoseStatus = FirehoseStatus.Connected;

                    var tasks = new List<Task>()
                    {
                        RunStompHeartbeatLoop(sc, thisClientCTS.Token),
                        RunFChatHeartbeatLoop(sc, thisClientCTS.Token),
                        RunStompReceiveLoop(sc, thisClientCTS.Token),
                        RunStompSendLoop(sc, thisClientCTS.Token)
                    };

                    await Task.WhenAny(tasks);
                    Console.WriteLine("** Tearing down stomp loop iteration...");

                    thisClientCTS.Cancel();

                    await Task.WhenAll(tasks);
                }
                catch when (!cancellationToken.IsCancellationRequested)
                {
                }
                catch (Exception ex)
                {
                    Debug.WriteLine("Processing loop failure: " + ex.ToString());
                }
                finally
                {
                    thisClientCTS.Cancel();
                    Console.WriteLine("** Stomp loop iteration complete");
                }
            }
            this.FirehoseStatus = FirehoseStatus.Disconnected;
        }

        private async Task RunStompHeartbeatLoop(StompClient sc, CancellationToken cancellationToken)
        {
            try
            {
                while (!cancellationToken.IsCancellationRequested)
                {
                    var sf = new StompFrame()
                    {
                        Command = "SEND",
                        Headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                        {
                            { "destination", "/app/session.heartbeat" }
                        },
                        Body = null
                    };
                    Console.WriteLine("** Stomp heartbeat send");
                    await sc.WriteAsync(sf, cancellationToken);
                    await Task.Delay(30000, cancellationToken);
                }
            }
            catch when (cancellationToken.IsCancellationRequested)
            {
            }
        }

        private async Task RunFChatHeartbeatLoop(StompClient sc, CancellationToken cancellationToken)
        {
            try
            {
                while (!cancellationToken.IsCancellationRequested)
                {
                    Console.WriteLine("** FChat heartbeat send");
                    await sc.WriteRawAsync(new byte[] { 10 }, System.Net.WebSockets.WebSocketMessageType.Text, true, cancellationToken);
                    await Task.Delay(10000, cancellationToken);
                }
            }
            catch when (cancellationToken.IsCancellationRequested)
            {
            }
        }

        private void VerifyJsonTypeInfo(Type objType, JsonSerializerOptions jso)
        {
            if (!jso.TryGetTypeInfo(objType, out var jsonTypeInfo))
            {
                throw new ApplicationException($"Missing JsonTypeInfo for {objType.Name}");
            }
        }

        private string JsonSerialize(object obj, Type objType, JsonSerializerOptions? jso = null)
        {
            jso ??= FirehostMessagesJsonSerializerContext.Default.Options;
            VerifyJsonTypeInfo(objType, jso);
            var result = JsonSerializer.Serialize(obj, objType, jso);
            return result;

        }

        private string JsonSerialize<T>(T obj, JsonSerializerOptions? jso = null)
            => JsonSerialize(obj!, obj!.GetType(), jso);

        private object JsonDeserialize(string json, Type objType, JsonSerializerOptions? jso = null)
        {
            jso ??= FirehostMessagesJsonSerializerContext.Default.Options;
            VerifyJsonTypeInfo(objType, jso);
            var result = JsonSerializer.Deserialize(json, objType, jso)!;
            return result;
        }

        private object JsonDeserialize(JsonNode node, Type objType, JsonSerializerOptions? jso = null)
        {
            jso ??= FirehostMessagesJsonSerializerContext.Default.Options;
            VerifyJsonTypeInfo(objType, jso);
            var result = JsonSerializer.Deserialize(node, objType, jso)!;
            return result;
        }

        private T JsonDeserialize<T>(string json, JsonSerializerOptions? jso = null)
            => (T)JsonDeserialize(json, typeof(T), jso);

        private async Task RunStompReceiveLoop(StompClient sc, CancellationToken cancellationToken)
        {
            try
            {
                while (!cancellationToken.IsCancellationRequested)
                {
                    var sf = await sc.ReadAsync(cancellationToken);
                    
                    // TODO: examine and dispatch stomp frame as outgoing firehose message
                    Console.WriteLine("** Stomp message received");

                    if (sf is null) { return; }

                    /* if (sf.Command == "")
                    {
                        Console.WriteLine("** sending empty message");
                        await sc.WriteAsync(new StompFrame() { Command = "", Headers = new Dictionary<string, string>(), Body = null }, cancellationToken);
                    }
                    else */ if (sf.Command == "MESSAGE")
                    {
                        var mid = sf.Headers["x-message-id"];
                        if (!String.IsNullOrWhiteSpace(mid))
                        {
                            var ackBody = JsonSerialize(new MessageAckResponse() { MessageId = mid }, StompJsonSerializerContext.Default.Options);
                            // Ack the message
                            var acksf = new StompFrame()
                            {
                                Command = "SEND",
                                Headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                                {
                                    { "destination", "/app/session.message.ack" }
                                },
                                Body = System.Text.Encoding.UTF8.GetBytes(ackBody)
                            };
                            Console.WriteLine("** sending ACK received message");
                            await sc.WriteAsync(acksf, cancellationToken);
                        }

                        if (!(await TryProcessIncomingMessage(sf, cancellationToken)))
                        {
                            // TODO: log this
                            Console.WriteLine("!!! unhandled incoming message = " + System.Text.Encoding.UTF8.GetString(sf.Body ?? []));
                        }
                    }
                    else if (sf.Command == "ERROR")
                    {
                        Console.WriteLine("!!! ERROR = " + System.Text.Encoding.UTF8.GetString(sf.Body ?? []));
                    }
                }
            }
            catch when (cancellationToken.IsCancellationRequested)
            {
            }
        }

        private IEnumerable<(Type Type, IncomingMessageAttribute IncomingMessageAttribute)> GetTypesWithIncomingMessageAttribute()
        {
            var q =
                from typ in Assembly.GetExecutingAssembly().GetTypes()
                from atrs in typ.GetCustomAttributes<IncomingMessageAttribute>()
                select (typ, atrs);

            return q;
        }

        private async Task<bool> TryProcessIncomingMessage(StompFrame sf, CancellationToken cancellationToken)
        {
            var jsonStr = System.Text.Encoding.UTF8.GetString(sf.Body!);
            var envelope =  JsonDeserialize<IncomingMessageEnvelope>(jsonStr, StompJsonSerializerContext.Default.Options)!;
            foreach (var tuple in GetTypesWithIncomingMessageAttribute())
            {
                var attr = tuple.IncomingMessageAttribute;
                if (attr.Target == envelope.Target && attr.Type == envelope.Type)
                {
                    var jso = new JsonSerializerOptions();
                    
                    var res = (IFirehoseIncomingMessage)JsonDeserialize(envelope.Content, tuple.Type)!;
                    await _incomingMessageChannel.Writer.WriteAsync(res, cancellationToken);
                    return true;
                }
            }
            return false;
        }


        private async Task RunStompSendLoop(StompClient sc, CancellationToken cancellationToken)
        {
            try
            {
                while (!cancellationToken.IsCancellationRequested)
                {
                    var outgoingMessage = await _outgoingMessageChannel.Reader.ReadAsync(cancellationToken);

                    var bodyJson = JsonSerialize(outgoingMessage, outgoingMessage.GetType());
                    var sf = new StompFrame()
                    {
                        Command = "SEND",
                        Headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                        {
                            { "destination", outgoingMessage.MqDestination }
                        },
                        Body = System.Text.Encoding.UTF8.GetBytes(bodyJson)
                    };
                    Console.WriteLine("** Stomp message send");
                    await sc.WriteAsync(sf, cancellationToken);
                }
            }
            catch when (cancellationToken.IsCancellationRequested)
            {
            }
        }

        public async Task WriteAsync(IFirehoseOutgoingMessage message, CancellationToken cancellationToken)
        {
            using var combinedCTS = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, _disposeCTS.Token);
            cancellationToken = combinedCTS.Token;

            ThrowIfDisposed();
            try
            {
                await _outgoingMessageChannel.Writer.WriteAsync(message, cancellationToken);
            }
            catch when (_disposeCTS.IsCancellationRequested)
            {
                throw new ObjectDisposedException(GetType().Name);
            }
            catch
            {
                _ = this.DisposeAsync();
                throw;
            }
        }

        public async Task<IFirehoseIncomingMessage?> ReadAsync(CancellationToken cancellationToken)
        {
            using var combinedCTS = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, _disposeCTS.Token);
            cancellationToken = combinedCTS.Token;

            ThrowIfDisposed();
            try
            {
                var result = await _incomingMessageChannel.Reader.ReadAsync(cancellationToken);
                return result;
            }
            catch when (_disposeCTS.IsCancellationRequested)
            {
                throw new ObjectDisposedException(GetType().Name);
            }
            catch
            {
                _ = this.DisposeAsync();
                throw;
            }
        }
    }

    public class MessageAckResponse
    {
        [JsonPropertyName("messageId")]
        public required string MessageId { get; set; }
    }


    public class IncomingMessageEnvelope
    {
        [JsonPropertyName("target")]
        public string Target { get; set; }

        [JsonPropertyName("type")]
        public string Type { get; set; }

        [JsonPropertyName("content")]
        public JsonNode Content { get; set; }
    }

    [JsonSerializable(typeof(MessageAckResponse))]
    [JsonSerializable(typeof(IncomingMessageEnvelope))]
    public partial class StompJsonSerializerContext : JsonSerializerContext
    {

    }
}
