using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using System.Text.Json.Serialization.Metadata;
using System.Threading.Tasks;
using XarChat.Backend.Common;
using XarChat.Backend.UrlHandlers.XCHostFunctions.SessionNamespaces;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.SessionNamespaces
{
    internal interface ISessionNamespace
    {
        Task<bool> TryInvokeAsync(string cmd, string? data, CancellationToken cancellationToken);
    }

    internal abstract class SessionNamespaceBase : ISessionNamespace
    {
        private readonly Func<string, string?, CancellationToken, Task> _writeMessageFunc;

        protected SessionNamespaceBase(Func<string, string?, CancellationToken, Task> writeMessageFunc)
        {
            _writeMessageFunc = writeMessageFunc;
        }

        protected async Task WriteMessageAsync(string cmd, string? data, CancellationToken cancellationToken)
        {
            await _writeMessageFunc(cmd, data, cancellationToken);
        }

        protected abstract JsonTypeInfo GetTypeInfo(Type type);

        private IDictionary<string, Func<string, string?, CancellationToken, Task>> _handlerFuncs
            = new Dictionary<string, Func<string, string?, CancellationToken, Task>>(StringComparer.OrdinalIgnoreCase);

        protected void RegisterTypedCommandHandler<TData>(
            string cmd,
            JsonTypeInfo<TData> dataCommandHandler,
            Func<string, TData, CancellationToken, Task> handlerFunc)
        {
            _handlerFuncs.Add(cmd,
                async (cmd, data, cancellationToken) =>
                {
                    var dataObj = JsonSerializer.Deserialize<TData>(data!, dataCommandHandler)!;
                    await handlerFunc(cmd, dataObj, cancellationToken);
                });
        }

        protected void RegisterTypedStreamCommandHandler<TData>(
            string cmd,
            Func<StreamHandlerArgs<TData>, Task> handlerFunc)
            where TData: StreamCommandMessage
        {
            _handlerFuncs.Add(cmd,
                async (cmd, data, cancellationToken) =>
                {
                    var dataJTI = this.GetTypeInfo(typeof(TData))!;
                    var dataObj = (TData)JsonSerializer.Deserialize(data!, dataJTI)!;
                    var msgid = dataObj.MsgId;

                    var asi = new ActiveStreamInfo(msgid);

                    _ = Task.Run(async () =>
                    {
                        var writeMsg = async (string cmd, StreamCommandMessage? data, CancellationToken cancellationToken) =>
                        {
                            if (data == null)
                            {
                                data = new StreamCommandMessage();
                            }
                            data.MsgId = msgid;

                            var jsonTypeInfo = data.GetType() == typeof(StreamCommandMessage)
                                ? SessionNamespaceSourceGenerationContext.Default.StreamCommandMessage
                                : this.GetTypeInfo(data.GetType());

                            var str = JsonSerializer.Serialize(data, jsonTypeInfo);
                            await this.WriteMessageAsync(cmd, str, cancellationToken);
                        };
                        lock (_activeStreams)
                        {
                            _activeStreams.Add(msgid, asi);
                        }

                        try
                        {
                            var sha = new StreamHandlerArgs<TData>(cmd, dataObj, writeMsg,
                                asi.ReadMessageAsync,
                                cancellationToken);
                            await handlerFunc(sha);
                        }
                        finally
                        {
                            lock (_activeStreams)
                            {
                                _activeStreams.Remove(msgid);
                            }
                            await writeMsg("endresponse", null, cancellationToken);
                        }
                    });
                });
        }

        private Dictionary<long, ActiveStreamInfo> _activeStreams = new Dictionary<long, ActiveStreamInfo>();

        public virtual async Task<bool> TryInvokeAsync(string cmd, string? data, CancellationToken cancellationToken)
        {
            if (_handlerFuncs.TryGetValue(cmd, out var handlerReg))
            {
                await handlerReg(cmd, data, cancellationToken);
                return true;
            }
            else
            {
                if (data != null)
                {
                    var jv = JsonSerializer.Deserialize<JsonNode>(data, SourceGenerationContext.Default.JsonNode);
                    if (jv != null && jv.GetValueKind() == JsonValueKind.Object)
                    {
                        var jobj = jv.AsObject();
                        if (jobj.ContainsKey("msgid"))
                        {
                            var msgid = (long)jobj["msgid"]!;

                            bool gotAsi;
                            ActiveStreamInfo? asi;
                            lock (_activeStreams)
                            {
                                gotAsi = _activeStreams.TryGetValue(msgid, out asi);
                            }
                            if (gotAsi)
                            {
                                if (cmd == "cancel")
                                {
                                    asi!.Cancel();
                                }
                                else
                                {
                                    await asi!.AddIncomingMessageAsync(cmd, data, cancellationToken);
                                }
                                return true;
                            }
                        }
                    }
                }

                return false;
            }
        }

        private class ActiveStreamInfo
        {
            private readonly CancellationTokenSource _cts = new CancellationTokenSource();

            public ActiveStreamInfo(long msgId)
            {
                this.MsgId = msgId;
            }

            public long MsgId { get; set; }

            public CancellationToken CancellationToken { get; }

            private readonly SemaphoreSlim _sem = new SemaphoreSlim(1);
            private readonly Queue<(string, string?)> _queuedMessages = new Queue<(string, string?)>();
            private readonly Queue<TaskCompletionSource<(string, string?)>> _readWaiters = new Queue<TaskCompletionSource<(string, string?)>>();

            public async Task AddIncomingMessageAsync(string cmd, string? data, CancellationToken cancellationToken)
            {
                await _sem.WaitAsync(cancellationToken);
                try
                {
                    var givenToReader = false;
                    while (_readWaiters.Count > 0)
                    {
                        var firstReader = _readWaiters.Dequeue();
                        if (firstReader.TrySetResult((cmd, data)))
                        {
                            givenToReader = true;
                            break;
                        }
                    }
                    if (!givenToReader)
                    {
                        _queuedMessages.Enqueue((cmd, data));
                    }
                }
                finally
                {
                    _sem.Release(); 
                }
            }

            public void Cancel()
            {
                _cts.Cancel();
            }

            public async Task<(string Command, string? Data)> ReadMessageAsync(CancellationToken cancellationToken)
            {
                TaskCompletionSource<(string, string?)> tcs;

                await _sem.WaitAsync(cancellationToken);
                try
                {
                    if (_queuedMessages.Count > 0)
                    {
                        var msg = _queuedMessages.Dequeue();
                        return msg;
                    }
                    else
                    {
                        tcs = new TaskCompletionSource<(string, string?)>();
                        _readWaiters.Enqueue(tcs);
                    }
                }
                finally
                {
                    _sem.Release();
                }

                using var combinedCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, this.CancellationToken);
                using var cancelReg = combinedCts.Token.Register(() => tcs.TrySetCanceled());
                var result = await tcs.Task;
                return result;
            }
        }
    }

    public record StreamHandlerArgs<T>(
        string Command, 
        T? Data,
        Func<string, StreamCommandMessage?, CancellationToken, Task> WriteMessageAsync,
        Func<CancellationToken, Task<(string Command, string? Data)>> ReadMessageAsync,
        CancellationToken CancellationToken);

    public class StreamCommandMessage
    {
        [JsonPropertyName("msgid")]
        public long MsgId { get; set; }
    }

    [JsonSerializable(typeof(JsonValue))]
    [JsonSerializable(typeof(StreamCommandMessage))]
    public partial class SessionNamespaceSourceGenerationContext : JsonSerializerContext
    {
    }
}