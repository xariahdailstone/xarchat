using XarChat.Backend.Features.AppDataFolder;
using XarChat.Backend.Features.CommandLine;
using System.Text.Json;
using XarChat.Backend.Common;
using System.Text.Json.Serialization;
using System.Collections.Immutable;
using System.Text.Json.Nodes;
using System.Threading;
using XarChat.Backend.Features.AppSettings.AppDataFile;

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

        private readonly RotatingJsonManager _jsonManager;

        public AppConfigurationImpl(
            IAppDataFolder appDataFolder,
            ICommandLineOptions commandLineOptions)
        {
            _appDataFolder = appDataFolder;
            _commandLineOptions = commandLineOptions;

            _filename = Path.Combine(appDataFolder.GetAppDataFolder(), "config.json");
            _jsonManager = new RotatingJsonManager(null, _filename);

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
                var jsonObj = _jsonManager.ReadFromFile();

                var jsonStr = JsonUtilities.Serialize(jsonObj,
                    SourceGenerationContext.Default.JsonObject);
                var fdata = JsonUtilities.Deserialize<Dictionary<string, JsonNode>>(jsonStr,
                    SourceGenerationContext.Default.DictionaryStringJsonNode);

                var oldAcd = _appConfigData;
                _appConfigData = fdata.ToImmutableDictionary();
                TriggerChanges(oldAcd, _appConfigData, null);
            }
            catch
            {
            }
        }

        private void TriggerChanges(
            IImmutableDictionary<string, JsonNode> oldAcd,
            IImmutableDictionary<string, JsonNode> acd,
            Dictionary<string, object?>? changeMetadata)
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
                    TriggerChange(kvp.Key, v, changeMetadata);
                }
            }
            foreach (var kvp in acd)
            {
                if (handledKeys.Contains(kvp.Key)) continue;

                JsonNode? v;
                if (!oldAcd.TryGetValue(kvp.Key, out v))
                {
                    v = (JsonNode)JsonNode.Parse("null")!;
                }
                handledKeys.Add(kvp.Key);
                if (!AreEqual(kvp.Value, v))
                {
                    TriggerChange(kvp.Key, kvp.Value, changeMetadata);
                }
            }
        }

        private bool AreEqual(JsonNode? a, JsonNode? b)
        {
            return ((a?.ToJsonString() ?? "null") == (b?.ToJsonString() ?? "null"));
        }

        private void TriggerChange(string key, JsonNode? value, Dictionary<string, object?>? changeMetadata)
        {
            var cbs = new List<Action<string, JsonNode?, Dictionary<string, object?>?>>();
            lock (_valueChangedCallbacks)
            {
                cbs = _valueChangedCallbacks.Values.ToList();
            }

            foreach (var cb in cbs)
            {
                try { cb(key, value, changeMetadata); }
                catch { }
            }
        }

        private readonly Dictionary<object, Action<string, JsonNode?, Dictionary<string, object?>?>> _valueChangedCallbacks
            = new Dictionary<object, Action<string, JsonNode?, Dictionary<string, object?>?>>();

        public IDisposable OnValueChanged(Action<string, JsonNode?, Dictionary<string, object?>?> callback)
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

        public IDisposable OnValueChanged(string watchKey, Action<JsonNode?, Dictionary<string, object?>?> callback, bool fireImmediately)
        {
            var res = this.OnValueChanged((key, value, changeMetadata) =>
            {
                if (String.Equals(key, watchKey, StringComparison.OrdinalIgnoreCase))
                {
                    callback(value, changeMetadata);
                }
            });
            if (fireImmediately)
            {
                if (_appConfigData.TryGetValue(watchKey, out var value))
                {
                    callback(value, null);
                }
                else
                {
                    callback(null, null);
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
                            var jsonStr = JsonUtilities.Serialize(_appConfigData!, SourceGenerationContext.Default.IImmutableDictionaryStringJsonNode);
                            var jsonObj = JsonUtilities.Deserialize<JsonObject>(jsonStr, SourceGenerationContext.Default.JsonObject);
                            await _jsonManager.WriteToFileAsync(jsonObj);
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

        public string UrlLaunchExecutable
        {
            get
            {
                string EmptyAsShell(string str)
                    => (str.Trim() == "") ? "shell:" : str;

                var commandLineOption = _commandLineOptions.UrlLaunchExecutable;
                if (commandLineOption is not null)
                {
                    return EmptyAsShell(commandLineOption);
                }

                var configedValue = GetArbitraryValueString("global.urlLaunchExecutable");
                if (configedValue is not null)
                {
                    return EmptyAsShell(configedValue);
                }

                var legacyConfigedValue = GetArbitraryValueString("UrlLaunchExecutable");
                if (legacyConfigedValue is not null)
                {
                    return EmptyAsShell(legacyConfigedValue);
                }

                return "shell:";
            }
        }
            

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

        public bool DisableGpuAcceleration =>
            (_commandLineOptions.DisableGpuAcceleration == true) ? true :
            !(Convert.ToBoolean(GetArbitraryValueString("global.useGpuAcceleration") ?? "true"));

        public string? BrowserLanguage =>
            _commandLineOptions.BrowserLanguage ??
            GetArbitraryValueString("global.spellCheckLanguage") ??
            null;

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

        public async Task SetArbitraryValueAsync(string key, JsonNode? value, Dictionary<string, object?>? changeMetadata, CancellationToken cancellationToken)
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
                    TriggerChange(key, value, changeMetadata);
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
