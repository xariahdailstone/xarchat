using System;
using System.Collections.Generic;
using System.Linq;
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
    internal class AppDataAppSettingsManager : IAppSettingsManager, IDisposable
    {
        private readonly IAppDataFolder _appDataFolder;
        private readonly IAppSettingsDataProtectionManager _dataProtectionManager;

        private SemaphoreSlim _writeLock = new SemaphoreSlim(1);
        private int _lastWriteId = 0;

        private readonly RateLimiter _rateLimiter;

        public AppDataAppSettingsManager(
            IAppDataFolder appDataFolder,
            IAppSettingsDataProtectionManager dataProtectionManager)
        {
            _appDataFolder = appDataFolder;
            _dataProtectionManager = dataProtectionManager;

            _rateLimiter = new RateLimiter(TimeSpan.FromSeconds(5));
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
            JsonObject? settings = null;
            var needWrite = false;

            var settingsFn = GetSettingsFileName();
            var settingsOldFn = settingsFn + ".old";

            _writeLock.Wait();
            try
            {
                if (File.Exists(settingsFn))
                {
                    try
                    {
                        using var fr = File.OpenText(settingsFn);
                        var json = fr.ReadToEnd();
                        settings = DeserializeAppSettings(json);
                    }
                    catch { }
                }
                if (settings == null && File.Exists(settingsOldFn))
                {
                    try
                    {
                        using var fr = File.OpenText(settingsOldFn);
                        var json = fr.ReadToEnd();
                        settings = DeserializeAppSettings(json);
                        needWrite = true;
                    }
                    catch { }
                }
            }
            finally
            {
                _writeLock.Release();
            }

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

        private JsonObject? DeserializeAppSettings(string? json)
        {
            if (String.IsNullOrWhiteSpace(json)) return null;

            var result = JsonUtilities.Deserialize<JsonObject>(json, SourceGenerationContext.Default.JsonObject);
            UnprotectStringsRecursive(result);
            return result;
        }

        private string SerializeAppSettings(JsonObject jsonObject)
        {
            var copiedSettings = (JsonObject)jsonObject.DeepClone()!;
            ProtectStringsRecursive(copiedSettings);
            var result = JsonUtilities.Serialize<JsonObject>(copiedSettings, SourceGenerationContext.Default.JsonObject);
            return result;
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

        private string? UnprotectString(string? str)
        {
            return _dataProtectionManager!.Decode(str);
        }

        private string? ProtectString(string? str)
        {
            return _dataProtectionManager.Encode(str);
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
            var myWriteId = Interlocked.Increment(ref _lastWriteId);
            await _writeLock.WaitAsync();
            try
            {
                if (_lastWriteId != myWriteId) return;

                var sfn = GetSettingsFileName();

                if (File.Exists(sfn + ".tmp"))
                {
                    File.Delete(sfn + ".tmp");
                }

                using var writer = File.CreateText(sfn + ".tmp");

                //await writer.WriteAsync(JsonConvert.SerializeObject(appSettingsData, Formatting.Indented));
                await writer.WriteAsync(SerializeAppSettings(jsonObject));
                await writer.FlushAsync();
                await writer.DisposeAsync();

                if (File.Exists(sfn + ".old"))
                {
                    File.Delete(sfn + ".old");
                }
                if (File.Exists(sfn))
                {
                    File.Move(sfn, sfn + ".old");
                }
                File.Move(sfn + ".tmp", sfn);
                if (File.Exists(sfn + ".old"))
                {
                    File.Delete(sfn + ".old");
                }
            }
            finally
            {
                _writeLock.Release();
            }
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
