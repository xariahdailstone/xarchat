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
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using XarChat.Backend.Common;
using XarChat.Backend.Features.AppConfiguration;
using XarChat.Backend.Features.AppFileServer;
using XarChat.Backend.Features.ChatLogging;
using XarChat.Backend.Features.EIconIndexing;
using XarChat.Backend.Features.IdleDetection;
using XarChat.Backend.Features.NewAppSettings;
using XarChat.Backend.Features.NotificationBadge;
using XarChat.Backend.Features.UpdateChecker;
using XarChat.Backend.Features.WindowControl;
using XarChat.Backend.UrlHandlers.XCHostFunctions.SessionAdapters;
using XarChat.Backend.UrlHandlers.XCHostFunctions.SessionAdapters.OldNewAppSettings;
using XarChat.Backend.UrlHandlers.XCHostFunctions.SessionNamespaces;
using XarChat.Backend.UrlHandlers.XCHostFunctions.SessionNamespaces.LogSearch;

using SplitWriteFunc = System.Func<string, string?, System.Threading.CancellationToken, System.Threading.Tasks.Task>;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions
{
    public class WebSocketXCHostSession : XCHostSessionBase
    {
        private readonly IServiceProvider _sp;
        private readonly WebSocket _ws;
        private readonly CancellationTokenSource _disposeCTS = new CancellationTokenSource();

        private readonly ISet<IDisposable> _constituents = new HashSet<IDisposable>();

        public WebSocketXCHostSession(IServiceProvider sp, WebSocket webSocket)
        {
            _sp = sp;
            _ws = webSocket;

            var appCfg = _sp.GetRequiredService<IAppConfiguration>();
            _constituents.Add(appCfg.OnValueChanged((key, value) => { this.ConfigDataChanged(key, value); }));

            _replyableCommandAdapters.Add("NewAppSettings", (sp) =>
            {
                var nas = sp.GetRequiredService<INewAppSettings>();
                return new SessionNewAppSettingsAdapter(nas);
            });

            this.AddSessionNamespace("logsearch", w =>
            {
                var clw = sp.GetRequiredService<IChatLogWriter>();
                return new LogSearchSessionNamespace(clw, w);
            });
        }

        public override void Dispose()
        {
            if (!_disposeCTS.IsCancellationRequested)
            {
                try { _disposeCTS.Cancel(); }
                catch { }
                SetNotificationBadge(NotificationBadgeType.None);

                foreach (var reg in _idleMonitorRegistrations.Values)
                {
                    reg.Dispose();
                }
                _idleMonitorRegistrations.Clear();

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

        private async Task ProcessCommandAsync(string str, CancellationToken stoppingToken)
        {
            var cmd = str.IndexOf(' ') == -1 ? str : str.Substring(0, str.IndexOf(' '));
            var arg = str.IndexOf(' ') == -1 ? "" : str.Substring(str.IndexOf(' ') + 1);

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
                switch (cmd)
                {
                    case var _ when String.Equals(cmd, "request", StringComparison.OrdinalIgnoreCase):
                        {
                            var argObj = JsonUtilities.Deserialize(arg, SourceGenerationContext.Default.JsonObject);
                            var msgId = ((long)argObj["_msgid"]!);
                            _ = ProcessReplyableCommandAsync(msgId, (JsonObject)argObj["data"]!);
                        }
                        break;
                    case var _ when String.Equals(cmd, "cancel", StringComparison.OrdinalIgnoreCase):
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
                        break;

                    case var _ when String.Equals(cmd, "closeSqlConnection", StringComparison.OrdinalIgnoreCase):
                        {
                            throw new NotImplementedException();
                        }
                        break;

                    case var _ when String.Equals(cmd, "appReady", StringComparison.OrdinalIgnoreCase):
                        {
                            var wc = _sp.GetRequiredService<IWindowControl>();
                            wc.ApplicationReady();
                        }
                        break;
                    case var _ when String.Equals(cmd, "showDevTools", StringComparison.OrdinalIgnoreCase):
                        {
                            var appConfig = _sp.GetRequiredService<IAppConfiguration>();
                            if (appConfig.EnableDevTools)
                            {
                                var wc = _sp.GetRequiredService<IWindowControl>();
                                wc.ShowDevTools();
                            }
                        }
                        break;

                    case var _ when String.Equals(cmd, "win.minimize", StringComparison.OrdinalIgnoreCase):
                        {
                            var wc = _sp.GetRequiredService<IWindowControl>();
                            wc.Minimize();
                        }
                        break;
                    case var _ when String.Equals(cmd, "win.maximize", StringComparison.OrdinalIgnoreCase):
                        {
                            var wc = _sp.GetRequiredService<IWindowControl>();
                            wc.Maximize();
                        }
                        break;
                    case var _ when String.Equals(cmd, "win.restore", StringComparison.OrdinalIgnoreCase):
                        {
                            var wc = _sp.GetRequiredService<IWindowControl>();
                            wc.Restore();
                        }
                        break;
                    case var _ when String.Equals(cmd, "win.close", StringComparison.OrdinalIgnoreCase):
                        {
                            var wc = _sp.GetRequiredService<IWindowControl>();
                            wc.Close();
                        }
                        break;

                    case var _ when String.Equals(cmd, "log.ChannelMessage", StringComparison.OrdinalIgnoreCase):
                        {
                            var parsedArgs = JsonUtilities.Deserialize<LogChannelMessageArgs>(arg, SourceGenerationContext.Default.LogChannelMessageArgs)!;
                            var clw = _sp.GetRequiredService<IChatLogWriter>();
                            await clw.LogChannelMessageAsync(
                                parsedArgs.MyCharacterName,
                                parsedArgs.ChannelName, parsedArgs.ChannelTitle,
                                parsedArgs.SpeakingCharacter, parsedArgs.CharacterGender, parsedArgs.CharacterStatus,
                                parsedArgs.MessageType, parsedArgs.MessageText, stoppingToken);
                        }
                        break;
                    case var _ when String.Equals(cmd, "log.PMConvoMessage", StringComparison.OrdinalIgnoreCase):
                        {
                            var parsedArgs = JsonUtilities.Deserialize<LogPMConvoMessageArgs>(arg, SourceGenerationContext.Default.LogPMConvoMessageArgs)!;
                            var clw = _sp.GetRequiredService<IChatLogWriter>();
                            await clw.LogPMConvoMessageAsync(
                                parsedArgs.MyCharacterName,
                                parsedArgs.Interlocutor,
                                parsedArgs.SpeakingCharacter, parsedArgs.CharacterGender, parsedArgs.CharacterStatus,
                                parsedArgs.MessageType, parsedArgs.MessageText, stoppingToken);
                        }
                        break;
                    case var _ when String.Equals(cmd, "endCharacterSession", StringComparison.OrdinalIgnoreCase):
                        {
                            var clw = _sp.GetRequiredService<IChatLogWriter>();
                            clw.EndLogSource(arg);
                        }
                        break;

                    case var _ when String.Equals(cmd, "updateAppBadge", StringComparison.OrdinalIgnoreCase):
                        {
                            Console.WriteLine("updateappbadge");
                            var parsedArgs = JsonUtilities.Deserialize<UpdateAppBadgeArgs>(arg, SourceGenerationContext.Default.UpdateAppBadgeArgs)!;
                            Console.WriteLine("parsedArgs.HasPings =" + parsedArgs.HasPings);
                            Console.WriteLine("parsedArgs.HasUnseen =" + parsedArgs.HasUnseen);
                            var nbt = parsedArgs.HasPings ? NotificationBadgeType.PingsWithCount(1) :
                                parsedArgs.HasUnseen ? NotificationBadgeType.Mentions :
                                NotificationBadgeType.None;
                            SetNotificationBadge(nbt);
                        }
                        break;

                    case var _ when String.Equals(cmd, "addIdleMonitorRegistration", StringComparison.OrdinalIgnoreCase):
                        {
                            var parsedArgs = JsonUtilities.Deserialize<AddIdleMonitorRegistrationArgs>(arg, SourceGenerationContext.Default.AddIdleMonitorRegistrationArgs)!;
                            var im = _sp.GetRequiredService<IIdleDetectionManager>();
                            var registration = im.RegisterDisposableCallback(TimeSpan.FromMilliseconds(parsedArgs.IdleAfterMs), (userState, screenState) =>
                            {
                                _ = WriteAsync($"idlemonitorupdate {{ \"monitorName\": \"{parsedArgs.MonitorName}\", \"userState\": \"{userState}\", \"screenState\": \"{screenState}\" }}");
                            });
                            _idleMonitorRegistrations.Add(parsedArgs.MonitorName, registration);
                        }
                        break;
                    case var _ when String.Equals(cmd, "removeIdleMonitorRegistration", StringComparison.OrdinalIgnoreCase):
                        {
                            var parsedArgs = JsonUtilities.Deserialize<RemoveIdleMonitorRegistrationArgs>(arg, SourceGenerationContext.Default.RemoveIdleMonitorRegistrationArgs)!;
                            var im = _sp.GetRequiredService<IIdleDetectionManager>();
                            if (_idleMonitorRegistrations.TryGetValue(parsedArgs.MonitorName, out var registration))
                            {
                                registration.Dispose();
                                _idleMonitorRegistrations.Remove(parsedArgs.MonitorName);
                            }
                        }
                        break;

                    case var _ when String.Equals(cmd, "addUpdateCheckerMonitorRegistration", StringComparison.OrdinalIgnoreCase):
                        {
                            var parsedArgs = JsonUtilities.Deserialize<AddUpdateCheckerMonitorRegistrationArgs>(arg, SourceGenerationContext.Default.AddUpdateCheckerMonitorRegistrationArgs)!;
                            var uc = _sp.GetRequiredService<IUpdateChecker>();
                            var reg = new UpdateCheckerMonitorRegistration(this, uc, parsedArgs.MonitorName);
                            _constituents.Add(reg);
                        }
                        break;
                    case var _ when String.Equals(cmd, "removeUpdateCheckerMonitorRegistration", StringComparison.OrdinalIgnoreCase):
                        {
                            var parsedArgs = JsonUtilities.Deserialize<RemoveUpdateCheckerMonitorRegistrationArgs>(arg, SourceGenerationContext.Default.RemoveUpdateCheckerMonitorRegistrationArgs)!;
                            var maybeReg = _constituents.OfType<UpdateCheckerMonitorRegistration>()
                                .Where(x => String.Equals(x.MonitorName, parsedArgs.MonitorName))
                                .FirstOrDefault();
                            if (maybeReg != null)
                            {
                                _constituents.Remove(maybeReg);
                                maybeReg.Dispose();
                            }
                        }
                        break;
                    case var _ when String.Equals(cmd, "relaunchToApplyUpdate", StringComparison.OrdinalIgnoreCase):
                        {
                            var uc = _sp.GetRequiredService<IUpdateChecker>();
                            uc.IndicateRelaunchOnExit();
                            await this.WriteAsync("relaunchconfirmed");
                        }
                        break;
                    case var _ when String.Equals(cmd, "loginsuccess", StringComparison.OrdinalIgnoreCase):
                        {
                            var uc = _sp.GetRequiredService<IUpdateChecker>();
                            uc.IndicateSuccessfulLogin();
                        }
                        break;

                    case var _ when String.Equals(cmd, "eiconSearch", StringComparison.OrdinalIgnoreCase):
                        {
                            var parsedArgs = JsonUtilities.Deserialize<EIconSearchArgs>(arg, SourceGenerationContext.Default.EIconSearchArgs)!;
                            ThreadPool.QueueUserWorkItem(delegate
                            {
								_ = HandleEIconSearch(parsedArgs, stoppingToken);
							});
                        }
                        break;

                    case var _ when String.Equals(cmd, "eiconSearchClear", StringComparison.OrdinalIgnoreCase):
                        {
                            //var sw = Stopwatch.StartNew();
                            RecycleEIconSearch(null);
                            //sw.Stop();
							//await this.WriteAsync($"eiconSearchClearDone {{ \"took\": {sw.ElapsedMilliseconds} }}");
						}
                        break;

                    case var _ when String.Equals(cmd, "getcssdata", StringComparison.OrdinalIgnoreCase):
                        {
                            var parsedArgs = JsonUtilities.Deserialize<GetCssDataArgs>(arg, SourceGenerationContext.Default.GetCssDataArgs)!;
                            string data;
                            try
                            {
                                data = await GetCssDataAsync(parsedArgs.Url, stoppingToken);
                            }
                            catch
                            {
                                data = "";
                            }
                            await this.WriteAsync("gotcssdata " +
                                JsonUtilities.Serialize(new GotCssDataResult()
                                {
                                    MessageId = parsedArgs.MessageId,
                                    Data = data
                                }, SourceGenerationContext.Default.GotCssDataResult));
                        }
                        break;

                    case var _ when String.Equals(cmd, "getconfig", StringComparison.OrdinalIgnoreCase):
                        {
                            var parsedArgs = JsonUtilities.Deserialize<GetConfigDataArgs>(arg, SourceGenerationContext.Default.GetConfigDataArgs)!;
                            GotConfigDataResult res;
                            try
                            {
                                res = await GetConfigDataAsync(parsedArgs.MessageId, stoppingToken);
                            }
                            catch
                            {
                                res = new GotConfigDataResult() { MessageId = parsedArgs.MessageId, Data = new List<ConfigKeyValue>() };
                            }

                            await this.WriteAsync("gotconfig " +
                                JsonUtilities.Serialize(res, SourceGenerationContext.Default.GotConfigDataResult));
                        }
                        break;
                    case var _ when String.Equals(cmd, "setconfig", StringComparison.OrdinalIgnoreCase):
                        {
                            var parsedArgs = JsonUtilities.Deserialize<ConfigKeyValue>(arg, SourceGenerationContext.Default.ConfigKeyValue)!;
                            await this.SetConfigDataAsync(parsedArgs.Key, parsedArgs.Value, stoppingToken);
                        }
                        break;

                    case var _ when String.Equals(cmd, "getallcss", StringComparison.OrdinalIgnoreCase):
                        {
                            var parsedArgs = JsonUtilities.Deserialize<GetAllCssArgs>(arg, SourceGenerationContext.Default.GetAllCssArgs)!;
                            await this.GetAllCssAsync(parsedArgs.MessageId, stoppingToken);
                        }
                        break;
                }
            }

            //pcsw.Stop();
			//await WriteAsync($"recvack2 {{ \"cmd\": \"{cmd}\", \"took\": {pcsw.ElapsedMilliseconds} }}");
		}

        private async Task<string> GetCssDataAsync(string url, CancellationToken cancellationToken)
        {
            var afs = _sp.GetRequiredService<IAppFileServer>();
            var result = await afs.GetFileContentAsStringAsync(url, cancellationToken);
            return result;
        }

        private async Task<GotConfigDataResult> GetConfigDataAsync(int messageId, CancellationToken cancellationToken)
        {
            var appConfig = _sp.GetRequiredService<IAppConfiguration>();
            var kvps = appConfig.GetAllArbitraryValues();

            var res = new GotConfigDataResult() { MessageId = messageId, Data = new List<ConfigKeyValue>() };
            foreach (var kvp in kvps)
            {
                res.Data.Add(new ConfigKeyValue() { Key = kvp.Key, Value = kvp.Value });
            }
            return res;
        }

        private async Task SetConfigDataAsync(string key, JsonValue value, CancellationToken cancellationToken)
        {
            var appConfig = _sp.GetRequiredService<IAppConfiguration>();
            await appConfig.SetArbitraryValueAsync(key, value, cancellationToken);
        }

        private void ConfigDataChanged(string key, JsonValue? value)
        {
            _ = this.WriteAsync("configchange " + JsonUtilities.Serialize(new ConfigKeyValue()
            {
                Key = key,
                Value = value
            }, SourceGenerationContext.Default.ConfigKeyValue));
        }

        private async Task GetAllCssAsync(int messageId, CancellationToken cancellationToken)
        {
            var result = new GotAllCssResult() { MessageId = messageId, Filenames = new List<string>() };

            var fs = _sp.GetRequiredService<IAppFileServer>();
            var allFiles = await fs.ListFilesAsync(cancellationToken);
            foreach (var fn in allFiles)
            {
                if (fn.EndsWith(".css", StringComparison.OrdinalIgnoreCase))
                {
                    result.Filenames.Add(fn);
                }
            }

            await this.WriteAsync("gotallcss " + JsonUtilities.Serialize(
                result, SourceGenerationContext.Default.GotAllCssResult));
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

        private readonly Dictionary<string, IDisposable> _idleMonitorRegistrations = new Dictionary<string, IDisposable>(StringComparer.OrdinalIgnoreCase);

        private void SetNotificationBadge(NotificationBadgeType type)
        {
            var mgr = _sp.GetRequiredService<INotificationBadgeManager>();
            mgr.SetNotificationBadge(type);
        }

        public override void WindowRestored()
        {
            try
            {
                base.WindowRestored();
                _ = this.WriteAsync("win.restored");
            }
            catch { }
        }

        public override void WindowMinimized()
        {
            try
            {
                base.WindowMinimized();
                _ = this.WriteAsync("win.minimized");
            }
            catch { }
        }

        public override void WindowMaximized()
        {
            try
            {
                base.WindowMaximized();
                _ = this.WriteAsync("win.maximized");
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
            public JsonValue? Value { get; set; }
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
    }

    internal class UpdateCheckerMonitorRegistration : IDisposable
    {
        private readonly IUpdateChecker _updateChecker;
        private readonly WebSocketXCHostSession _xcHostSession;
        private readonly string _monitorName;

        private bool _disposed = false;
        private readonly IDisposable _updateCheckerReg;

        public UpdateCheckerMonitorRegistration(
            WebSocketXCHostSession xcHostSession,
            IUpdateChecker updateChecker,
            string monitorName)
        {
            _xcHostSession = xcHostSession;
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
                _ = _xcHostSession.WriteAsync($"updatecheckerstate {{ \"monitorName\": \"{_monitorName}\", \"state\": \"{_updateChecker.State}\" }}");
            }
            catch { }
        }
    }
}
