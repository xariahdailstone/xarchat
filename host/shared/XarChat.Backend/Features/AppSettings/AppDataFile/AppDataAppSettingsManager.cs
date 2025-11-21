using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices.JavaScript;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using XarChat.Backend.Common;
using XarChat.Backend.Features.AppDataFolder;
using XarChat.Backend.UrlHandlers.AppSettings;
using static XarChat.Backend.UrlHandlers.AppSettings.AppSettingsExtensions;

namespace XarChat.Backend.Features.AppSettings.AppDataFile
{
    internal class RotatingJsonManager
    {
        private readonly SemaphoreSlim _writeLock = new SemaphoreSlim(1);
        private int _lastWriteId = 0;

        private readonly IAppSettingsDataProtectionManager? _dataProtectionManager;
        private readonly string _baseName;

        public RotatingJsonManager(
            IAppSettingsDataProtectionManager? dataProtectionManager,
            string baseName)
        {
            _dataProtectionManager = dataProtectionManager;
            _baseName = baseName;
        }

        private string CurrentFileName => _baseName;
        private string NewFileName => _baseName + ".next";
        private string PreviousFileName => _baseName + ".previous";

        private JsonObject? DeserializeFileContent(string? json)
        {
            if (String.IsNullOrWhiteSpace(json)) return null;

            var result = JsonUtilities.Deserialize<JsonObject>(json, SourceGenerationContext.Default.JsonObject);
            UnprotectStringsRecursive(result);
            return result;
        }

        private string? UnprotectString(string? str)
        {
            if (_dataProtectionManager == null) { return str; }

            return _dataProtectionManager!.Decode(str);
        }

        private string? ProtectString(string? str)
        {
            if (_dataProtectionManager == null) { return str; }

            return _dataProtectionManager.Encode(str);
        }

        private void ProtectStringsRecursive(JsonObject jobj)
        {
            foreach (var kvp in jobj.ToArray())
            {
                var v = kvp.Value;
                if (v is JsonObject vobj)
                {
                    ProtectStringsRecursive(vobj);
                }
                else if (v is JsonArray varr)
                {
                    for (var i = 0; i < varr.Count; i++)
                    {
                        if (varr[i] is JsonObject varrObj)
                        {
                            ProtectStringsRecursive(varrObj);
                        }
                        else
                        {
                            MaybeProtectJsonString(null, varr[i],
                                p => varr[i] = p);
                        }
                    }
                }
                else
                {
                    MaybeProtectJsonString(kvp.Key, v,
                            p => jobj[kvp.Key] = p);
                }
            }
        }

        private string SerializeFileData(JsonObject jsonObject)
        {
            var copiedSettings = (JsonObject)jsonObject.DeepClone()!;
            ProtectStringsRecursive(copiedSettings);
            var result = JsonUtilities.Serialize<JsonObject>(copiedSettings, SourceGenerationContext.Default.JsonObject);
            return result;
        }

        private void MaybeProtectJsonString(string? propertyName, JsonNode? v, Action<string?> onProtect)
        {
            if (v?.GetValueKind() == JsonValueKind.String)
            {
                var str = v.ToString();
                if (str.StartsWith("unprotected::"))
                {
                    str = "protected::" + ProtectString(str.Substring("unprotected::".Length));
                }
                else if (propertyName == "password")
                {
                    str = ProtectString(str);
                }
                onProtect(str);
            }
        }

        private void UnprotectStringsRecursive(JsonObject result)
        {
            foreach (var kvp in result.ToArray())
            {
                var v = kvp.Value;
                if (v is JsonObject vobj)
                {
                    UnprotectStringsRecursive(vobj);
                }
                if (v is JsonArray varr)
                {
                    for (var i = 0; i < varr.Count; i++)
                    {
                        if (varr[i] is JsonObject varrobj)
                        {
                            UnprotectStringsRecursive(varrobj);
                        }
                        else
                        {
                            MaybeUnprotectJsonString(null, varr[i],
                                unprotected => varr[i] = unprotected);
                        }
                    }
                }
                else
                {
                    MaybeUnprotectJsonString(kvp.Key, v,
                        unproected => result[kvp.Key] = unproected);
                }
            }
        }

        private void MaybeUnprotectJsonString(string? propertyName, JsonNode? v, Action<string?> onUnprotect)
        {
            if (v?.GetValueKind() == JsonValueKind.String)
            {
                var str = v.ToString();
                if (str.StartsWith("protected::"))
                {
                    str = "unprotected::" + UnprotectString(str.Substring("protected::".Length));
                }
                else if (propertyName == "password")
                {
                    str = UnprotectString(str);
                }
                onUnprotect(str);
            }
        }

        public JsonObject? ReadFromFile()
        {
            _writeLock.Wait();
            try
            {
                foreach (var t in new[]
                {
                    new { Filename = this.CurrentFileName, NeedWrite = false },
                    new { Filename = this.NewFileName, NeedWrite = false },
                    new { Filename = this.PreviousFileName, NeedWrite = false }
                })
                {
                    if (File.Exists(t.Filename))
                    {
                        try
                        {
                            JsonObject? tcontent;
                            using (var fr = File.OpenText(t.Filename))
                            {
                                var json = fr.ReadToEnd();
                                tcontent = DeserializeFileContent(json);
                            }
                            if (tcontent != null)
                            {
                                if (t.Filename != this.CurrentFileName)
                                {
                                    try
                                    {
                                        if (File.Exists(this.CurrentFileName))
                                        {
                                            FileSystemUtil.Delete(this.CurrentFileName);
                                        }
                                        File.Move(t.Filename, this.CurrentFileName);
                                    }
                                    catch { }
                                }

                                return tcontent;
                            }
                        }
                        catch { }
                    }
                }
            }
            finally
            {
                _writeLock.Release();
            }

            return null;
        }

        public async Task WriteToFileAsync(JsonObject value)
        {
            var myWriteId = Interlocked.Increment(ref _lastWriteId);
            await _writeLock.WaitAsync();
            try
            {
                if (_lastWriteId != myWriteId) return;

                if (File.Exists(this.NewFileName))
                {
                    await FileSystemUtil.DeleteAsync(this.NewFileName);
                }

                using var writer = File.CreateText(this.NewFileName);

                await writer.WriteAsync(SerializeFileData(value));
                await writer.FlushAsync();
                await writer.DisposeAsync();

                if (File.Exists(this.PreviousFileName))
                {
                    await FileSystemUtil.DeleteAsync(this.PreviousFileName);
                }
                if (File.Exists(this.CurrentFileName))
                {
                    File.Move(this.CurrentFileName, this.PreviousFileName);
                }
                File.Move(this.NewFileName, this.CurrentFileName);
            }
            finally
            {
                _writeLock.Release();
            }
        }
    }

    internal class AppDataAppSettingsManager : IAppSettingsManager, IDisposable
    {
        private readonly IAppDataFolder _appDataFolder;
        private readonly IAppSettingsDataProtectionManager _dataProtectionManager;

        private SemaphoreSlim _writeLock = new SemaphoreSlim(1);

        private readonly RateLimiter _rateLimiter;

        private readonly RotatingJsonManager _jsonManager;

        public AppDataAppSettingsManager(
            IAppDataFolder appDataFolder,
            IAppSettingsDataProtectionManager dataProtectionManager)
        {
            _appDataFolder = appDataFolder;
            _dataProtectionManager = dataProtectionManager;

            _rateLimiter = new RateLimiter(TimeSpan.FromSeconds(5));

            _jsonManager = new RotatingJsonManager(dataProtectionManager, GetSettingsFileName());
        }

        public void Dispose()
        {
            _rateLimiter.Dispose();
            _pendingSaveEvent.Wait();
        }

        private string GetSettingsFileName()
        {
            var result = Path.Combine(_appDataFolder.GetAppDataFolder(), "clientsettings.json");

            if (!Directory.Exists(Path.GetDirectoryName(result)))
            {
                Directory.CreateDirectory(Path.GetDirectoryName(result)!);
            }

            return result;
        }

        public AppSettingsData GetAppSettings()
        {
            var raw = GetAppSettingsDataRaw();
            var result = JsonSerializer.Deserialize<AppSettingsData>(raw)!;
            return result;
        }

        public JsonObject GetAppSettingsDataRaw()
        {
            var settingsFn = GetSettingsFileName();

            JsonObject? settings = null;
            var needWrite = false;

            settings = _jsonManager.ReadFromFile();

            if (settings == null)
            {
                settings =
                    JsonSerializer.Deserialize<JsonObject>(
                        JsonSerializer.Serialize(new AppSettingsData(), SourceGenerationContext.Default.AppSettingsData),
                        SourceGenerationContext.Default.JsonObject)!;
                needWrite = true;
            }

            if (needWrite)
            {
                _ = Task.Run(async () =>
                {
                    await SaveAppSettings(settings);
                });
            }

            return settings!;
        }

        private object? _latestSerialize = null;

        private object _pendingSaveLock = new object();
        private int _pendingSaveCount = 0;
        private ManualResetEventSlim _pendingSaveEvent = new ManualResetEventSlim(true);

        private async Task SaveAppSettings(JsonObject jsonObject)
        {
            var mySerializeKey = new object();
            _latestSerialize = mySerializeKey;

            lock (_pendingSaveLock)
            {
                _pendingSaveCount++;
                _pendingSaveEvent.Reset();
            }

            _ = Task.Run(async () =>
            {
                await _rateLimiter.ExecuteAsync(async () =>
                {
                    try
                    {
                        if (Object.ReferenceEquals(_latestSerialize, mySerializeKey))
                        {
                            System.Diagnostics.Debug.WriteLine("Writing AppSettings");
                            await SaveAppSettingsInternal(jsonObject);
                            return true;
                        }
                        else
                        {
                            System.Diagnostics.Debug.WriteLine("Skipping write of AppSettings, newer request pending");
                            return false;
                        }
                    }
                    finally
                    {
                        lock (_pendingSaveLock)
                        {
                            _pendingSaveCount--;
                            if (_pendingSaveCount == 0)
                            {
                                _pendingSaveEvent.Set();
                            }
                        }
                    }
                }, CancellationToken.None);
            });
        }

        private async Task SaveAppSettingsInternal(JsonObject jsonObject)
        {
            await _jsonManager.WriteToFileAsync(jsonObject);
        }

        public AppSettingsData GetAppSettingsData()
        {
            var result = GetAppSettings();
            return result;
        }

        public async Task UpdateAppSettingsData(JsonObject jsonObject, CancellationToken cancellationToken)
        {
            await this.SaveAppSettings(jsonObject);
        }
    }

    internal class RateLimiter : IDisposable
    {
        private readonly TimeSpan _cooldownInterval;
        private readonly SemaphoreSlim _executeLock = new SemaphoreSlim(1);
        private DateTime _nextExecuteAt = DateTime.MinValue;

        private readonly CancellationTokenSource _disposeCTS = new CancellationTokenSource();

        public RateLimiter(TimeSpan cooldownInterval)
        {
            _cooldownInterval = cooldownInterval;
        }

        public void Dispose()
        {
            if (!_disposeCTS.IsCancellationRequested)
            {
                _disposeCTS.Cancel();
            }
        }

        public async Task ExecuteAsync(Func<Task<bool>> func, CancellationToken cancellationToken)
        {
            while (true)
            {
                var timeRemain = _nextExecuteAt - DateTime.UtcNow;
                if (!_disposeCTS.IsCancellationRequested && timeRemain > TimeSpan.Zero)
                {
                    using var cct = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, _disposeCTS.Token);
                    try
                    {
                        await Task.Delay(timeRemain, cct.Token);
                    }
                    catch (OperationCanceledException) when (_disposeCTS.IsCancellationRequested)
                    {
                    }
                }

                await _executeLock.WaitAsync(cancellationToken);
                try
                {
                    timeRemain = _nextExecuteAt - DateTime.UtcNow;
                    if (_disposeCTS.IsCancellationRequested || timeRemain <= TimeSpan.Zero)
                    {
                        var shouldRateLimit = false;
                        try
                        {
                            shouldRateLimit = await func();
                        }
                        finally
                        {
                            if (shouldRateLimit)
                            {
                                _nextExecuteAt = DateTime.UtcNow + _cooldownInterval;
                            }
                        }
                        return;
                    }
                }
                finally
                {
                    _executeLock.Release();
                }
            }
        }
    }
}
