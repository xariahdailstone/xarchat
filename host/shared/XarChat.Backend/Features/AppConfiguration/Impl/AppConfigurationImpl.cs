using XarChat.Backend.Features.AppDataFolder;
using XarChat.Backend.Features.CommandLine;
using System.Text.Json;
using XarChat.Backend.Common;
using System.Text.Json.Serialization;
using System.Collections.Immutable;
using System.Text.Json.Nodes;
using System.Threading;

namespace XarChat.Backend.Features.AppConfiguration.Impl
{
    public class AppConfigurationImpl : IAppConfiguration, IDisposable
    {
        private readonly IAppDataFolder _appDataFolder;
        private readonly ICommandLineOptions _commandLineOptions;
        private readonly string _filename;

        private readonly SemaphoreSlim _dataSem = new SemaphoreSlim(1);
        private IImmutableDictionary<string, JsonNode> _appConfigData =
            ImmutableDictionary<string, JsonNode>.Empty;

        private FileSystemWatcher _watcher;

        public AppConfigurationImpl(
            IAppDataFolder appDataFolder,
            ICommandLineOptions commandLineOptions)
        {
            _appDataFolder = appDataFolder;
            _commandLineOptions = commandLineOptions;

            _filename = Path.Combine(appDataFolder.GetAppDataFolder(), "config.json");
            TRYAGAIN:
            if (!File.Exists(_filename))
            {
                if (File.Exists(_filename + ".old"))
                {
                    File.Move(_filename + ".old", _filename);
                    goto TRYAGAIN;
                }
                using var f = File.CreateText(_filename);
                f.Write("{}");
            }

            _watcher = InitializeFileWatcher(_filename);
            LoadAppConfigJson();
        }

        public void Dispose()
        {
            Func<Task>? timerAction = null;
            _dataSem.Wait();
            try
            {
                if (_timer != null && _timerAction != null)
                {
                    timerAction = _timerAction;
                    _timer.Dispose();
                    _timer = null;
                    _timerAction = null;
                }
            }
            finally
            {
                _dataSem.Release();
            }

            if (timerAction != null)
            {
                timerAction().GetAwaiter().GetResult();
            }
        }

        private FileSystemWatcher InitializeFileWatcher(string filename)
        {
            var fsw = new FileSystemWatcher();
            fsw.Path = Path.GetDirectoryName(filename)!;
            fsw.Filter = Path.GetFileName(filename);
            fsw.Changed += (o, e) => { _ = this.FileUpdated(); };
            fsw.Created += (o, e) => { _ = this.FileUpdated(); };
            fsw.Deleted += (o, e) => { _ = this.FileUpdated(); };
            fsw.Renamed += (o, e) => { _ = this.FileUpdated(); };
            fsw.EnableRaisingEvents = true;
            return fsw;
        }

        private object? _lastFileUpdatedKey = null;

        private async Task FileUpdated()
        {
            var myKey = new object();
            _lastFileUpdatedKey = myKey;
            await Task.Delay(100);
            if (_lastFileUpdatedKey != myKey) { return; }

            await _dataSem.WaitAsync();
            try
            {
                LoadAppConfigJson();
            }
            finally
            {
                _dataSem.Release();
            }
        }

        private void LoadAppConfigJson()
        {
            try
            {
                using var f = File.OpenText(_filename);
                var jsonStr = f.ReadToEnd();
                var fdata = JsonUtilities.Deserialize<Dictionary<string, JsonNode>>(jsonStr,
                    SourceGenerationContext.Default.DictionaryStringJsonNode);

                var oldAcd = _appConfigData;
                _appConfigData = fdata.ToImmutableDictionary();
                TriggerChanges(oldAcd, _appConfigData);
            }
            catch
            {
            }
        }

        private void TriggerChanges(
            IImmutableDictionary<string, JsonNode> oldAcd,
            IImmutableDictionary<string, JsonNode> acd)
        {
            var handledKeys = new HashSet<String>();
            foreach (var kvp in oldAcd)
            {
                JsonNode? v;
                if (!acd.TryGetValue(kvp.Key, out v))
                {
                    v = (JsonNode)JsonNode.Parse("null")!;
                }
                handledKeys.Add(kvp.Key);
                if (!AreEqual(kvp.Value, v))
                {
                    TriggerChange(kvp.Key, v);
                }
            }
            foreach (var kvp in acd)
            {
                if (handledKeys.Contains(kvp.Key)) continue;

                JsonNode v;
                if (!oldAcd.TryGetValue(kvp.Key, out v))
                {
                    v = (JsonNode)JsonNode.Parse("null")!;
                }
                handledKeys.Add(kvp.Key);
                if (!AreEqual(kvp.Value, v))
                {
                    TriggerChange(kvp.Key, kvp.Value);
                }
            }
        }

        private bool AreEqual(JsonNode? a, JsonNode? b)
        {
            return ((a?.ToJsonString() ?? "null") == (b?.ToJsonString() ?? "null"));
        }

        private void TriggerChange(string key, JsonNode value)
        {
            var cbs = new List<Action<string, JsonNode>>();
            lock (_valueChangedCallbacks)
            {
                cbs = _valueChangedCallbacks.Values.ToList();
            }

            foreach (var cb in cbs)
            {
                try { cb(key, value); }
                catch { }
            }
        }

        private readonly Dictionary<object, Action<string, JsonNode>> _valueChangedCallbacks
            = new Dictionary<object, Action<string, JsonNode>>();

        public IDisposable OnValueChanged(Action<string, JsonNode?> callback)
        {
            var myKey = new object();
            lock (_valueChangedCallbacks)
            {
                _valueChangedCallbacks.Add(myKey, callback);
            }

            return new ActionDisposable(() =>
            {
                lock (_valueChangedCallbacks)
                {
                    _valueChangedCallbacks.Remove(myKey);
                }
            });
        }

        public IDisposable OnValueChanged(string watchKey, Action<JsonNode?> callback, bool fireImmediately)
        {
            var res = this.OnValueChanged((key, value) =>
            {
                if (String.Equals(key, watchKey, StringComparison.OrdinalIgnoreCase))
                {
                    callback(value);
                }
            });
            if (fireImmediately)
            {
                if (_appConfigData.TryGetValue(watchKey, out var value))
                {
                    callback(value);
                }
                else
                {
                    callback(null);
                }
            }
            return res;
        }

        private System.Threading.Timer? _timer = null;
        private Func<Task>? _timerAction = null;

        private async Task WriteAppConfigJsonAsync(CancellationToken cancellationToken)
        {
            if (_timer == null)
            {
                _timerAction = async () =>
                {
                    await _dataSem.WaitAsync(cancellationToken);
                    try
                    {
                        _timer?.Dispose();
                        _timer = null;

                        System.Diagnostics.Debug.WriteLine($"writing config.json {DateTime.UtcNow}");

                        _watcher.EnableRaisingEvents = false;
                        try
                        {
                            var tmpFn = _filename + ".tmp";
                            var oldFn = _filename + ".old";

                            if (File.Exists(tmpFn))
                            {
                                File.Delete(tmpFn);
                            }
                            if (File.Exists(oldFn))
                            {
                                File.Delete(oldFn);
                            }

                            using (var f = File.Create(tmpFn))
                            {
                                using var jw = new Utf8JsonWriter(f, new JsonWriterOptions() { Indented = true });
                                JsonUtilities.Serialize(jw, _appConfigData!, SourceGenerationContext.Default.IImmutableDictionaryStringJsonNode);
                            }

                            File.Move(_filename, oldFn);
                            File.Move(tmpFn, _filename);
                            File.Delete(oldFn);
                        }
                        catch
                        {

                        }
                        finally
                        {
                            _watcher.EnableRaisingEvents = true;
                        }
                    }
                    finally
                    {
                        _dataSem.Release();
                    }
                };
                _timer = new Timer((_) =>
                {
                    _timerAction?.Invoke();
                });
            }
            _timer.Change(TimeSpan.FromSeconds(1), Timeout.InfiniteTimeSpan);
        }


        private string? NullIfWhiteSpace(string? str) => String.IsNullOrWhiteSpace(str) ? null : str;

        public string WebSocketPath =>
            NullIfWhiteSpace(_commandLineOptions.WebSocketPath) ??
            NullIfWhiteSpace(GetArbitraryValueString("WebSocketPath")) ??
            "wss://chat.f-list.net/chat2";

        public string UrlLaunchExecutable =>
            NullIfWhiteSpace(_commandLineOptions.UrlLaunchExecutable) ??
            NullIfWhiteSpace(GetArbitraryValueString("UrlLaunchExecutable")) ??
            "shell:";

        public bool LaunchImagesInternally =>
            _commandLineOptions.LaunchImagesInternally ??
            Convert.ToBoolean(GetArbitraryValueString("LaunchImagesInternally") ?? "true");

        // TODO:
        public string ContentDirectory =>
            NullIfWhiteSpace(_commandLineOptions.UnpackedContentPath) ??
            NullIfWhiteSpace(GetArbitraryValueString("ContentDirectory")) ??
            "res:content.dat";

        public bool EnableDevTools =>
            (_commandLineOptions.EnableDevTools ?? false) ||
            Convert.ToBoolean(GetArbitraryValueString("EnableDevTools") ??
#if DEBUG
            "true"
#else
            "false"
#endif
            );

		public bool EnableIndexDataCollection =>
			Convert.ToBoolean(GetArbitraryValueString("EnableIndexDataCollection") ?? "true");

		public IEnumerable<KeyValuePair<string, JsonNode>> GetAllArbitraryValues()
        {
            var acd = _appConfigData;
            return acd;
        }

        public JsonNode GetArbitraryValue(string key)
        {
            if (!_appConfigData.TryGetValue(key, out var value))
            {
                return (JsonNode)JsonNode.Parse("null")!;
            }
            return value;
        }

        public string? GetArbitraryValueString(string key)
        {
            return JsonNodeToString(GetArbitraryValue(key));
        }

        private string? JsonNodeToString(JsonNode? jsonValue)
        {
            if (jsonValue == null)
            {
                return null;
            }

            switch (jsonValue.GetValueKind())
            {
                case JsonValueKind.Null:
                    return null;
                default:
                    return jsonValue.ToString();
            }
        }

        public async Task SetArbitraryValueAsync(string key, JsonNode? value, CancellationToken cancellationToken)
        {
            await _dataSem.WaitAsync(cancellationToken);
            try
            {
                if (!_appConfigData.TryGetValue(key, out var existingValue) || existingValue != value)
                {
                    if (value is null || value.GetValueKind() == JsonValueKind.Null)
                    {
                        _appConfigData = _appConfigData.Remove(key);
                    }
                    else
                    {
                        _appConfigData = _appConfigData.SetItem(key, value);
                    }
                    TriggerChange(key, value);
                    await WriteAppConfigJsonAsync(CancellationToken.None);
                }
            }
            finally
            {
                _dataSem.Release();
            }
        }
    }

    public class AppConfigurationJson
    {
        public string? WebSocketPath { get; set; }

        public string? UrlLaunchExecutable { get; set; }

        public bool? LaunchImagesInternally { get; set; }

        public string? ContentDirectory { get; set; }

        public bool? EnableDevTools { get; set; }

        public string? AutoUpdateUrl { get; set; }

        public int? AutoUpdateCheckInterval { get; set; }

    }
}
