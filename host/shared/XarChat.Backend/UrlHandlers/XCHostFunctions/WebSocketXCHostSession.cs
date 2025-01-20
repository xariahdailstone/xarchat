using Microsoft.AspNetCore.Components.Forms;
using Microsoft.AspNetCore.DataProtection.KeyManagement;
using Microsoft.AspNetCore.Mvc.DataAnnotations;
using Microsoft.Extensions.DependencyInjection;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Diagnostics.CodeAnalysis;
using System.Diagnostics.Eventing.Reader;
using System.Linq;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using XarChat.Backend.Common;
using XarChat.Backend.Features.AppConfiguration;
using XarChat.Backend.Features.AppFileServer;
using XarChat.Backend.Features.ChatLogging;
using XarChat.Backend.Features.CommandableWindows;
using XarChat.Backend.Features.EIconIndexing;
using XarChat.Backend.Features.EIconLoader;
using XarChat.Backend.Features.EIconUpdateSubmitter;
using XarChat.Backend.Features.IdleDetection;
using XarChat.Backend.Features.NewAppSettings;
using XarChat.Backend.Features.NotificationBadge;
using XarChat.Backend.Features.TimingSet;
using XarChat.Backend.Features.UpdateChecker;
using XarChat.Backend.Features.WindowControl;
using XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.ConfigData;
using XarChat.Backend.UrlHandlers.XCHostFunctions.SessionAdapters;
using XarChat.Backend.UrlHandlers.XCHostFunctions.SessionAdapters.OldNewAppSettings;
using XarChat.Backend.UrlHandlers.XCHostFunctions.SessionNamespaces;
using XarChat.Backend.UrlHandlers.XCHostFunctions.SessionNamespaces.EIconData;
using XarChat.Backend.UrlHandlers.XCHostFunctions.SessionNamespaces.LogSearch;
using XarChat.Backend.UrlHandlers.XCHostFunctions.SessionNamespaces.WindowCommand;
using SplitWriteFunc = System.Func<string, string?, System.Threading.CancellationToken, System.Threading.Tasks.Task>;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions
{
    public class WebSocketXCHostSession : XCHostSessionBase
    {
        private static Dictionary<string, Func<WebSocketXCHostSession, string, CancellationToken, Task>> _commandHandlers;

        static WebSocketXCHostSession()
        {
            _commandHandlers = new(StringComparer.OrdinalIgnoreCase)
            {
                { "request", (sess, arg, ct) => sess.HandleRequest(arg, ct) },
                { "cancel", (sess, arg, ct) => sess.HandleCancel(arg, ct) },

                { "eiconSearch", (sess, arg, ct) => sess.HandleEIconSearchCommand(arg, ct) },
                { "eiconSearchClear", (sess, arg, ct) => sess.HandleEIconSearchClearCommand(arg, ct) },
            };
        }

        private readonly IServiceProvider _sp;
        private readonly WebSocket _ws;
        private readonly CancellationTokenSource _disposeCTS = new CancellationTokenSource();

        private readonly ISet<IDisposable> _constituents = new HashSet<IDisposable>();

        public WebSocketXCHostSession(IServiceProvider sp, WebSocket webSocket)
        {
            _sp = sp;
            _ws = webSocket;

            var appCfg = _sp.GetRequiredService<IAppConfiguration>();
            _constituents.Add(appCfg.OnValueChanged((key, value, changeMetadata) => 
            { 
                this.ConfigDataChanged(key, value, changeMetadata); 
            }));

            _replyableCommandAdapters.Add("NewAppSettings", (sp) =>
            {
                var nas = sp.GetRequiredService<INewAppSettings>();
                return new SessionNewAppSettingsAdapter(nas);
            });

            this.AddSessionNamespace("logsearch", w =>
            {
                var clw = sp.GetRequiredService<IChatLogWriter>();
                var cls = sp.GetRequiredService<IChatLogSearch>();
                return new LogSearchSessionNamespace(clw, cls, w);
            });
            this.AddSessionNamespace("windowcommand", w =>
            {
                var cwr = sp.GetRequiredService<ICommandableWindowRegistry>();
                return new WindowCommandSessionNamespace(cwr, w);
            });
            this.AddSessionNamespace("eiconloader", w =>
            {
                var el = sp.GetRequiredService<IEIconLoader>();
                return new EIconDataSessionNamespace(el, w);
            });
        }

        public override void Dispose()
        {
            if (!_disposeCTS.IsCancellationRequested)
            {
                try { _disposeCTS.Cancel(); }
                catch { }
                SetNotificationBadge(NotificationBadgeType.None);

                foreach (var disp in _sessionDisposables.Values)
                {
                    disp.Dispose();
                }
                _sessionDisposables.Clear();

                foreach (var constituent in _constituents)
                {
                    constituent.Dispose();
                }
                _constituents.Clear();

                base.Dispose();
            }
        }

        private readonly Dictionary<string, ISessionNamespace> _namespaces = new Dictionary<string, ISessionNamespace>();

        private void AddSessionNamespace(string ns, Func<SplitWriteFunc, ISessionNamespace> sessionNsMaker)
        {
            var swf = CreateWriteSplitAsync(ns);
            this._namespaces.Add(ns, sessionNsMaker(swf));
        }

        public async Task RunAsync(CancellationToken cancellationToken)
        {
            using var ccts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, _disposeCTS.Token);

            await ReadLoopAsync(ccts.Token);
        }

        private readonly SemaphoreSlim _writeSem = new SemaphoreSlim(1);

        private SplitWriteFunc CreateWriteSplitAsync(string ns)
        {
            return async (string cmd, string? data, CancellationToken cancellationToken) =>
            {
                cmd = $"{ns}.{cmd}";

                if (data != null)
                {
                    cmd = $"{cmd} {data}";
                }

                await WriteAsync(cmd);
            };
            
        }

        public async Task WriteAsync(string str)
        {
            var buf = System.Text.Encoding.UTF8.GetBytes(str);
            await _writeSem.WaitAsync();
            try
            {
                await _ws.SendAsync(buf, WebSocketMessageType.Text, true, _disposeCTS.Token);
            }
            finally
            {
                _writeSem.Release();
            }
        }

        private async Task ReadLoopAsync(CancellationToken stoppingToken)
        {
            try
            {
                while (!stoppingToken.IsCancellationRequested)
                {
                    await ReadLoopStep(stoppingToken);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
            catch
            {
                this.Dispose();
            }
        }

        private async Task ReadLoopStep(CancellationToken stoppingToken)
        {
            byte[]? workingBuf = null;
            var buf = new byte[1024];

            WebSocketReceiveResult recvResult;
            do {
                recvResult = await _ws.ReceiveAsync(buf, stoppingToken);
                if (workingBuf == null)
                {
                    workingBuf = buf[0..recvResult.Count];
                }
                else
                {
                    workingBuf = workingBuf.Concat(buf[0..recvResult.Count]).ToArray();
                }
            } while (!recvResult.EndOfMessage);


            if (recvResult.MessageType == WebSocketMessageType.Close)
            {
                this.Dispose();
                return;
            }

            try
            {
                var str = System.Text.Encoding.UTF8.GetString(workingBuf);
                await ProcessCommandAsync(str, stoppingToken);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine("Unhandled XCHostSession exception:\n\n" + ex.ToString());
            }
        }

        private readonly Dictionary<long, PendingRequestInfo> _pendingRequests = new Dictionary<long, PendingRequestInfo>();

        private class PendingRequestInfo
        {
            public long MessageId { get; set; }

            public CancellationTokenSource CancellationTokenSource { get; set; } = new CancellationTokenSource();
        }

        private readonly Dictionary<string, Func<IServiceProvider, ISessionAdapter>> _replyableCommandAdapters
            = new Dictionary<string, Func<IServiceProvider, ISessionAdapter>>(StringComparer.OrdinalIgnoreCase);


        private async Task ProcessReplyableCommandAsync(long msgId, JsonObject dataObj)
        {
            var pri = new PendingRequestInfo() { MessageId = msgId };
            lock (_pendingRequests)
            {
                _pendingRequests[msgId] = pri;
            }

            var cancellationToken = pri.CancellationTokenSource.Token;
            var cmd = (string)dataObj["cmd"]!;
            try
            {
                JsonNode reply;

                switch (cmd)
                {
                    case var _ when String.Equals(cmd, "ping", StringComparison.OrdinalIgnoreCase):
                        await Task.Delay(2000, cancellationToken);
                        var jreply = new JsonObject();
                        jreply["cmd"] = "pong";
                        reply = jreply;
                        break;
                    //case var _ when cmd.StartsWith("NewAppSettings.", StringComparison.OrdinalIgnoreCase):
                    //    {
                    //        var nas = _sp.GetRequiredService<INewAppSettings>();
                            
                    //    }
                    //    break;
                    case var _ when cmd.IndexOf('.') != -1:
                        {
                            var adapterName = cmd.Substring(0, cmd.IndexOf('.'));
                            if (_replyableCommandAdapters.TryGetValue(adapterName, out var adapterFactory))
                            {
                                var adapter = adapterFactory(_sp);
                                var resp = await adapter.HandleCommand(cmd.Substring(adapterName.Length + 1), dataObj["data"]!, cancellationToken);
                                reply = resp;
                            }
                            else
                            {
                                throw new InvalidOperationException($"unknown cmd: {cmd}");
                            }
                        }
                        break;
                    //case var _ when String.Equals(cmd, "getNewAppSettingsConnection", StringComparison.OrdinalIgnoreCase):
                    //    break;
                    //case var _ when String.Equals(cmd, "doSqlCommand", StringComparison.OrdinalIgnoreCase):
                    //    break;
                    default:
                        throw new InvalidOperationException($"unknown cmd: {cmd}");
                }

                var res = new JsonObject();
                res["_msgid"] = msgId;
                res["data"] = reply;
                _ = this.WriteAsync("reply " + JsonUtilities.Serialize(res, SourceGenerationContext.Default.JsonObject));
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                var res = new JsonObject();
                res["_msgid"] = msgId;
                _ = this.WriteAsync("replycancelled " + JsonUtilities.Serialize(res, SourceGenerationContext.Default.JsonObject));
            }
            catch (Exception ex)
            {
                var res = new JsonObject();
                res["_msgid"] = msgId;
                res["message"] = ex.Message;
                _ = this.WriteAsync("replyfailed " + JsonUtilities.Serialize(res, SourceGenerationContext.Default.JsonObject));
            }

            lock (_pendingRequests)
            {
                _pendingRequests.Remove(msgId);
            }
        }


        private async Task HandleRequest(string arg, CancellationToken cancellationToken)
        {
            var argObj = JsonUtilities.Deserialize(arg, SourceGenerationContext.Default.JsonObject);
            var msgId = ((long)argObj["_msgid"]!);
            _ = ProcessReplyableCommandAsync(msgId, (JsonObject)argObj["data"]!);
        }

        private async Task HandleCancel(string arg, CancellationToken cancellationToken)
        {
            var argObj = JsonUtilities.Deserialize(arg, SourceGenerationContext.Default.JsonObject);
            var msgId = ((long)argObj["_msgid"]!);
            lock (_pendingRequests)
            {
                if (_pendingRequests.TryGetValue(msgId, out var pri))
                {
                    pri.CancellationTokenSource.Cancel();
                }
            }
        }

        private async Task HandleEIconSearchCommand(string arg, CancellationToken cancellationToken)
        {
            var parsedArgs = JsonUtilities.Deserialize<EIconSearchArgs>(arg, SourceGenerationContext.Default.EIconSearchArgs)!;
            var sw = Stopwatch.StartNew();
            _ = Task.Run(async () =>
            {
                sw.Stop();
                var taskWaitTime = sw.Elapsed;

                await HandleEIconSearch(parsedArgs, cancellationToken);
            });
        }

        private async Task HandleEIconSearchClearCommand(string arg, CancellationToken cancellationToken)
        {
            //var sw = Stopwatch.StartNew();
            RecycleEIconSearch(null);
            //sw.Stop();
            //await this.WriteAsync($"eiconSearchClearDone {{ \"took\": {sw.ElapsedMilliseconds} }}");
        }


        private readonly Dictionary<object, IDisposable> _sessionDisposables
            = new Dictionary<object, IDisposable>();

        private async Task ProcessCommandAsync(string str, CancellationToken stoppingToken)
        {
            var timingSet = _sp.GetRequiredService<ITimingSetFactory>().CreateTimingSet();

            string cmd;
            string arg;
            using (var _ = timingSet.BeginTimingOperation("ProcessCommandAsync"))
            {
                cmd = str.IndexOf(' ') == -1 ? str : str.Substring(0, str.IndexOf(' '));
                arg = str.IndexOf(' ') == -1 ? "" : str.Substring(str.IndexOf(' ') + 1);

                //await WriteAsync($"recvack {{ \"cmd\": \"{cmd}\" }}");
                //var pcsw = Stopwatch.StartNew();

                bool handled = false;
                if (cmd.Contains('.'))
                {
                    var parts = cmd.Split('.');
                    if (_namespaces.TryGetValue(parts[0], out var sns))
                    {
                        var d = !String.IsNullOrWhiteSpace(arg) ? arg : null;
                        handled = await sns.TryInvokeAsync(cmd.Substring(parts[0].Length + 1), d, stoppingToken);
                    }
                }

                if (!handled)
                {
                    if (_commandHandlers.TryGetValue(cmd, out var handler))
                    {
                        await handler(this, arg, stoppingToken);
                    }
                    else
                    {
                        using var scope = _sp.CreateAsyncScope();
                        var scopedSP = scope.ServiceProvider;
                        var ch = scopedSP.GetKeyedService<IXCHostCommandHandler>(cmd.ToLowerInvariant());
                        if (ch is not null)
                        {
                            await ch.HandleCommandAsync(new XCHostCommandContext(
                                cmd, arg,
                                async (msg) => await WriteAsync(msg),
                                _sessionDisposables), stoppingToken);
                        }
                    }
                }
            }
            
            var jsonObject = new JsonObject();
            jsonObject["cmd"] = cmd;
            jsonObject["timing"] = new JsonArray(
                timingSet.GetTimedOperations().Select(toi => new JsonArray()
                {
                    (JsonNode)toi.Name,
                    (JsonNode)toi.Elapsed.TotalMilliseconds
                }).ToArray()
            );

            await WriteAsync("commandtiming " +
                JsonSerializer.Serialize(jsonObject, SourceGenerationContext.Default.JsonObject));
		}

        private void ConfigDataChanged(string key, JsonNode? value, Dictionary<string, object?>? changeMetadata)
        {
            if (changeMetadata is not null
                && changeMetadata.TryGetValue(ChangeMetadataOriginatorKey.Value, out var originator)
                && originator == this)
            {
            }
            else
            {
                _ = this.WriteAsync("configchange " + JsonUtilities.Serialize(new ConfigKeyValue()
                {
                    Key = key,
                    Value = value
                }, SourceGenerationContext.Default.ConfigKeyValue));
            }
        }


        private readonly object _currentEIconSearchLock = new object();

		private CurrentEIconSearch? _currentEIconSearch = null;

		private class CurrentEIconSearch
        {
			public CurrentEIconSearch(IEIconIndex eIconIndex, string searchTerm)
            {
				this.EIconSearchTerm = searchTerm;
                this.EIconSearchResultsTask = Task.Run(async () =>
                {
                    var result = await eIconIndex.SearchEIconsAsync(searchTerm, CancellationTokenSource.Token);
                    return result;
                });
			}

            private CancellationTokenSource CancellationTokenSource { get; } = new CancellationTokenSource();

            public void Cancel()
            {
                ThreadPool.QueueUserWorkItem(delegate
                {
                    this.CancellationTokenSource.Cancel();
                });
            }

            public string EIconSearchTerm { get; }

            public Task<IEIconSearchResults> EIconSearchResultsTask { get; set; }
        }

        [return: NotNullIfNotNull("newSearchTerm")]
        private CurrentEIconSearch? RecycleEIconSearch(string? newSearchTerm)
        {
            lock (_currentEIconSearchLock)
            {
                CurrentEIconSearch result;

				var existingCEI = _currentEIconSearch;
				if (existingCEI == null || existingCEI.EIconSearchTerm != newSearchTerm)
                {
                    if (newSearchTerm != null)
                    {
                        var idx = _sp.GetRequiredService<IEIconIndex>();
                        result = new CurrentEIconSearch(idx, newSearchTerm);
                        _currentEIconSearch = result;
                    }
                    else
                    {
                        _currentEIconSearch = null;
                    }

					if (existingCEI != null)
                    {
                        existingCEI.Cancel();
                    }
                }

                return _currentEIconSearch!;
            }
        }

        private async Task HandleEIconSearch(EIconSearchArgs parsedArgs, CancellationToken stoppingToken)
        {
            var myCEI = RecycleEIconSearch(parsedArgs.SearchTerm);

            try
            {
                var searchResults = await myCEI.EIconSearchResultsTask;

                var fromIndex = parsedArgs.StartAt;
                var toIndex = Math.Min(fromIndex + parsedArgs.GetCount, searchResults.Results.Count);
				List<string> resultSubset = new(toIndex - fromIndex);

				for (var i = fromIndex; i < toIndex; i++)
				{
                    var item = searchResults.Results[i];
                    resultSubset.Add(item.Name);
				}

				var res = new EIconSearchResult()
				{
					Key = parsedArgs.Key,
					TotalCount = searchResults.Results.Count,
					Results = resultSubset,
					Timings = searchResults.SearchTimings
				};

				await WriteAsync("eiconsearchresult " +
					JsonUtilities.Serialize<EIconSearchResult>(res, SourceGenerationContext.Default.EIconSearchResult));
			}
			catch (Exception ex)
            {
				var res = new EIconSearchResult()
				{
					Key = parsedArgs.Key,
					TotalCount = -1,
					Results = new List<string>()
				};
				await WriteAsync("eiconsearchresult " +
					JsonUtilities.Serialize<EIconSearchResult>(res, SourceGenerationContext.Default.EIconSearchResult));
			}
        }

        private void SetNotificationBadge(NotificationBadgeType type)
        {
            var mgr = _sp.GetRequiredService<INotificationBadgeManager>();
            mgr.SetNotificationBadge(type);
        }

        private string _lastWrittenWindowState = "";

        private void MaybeWriteWindowState(string winState)
        {
            if (winState != _lastWrittenWindowState)
            {
                _lastWrittenWindowState = winState;
                _ = this.WriteAsync(winState);
            }
        }

        public override void WindowRestored()
        {
            try
            {
                base.WindowRestored();
                MaybeWriteWindowState("win.restored");
            }
            catch { }
        }

        public override void WindowMinimized()
        {
            try
            {
                base.WindowMinimized();
                MaybeWriteWindowState("win.minimized");
            }
            catch { }
        }

        public override void WindowMaximized()
        {
            try
            {
                base.WindowMaximized();
                MaybeWriteWindowState("win.maximized");
            }
            catch { }
        }

        public override void CssFileUpdated(string filename)
        {
            try
            {
                Task.Run(async () =>
                {
                    try
                    {
                        var jo = new JsonObject();
                        jo["filename"] = filename;
                        await this.WriteAsync("cssfileupdated " +
                            JsonSerializer.Serialize(jo, SourceGenerationContext.Default.JsonObject));
                    }
                    catch { }
                });
            }
            catch { }
        }

        public class UpdateAppBadgeArgs
        {
            [JsonPropertyName("hasPings")]
            public bool HasPings { get; set; }

            [JsonPropertyName("hasUnseen")]
            public bool HasUnseen { get; set; }
        }

        public class LogPMConvoMessageArgs
        {
            [JsonPropertyName("myCharacterName")]
            public string MyCharacterName { get; set; }

            [JsonPropertyName("interlocutor")]
            public string Interlocutor { get; set; }

            [JsonPropertyName("speakingCharacter")]
            public string SpeakingCharacter { get; set; }

            [JsonPropertyName("messageType")]
            public int MessageType { get; set; }

            [JsonPropertyName("messageText")]
            public string MessageText { get; set; }

            [JsonPropertyName("gender")]
            public int CharacterGender { get; set; }

            [JsonPropertyName("status")]
            public int CharacterStatus { get; set; }
        }

        public class LogChannelMessageArgs
        {
            [JsonPropertyName("myCharacterName")]
            public string MyCharacterName { get; set; }

            [JsonPropertyName("channelName")]
            public string ChannelName { get; set; }

            [JsonPropertyName("channelTitle")]
            public string ChannelTitle { get; set; }
            
            [JsonPropertyName("speakingCharacter")]
            public string SpeakingCharacter { get; set; }

            [JsonPropertyName("messageType")]
            public int MessageType { get; set; }

            [JsonPropertyName("messageText")]
            public string MessageText { get; set; }

            [JsonPropertyName("gender")]
            public int CharacterGender { get; set; }

            [JsonPropertyName("status")]
            public int CharacterStatus { get; set; }
        }

        public class AddIdleMonitorRegistrationArgs
        {
            [JsonPropertyName("monitorName")]
            public string MonitorName { get; set; }

            [JsonPropertyName("idleAfterMs")]
            public int IdleAfterMs { get; set; }
        }

        public class RemoveIdleMonitorRegistrationArgs
        {
            [JsonPropertyName("monitorName")]
            public string MonitorName { get; set; }
        }

        public class AddUpdateCheckerMonitorRegistrationArgs
        {
            [JsonPropertyName("monitorName")]
            public string MonitorName { get; set; }
        }

        public class RemoveUpdateCheckerMonitorRegistrationArgs
        {
            [JsonPropertyName("monitorName")]
            public string MonitorName { get; set; }
        }

        public class EIconSearchArgs
        {
            [JsonPropertyName("search")]
            public string SearchTerm { get; set; }

            [JsonPropertyName("key")]
            public string Key { get; set; }

            [JsonPropertyName("start")]
            public int StartAt { get; set; }

            [JsonPropertyName("length")]
            public int GetCount { get; set; }
        }

        public class EIconSearchResult
        {
            [JsonPropertyName("key")]
            public string Key { get; set; }

            [JsonPropertyName("totalCount")]
            public int TotalCount { get; set; }

            [JsonPropertyName("results")]
            public List<string> Results { get; set; }

            [JsonPropertyName("timings")]
            public IReadOnlyDictionary<string, long>? Timings { get; set; }
        }

        public class GetCssDataArgs
        {
            [JsonPropertyName("msgid")]
            public int MessageId { get; set; }

            [JsonPropertyName("url")]
            public string Url { get; set; }
        }

        public class GotCssDataResult
        {
            [JsonPropertyName("msgid")]
            public int MessageId { get; set; }

            [JsonPropertyName("data")]
            public string Data { get; set; }
        }

        public class GetConfigDataArgs
        {
            [JsonPropertyName("msgid")]
            public int MessageId { get; set; }
        }

        public class GotConfigDataResult
        {
            [JsonPropertyName("msgid")]
            public int MessageId { get; set; }

            [JsonPropertyName("data")]
            public List<ConfigKeyValue> Data { get; set; }
        }

        public class ConfigKeyValue
        {
            [JsonPropertyName("key")]
            public string Key { get; set; }

            [JsonPropertyName("value")]
            public JsonNode? Value { get; set; }
        }

        public class GetAllCssArgs
        {
            [JsonPropertyName("msgid")]
            public int MessageId { get; set; }
        }

        public class GotAllCssResult
        {
            [JsonPropertyName("msgid")]
            public int MessageId { get; set; }

            [JsonPropertyName("filenames")]
            public List<string> Filenames { get; set; }
        }

        public class SubmitEIconMetadataArgs
        {
            [JsonPropertyName("name")]
            public required string Name { get; set; }

            [JsonPropertyName("contentLength")]
            public required long ContentLength { get; set; }

            [JsonPropertyName("etag")]
            public required string ETag { get; set; }
        }
    }

    internal class UpdateCheckerMonitorRegistration : IDisposable
    {
        private readonly IUpdateChecker _updateChecker;
        private readonly Func<string, Task> _writeMessageAsyncFunc;
        private readonly string _monitorName;

        private bool _disposed = false;
        private readonly IDisposable _updateCheckerReg;

        public UpdateCheckerMonitorRegistration(
            IUpdateChecker updateChecker,
            string monitorName,
            Func<string, Task> writeMessageAsyncFunc)
        {
            _writeMessageAsyncFunc = writeMessageAsyncFunc;
            _updateChecker = updateChecker;
            _monitorName = monitorName;

            _updateCheckerReg = _updateChecker.OnStateChange(() => PublishState());
            PublishState();
        }

        public void Dispose()
        {
            if (!_disposed)
            {
                _disposed = true;
                _updateCheckerReg?.Dispose();
            }
        }

        public string MonitorName => _monitorName;

        private void PublishState()
        {
            try 
            {
                _ = _writeMessageAsyncFunc($"updatecheckerstate {{ \"monitorName\": \"{_monitorName}\", \"state\": \"{_updateChecker.State}\" }}");
            }
            catch { }
        }
    }
}
