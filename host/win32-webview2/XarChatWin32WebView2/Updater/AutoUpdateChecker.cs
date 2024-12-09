using MinimalWin32Test.Properties;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using System.Web;
using XarChat.Backend.Common;
using XarChat.Backend.Features.UpdateChecker;

namespace MinimalWin32Test.Updater
{
    public class AutoUpdateChecker : IUpdateChecker, IDisposable, IAsyncDisposable
    {
        private readonly string _profileDirectory;
        private readonly string? _originalExePath;

        private UpdateCheckerState _state = UpdateCheckerState.CheckingForUpdates;
        private IImmutableSet<Action> _onStateChangeHandlers = ImmutableHashSet<Action>.Empty;

        private bool _alreadyHandledSuccessfulLogin = false;

        private readonly CancellationTokenSource _disposeCTS = new CancellationTokenSource();
        private readonly Task _processingLoopTask;

        public AutoUpdateChecker(string[] args, string profileDirectory)
        {
            _profileDirectory = profileDirectory;

            var shouldDoCheck = true;
            foreach (var arg in args)
            {
                if (arg.ToLower() == "--skipupdatecheck")
                {
                    this.State = UpdateCheckerState.NoUpdatesAvailable;
                    shouldDoCheck = false;
                }
                else if (arg.ToLower().StartsWith("--origexepath="))
                {
                    _originalExePath = arg.Substring("--origexepath=".Length);
                }
            }

            _processingLoopTask = ProcessingLoopAsync(shouldDoCheck, _disposeCTS.Token);
        }

        public void Dispose()
        {
            DisposeAsync().AsTask().GetAwaiter().GetResult();
        }

        public async ValueTask DisposeAsync()
        {
            if (!_disposeCTS.IsCancellationRequested)
            {
                _disposeCTS.Cancel();

                try
                {
                    await _processingLoopTask;
                }
                catch { }
            }
        }

        public bool RelaunchOnExit { get; private set; } = false;

        public void IndicateRelaunchOnExit()
        {
            this.RelaunchOnExit = true;
        }

        public void IndicateSuccessfulLogin()
        {
            if (!_alreadyHandledSuccessfulLogin)
            {
                _alreadyHandledSuccessfulLogin = true;

                // Try to update original launch EXE
                TryUpdateOriginalLaunchExe();

                // Remove older download folders
                RemoveOlderDownloadFolders();
            }
        }

        private void RemoveOlderDownloadFolders()
        {
            try
            {
                var myVersion = new Version(AssemblyVersionInfo.XarChatVersion);

                var dirName = Path.Combine(_profileDirectory, "updates");
                foreach (var subDirName in Directory.GetDirectories(dirName))
                {
                    var subDirNameBase = Path.GetFileName(subDirName);
                    Version? subDirVersion = null;
                    try
                    {
                        subDirVersion = new Version(subDirNameBase);
                    }
                    catch
                    {
                        subDirVersion = null;
                    }
                    if (subDirVersion == null || myVersion <= subDirVersion)
                    {
                        continue;
                    }

                    try
                    {
                        Directory.Delete(subDirNameBase, true);
                    }
                    catch { }
                }
            }
            catch { }
        }

        private void TryUpdateOriginalLaunchExe()
        {
            try
            {
                var newExePath = System.Reflection.Assembly.GetEntryAssembly()?.Location;

                if (_originalExePath != null && newExePath != null)
                {
                    var origDir = Path.GetDirectoryName(_originalExePath)!;
                    var tmpFn = Path.Combine(origDir, "__XarChat.update");
                    var tmpOldFn = Path.Combine(origDir, "__XarChat.update");
                    if (File.Exists(tmpFn))
                    {
                        File.Delete(tmpFn);
                    }

                    File.Copy(newExePath, tmpFn);
                    File.Move(_originalExePath, tmpOldFn);
                    try
                    {
                        File.Move(tmpFn, newExePath);
                    }
                    catch
                    {
                        File.Move(tmpOldFn, _originalExePath);
                    }
                }
            }
            catch { }
        }

        private async Task ProcessingLoopAsync(bool shouldDoCheck, CancellationToken cancellationToken)
        {
            while (true)
            {
                if (shouldDoCheck)
                {
                    await CheckForUpdateAsync(cancellationToken);
                }
                await Task.Delay(TimeSpan.FromHours(1), cancellationToken);
            }
        }

        private async Task CheckForUpdateAsync(CancellationToken cancellationToken)
        {
            this.State = UpdateCheckerState.CheckingForUpdates;
            var hasUpdate = false;
            var mustUpdate = false;

            try
            {
                var myVersion = AssemblyVersionInfo.XarChatVersion;
                var myPlatform = "win-x64";
                var updateCheckUrl = $"https://xariah.net/xarchat/api/GetUpdateInfo" +
                    $"?rv=1" + 
                    $"&branch={HttpUtility.UrlEncode(AssemblyVersionInfo.XarChatBranch)}" +
                    $"&platform={HttpUtility.UrlEncode(myPlatform)}" +
                    $"&version={HttpUtility.UrlEncode(myVersion)}";

                var updateCheckResult = await PerformUpdateManifestCheckAsync(updateCheckUrl, cancellationToken);
                if (updateCheckResult != null
                    && updateCheckResult.CurrentVersion != null
                    && new Version(updateCheckResult.CurrentVersion) > new Version(myVersion)
                    && updateCheckResult.CurrentVersionUrl != null)
                {
                    if (updateCheckResult.MustUpdateIfBelowVersion != null &&
                        new Version(updateCheckResult.MustUpdateIfBelowVersion) > new Version(myVersion))
                    {
                        mustUpdate = true;
                    }

                    if (mustUpdate)
                    {
                        this.State = UpdateCheckerState.DownloadingUpdateMustUpdate;
                    }
                    else
                    {
                        this.State = UpdateCheckerState.DownloadingUpdate;
                    }

                    await DownloadUpdateAsync(updateCheckResult.CurrentVersion, updateCheckResult.CurrentVersionUrl, cancellationToken);
                    hasUpdate = true;
                }
            }
            catch { }

            if (hasUpdate)
            {
                if (mustUpdate)
                {
                    this.State = UpdateCheckerState.UpdateReadyMustUpdate;
                }
                else
                {
                    this.State = UpdateCheckerState.UpdateReady;
                }
            }
            else
            {
                this.State = UpdateCheckerState.NoUpdatesAvailable;
            }
        }

        private async Task DownloadUpdateAsync(string currentVersion, string currentVersionUrl, CancellationToken cancellationToken)
        {
            var dirName = Path.Combine(_profileDirectory, "updates", currentVersion);
            if (!Directory.Exists(dirName))
            {
                Directory.CreateDirectory(dirName);
            }
            try
            {
                var tempName = Path.Combine(dirName, "_download.tmp");
                var finalName = Path.Combine(dirName, "XarChat.exe");

                if (File.Exists(finalName))
                {
                    return;
                }

                if (File.Exists(tempName))
                {
                    File.Delete(tempName);
                }
                try
                {
                    using var hc = new HttpClient();
                    var resp = await hc.GetAsync(currentVersionUrl, cancellationToken);
                    if (!resp.IsSuccessStatusCode)
                    {
                        throw new ApplicationException("Failed to retrieve update file: server returned invalid status code");
                    }

                    using (var f = File.OpenWrite(tempName))
                    using (var rs = await resp.Content.ReadAsStreamAsync(cancellationToken))
                    {
                        await rs.CopyToAsync(f, cancellationToken);
                    }

                    File.Move(tempName, finalName);
                }
                catch
                {
                    try { File.Delete(tempName); } catch { }
                    throw;
                }
            }
            catch
            {
                try { Directory.Delete(dirName, true); } catch { }
                throw;
            }
        }

        private async Task<UpdateCheckResult?> PerformUpdateManifestCheckAsync(string updateCheckUrl, CancellationToken cancellationToken)
        {
            try
            {
                using var hc = new HttpClient();
                var resp = await hc.GetAsync(updateCheckUrl, cancellationToken);
                if (!resp.IsSuccessStatusCode)
                {
                    return null;
                }
                var json = await resp.Content.ReadAsStringAsync();
                var ucr = JsonSerializer.Deserialize<UpdateCheckResult>(json, SourceGenerationContext.Default.UpdateCheckResult);
                return ucr;
            }
            catch
            {
                return null;
            }
        }

        public UpdateCheckerState State
        {
            get => _state;
            private set
            {
                if (value != _state)
                {
                    _state = value;
                    FireStateChangeEvents();
                }
            }
        }

        public IDisposable OnStateChange(Action action)
        {
            do
            {
                var originalOsc = _onStateChangeHandlers;
                var newOsc = originalOsc.Add(action);
                if (Interlocked.CompareExchange(ref _onStateChangeHandlers, newOsc, originalOsc) == originalOsc)
                {
                    break;
                }    
            } while (true);

            return new ActionDisposable(() =>
            {
                do
                {
                    var originalOsc = _onStateChangeHandlers;
                    var newOsc = originalOsc.Remove(action);
                    if (Interlocked.CompareExchange(ref _onStateChangeHandlers, newOsc, originalOsc) == originalOsc)
                    {
                        break;
                    }
                } while (true);
            });
        }

        private void FireStateChangeEvents()
        {
            var osc = _onStateChangeHandlers;
            foreach (var action in osc)
            {
                Task.Run(() =>
                {
                    try
                    {
                        action();
                    }
                    catch { }
                });
            }
        }
    }

    public class UpdateCheckResult
    {
        [JsonPropertyName("cv")]
        public string? CurrentVersion { get; set; }

        [JsonPropertyName("cvu")]
        public string? CurrentVersionUrl { get; set; }

        [JsonPropertyName("mu")]
        public string? MustUpdateIfBelowVersion { get; set; }
    }

    [JsonSerializable(typeof(UpdateCheckResult))]
    internal partial class SourceGenerationContext : JsonSerializerContext
    {
    }
}
