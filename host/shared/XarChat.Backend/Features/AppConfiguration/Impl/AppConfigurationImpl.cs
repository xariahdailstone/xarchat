﻿using XarChat.Backend.Features.AppDataFolder;
using XarChat.Backend.Features.CommandLine;
using System.Text.Json;
using XarChat.Backend.Common;
using System.Text.Json.Serialization;
using System.Collections.Immutable;
using System.Text.Json.Nodes;

namespace XarChat.Backend.Features.AppConfiguration.Impl
{
    public class AppConfigurationImpl : IAppConfiguration
    {
        private readonly IAppDataFolder _appDataFolder;
        private readonly ICommandLineOptions _commandLineOptions;
        private readonly string _filename;

        private readonly SemaphoreSlim _dataSem = new SemaphoreSlim(1);
        private IImmutableDictionary<string, JsonValue> _appConfigData =
            ImmutableDictionary<string, JsonValue>.Empty;

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
                var fdata = JsonUtilities.Deserialize<Dictionary<string, JsonValue>>(jsonStr,
                    SourceGenerationContext.Default.DictionaryStringJsonValue);

                var oldAcd = _appConfigData;
                _appConfigData = fdata.ToImmutableDictionary();
                TriggerChanges(oldAcd, _appConfigData);
            }
            catch
            {
            }
        }

        private void TriggerChanges(
            IImmutableDictionary<string, JsonValue> oldAcd,
            IImmutableDictionary<string, JsonValue> acd)
        {
            var handledKeys = new HashSet<String>();
            foreach (var kvp in oldAcd)
            {
                JsonValue? v;
                if (!acd.TryGetValue(kvp.Key, out v))
                {
                    v = (JsonValue)JsonValue.Parse("null")!;
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

                JsonValue v;
                if (!oldAcd.TryGetValue(kvp.Key, out v))
                {
                    v = (JsonValue)JsonValue.Parse("null")!;
                }
                handledKeys.Add(kvp.Key);
                if (!AreEqual(kvp.Value, v))
                {
                    TriggerChange(kvp.Key, kvp.Value);
                }
            }
        }

        private bool AreEqual(JsonValue? a, JsonValue? b)
        {
            return ((a?.ToJsonString() ?? "null") == (b?.ToJsonString() ?? "null"));
        }

        private void TriggerChange(string key, JsonValue value)
        {
            var cbs = new List<Action<string, JsonValue>>();
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

        private readonly Dictionary<object, Action<string, JsonValue>> _valueChangedCallbacks
            = new Dictionary<object, Action<string, JsonValue>>();

        public IDisposable OnValueChanged(Action<string, JsonValue> callback)
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

        private async Task WriteAppConfigJsonAsync(CancellationToken cancellationToken)
        {
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
                    using var jw = new Utf8JsonWriter(f);
                    JsonUtilities.Serialize(jw, _appConfigData!, SourceGenerationContext.Default.IImmutableDictionaryStringJsonValue);
                }

                File.Move(_filename, oldFn);
                File.Move(tmpFn, _filename);
                File.Delete(oldFn);
            }
            catch
            {

            }
        }


        private string? NullIfWhiteSpace(string? str) => String.IsNullOrWhiteSpace(str) ? null : str;

        public string WebSocketPath =>
            NullIfWhiteSpace(_commandLineOptions.WebSocketPath) ??
            NullIfWhiteSpace(GetArbitraryValueString("WebSocketPath")) ??
            "wss://chat.f-list.net/chat2";

        //public string WebSocketPath { get; set; } = "wss://flprox.evercrest.com/connect";

        public string UrlLaunchExecutable =>
            NullIfWhiteSpace(_commandLineOptions.UrlLaunchExecutable) ??
            NullIfWhiteSpace(GetArbitraryValueString("UrlLaunchExecutable")) ??
            "shell:";

        //public string UrlLaunchExecutable { get; set; } = @"""C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"" ""--profile-directory=Profile 1"" %s";

        public bool LaunchImagesInternally =>
            _commandLineOptions.LaunchImagesInternally ??
            Convert.ToBoolean(GetArbitraryValueString("LaunchImagesInternally") ?? "true");

        // TODO:
        public string ContentDirectory =>
            NullIfWhiteSpace(_commandLineOptions.UnpackedContentPath) ??
            NullIfWhiteSpace(GetArbitraryValueString("ContentDirectory")) ??
            "res:content.dat";

        //public string ContentDirectory { get; set; } = "E:\\Megarepo\\src\\apps\\fchat\\XarChat\\Interface";

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

		public IEnumerable<KeyValuePair<string, JsonValue>> GetAllArbitraryValues()
        {
            var acd = _appConfigData;
            return acd;
        }

        public JsonValue GetArbitraryValue(string key)
        {
            if (!_appConfigData.TryGetValue(key, out var value))
            {
                return (JsonValue)JsonValue.Parse("null")!;
            }
            return value;
        }

        public string? GetArbitraryValueString(string key)
        {
            return JsonValueToString(GetArbitraryValue(key));
        }

        private string? JsonValueToString(JsonValue? jsonValue)
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

        public async Task SetArbitraryValueAsync(string key, JsonValue value, CancellationToken cancellationToken)
        {
            await _dataSem.WaitAsync(cancellationToken);
            try
            {
                _watcher.EnableRaisingEvents = false;
                try
                {
                    if (!_appConfigData.TryGetValue(key, out var existingValue) || existingValue != value)
                    {
                        _appConfigData = _appConfigData.SetItem(key, value);
                        TriggerChange(key, value);
                        await WriteAppConfigJsonAsync(CancellationToken.None);
                    }
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