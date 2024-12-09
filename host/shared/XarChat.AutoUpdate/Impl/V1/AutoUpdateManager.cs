//#define AUTO_DOWNLOAD_UPDATES
//#define ORIGINAL_EXE_SWAP

using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Web;
using XarChat.Backend.Features.UpdateChecker;

namespace XarChat.AutoUpdate.Impl
{
    internal class AutoUpdateManager : IAutoUpdateManager
    {
        private readonly FileInfo _launchExecutable;
        private readonly UpdateCommandLineArgs _commandLineArgs;
        private readonly DirectoryInfo _profileDirectory;
        private readonly Version _runningVersion;
        private readonly string _runningPlatform;
        private readonly string _runningBranch;

        private readonly CancellationTokenSource _updateLoopCTS = new CancellationTokenSource();
        private Task? _updateLoopTask = null;

        public AutoUpdateManager(
            FileInfo launchExecutable,
            UpdateCommandLineArgs commandLineArgs,
            DirectoryInfo profileDirectory,
            Version runningVersion,
            string runningPlatform,
            string runningBranch)
        {
            _launchExecutable = launchExecutable;
            _commandLineArgs = commandLineArgs;
            _profileDirectory = profileDirectory;
            _runningVersion = runningVersion;
            _runningPlatform = runningPlatform;
            _runningBranch = runningBranch;
        }

        public void Dispose()
        {
            if (!_updateLoopCTS.IsCancellationRequested)
            {
                _updateLoopCTS.Cancel();
                if (_updateLoopTask != null)
                {
                    try { _updateLoopTask.Wait(); }
                    catch { }
                }
            }
        }

        internal DirectoryInfo UpdatesDirectory
        {
            get
            {
                var result = Path.Combine(_profileDirectory.FullName, "updates");
                if (!Directory.Exists(result)) 
                {
                    Directory.CreateDirectory(result);
                }
                return new DirectoryInfo(result);
            }
        }

        internal FileInfo EffectiveInitialLaunchExecutable
        {
            get
            {
                if (_commandLineArgs.InitialLaunchExe != null)
                {
                    return new FileInfo(_commandLineArgs.InitialLaunchExe);
                }
                else
                {
                    return _launchExecutable;
                }
            }
        }

        internal IEnumerable<LocalUpdateDirectory> EnumerateLocalUpdateDirectories()
        {
            var updateDir = UpdatesDirectory;
            foreach (var potentialUpdateDir in updateDir.EnumerateDirectories())
            {
                var localName = Path.GetFileName(potentialUpdateDir.FullName);
                Version ver;
                try
                {
                    ver = new Version(localName);
                }
                catch 
                {
                    continue;
                }

                yield return new LocalUpdateDirectory(potentialUpdateDir, ver);
            }
        }

        internal LocalUpdateDirectory CreateOrGetLocalUpdateDirectory(Version ver)
        {
            foreach (var lud in EnumerateLocalUpdateDirectories())
            {
                if (lud.Version == ver)
                {
                    return lud;
                }
            }

            var updDir = new DirectoryInfo(Path.Combine(UpdatesDirectory.FullName, ver.ToString()));
            updDir.Create();
            return new LocalUpdateDirectory(new DirectoryInfo(updDir.FullName), ver);
        }

        public async Task<bool> TryRunMostRecentAsync(CancellationToken cancellationToken)
        {
#if AUTO_DOWNLOAD_UPDATES
            var q =
                from d in EnumerateLocalUpdateDirectories()
                where d.IsExecutable && d.Version > _runningVersion
                orderby d.Version descending
                select d;
            var toRun = q.FirstOrDefault();

            if (toRun == null)
            {
                return false;
            }
            else
            {
                var result = await toRun.TryExecuteAsReplacementProcess(EffectiveInitialLaunchExecutable, _commandLineArgs);
                return result;
            }
#else
            return false;
#endif
        }

        public void StartUpdateChecks()
        {
            if (_updateLoopTask == null)
            {
                _updateLoopTask = Task.Run(async () =>
                {
                    try
                    {
                        await UpdateCheckLoopAsync(_updateLoopCTS.Token);
                    }
                    catch { }
                });
            }
        }

        internal async Task UpdateCheckLoopAsync(CancellationToken cancellationToken)
        {
            RemoveOldUpdates();

            try
            {
                while (!cancellationToken.IsCancellationRequested)
                {
                    await DoUpdateCheckAsync(cancellationToken);
                    await Task.Delay(TimeSpan.FromMinutes(60), cancellationToken);
                }
            }
            catch when (cancellationToken.IsCancellationRequested) { }
        }

        private void RemoveOldUpdates()
        {
            if (_commandLineArgs.RunningAsRelaunch)
            {
                return;
            }
            
            foreach (var ud in EnumerateLocalUpdateDirectories())
            {
                if (ud.Version <= _runningVersion)
                {
                    try { ud.Delete(); }
                    catch { }
                }
            }
        }

        private bool _hasMustUpdate = false;
        private bool _updateAvailable = false;

        private async Task DoUpdateCheckAsync(CancellationToken cancellationToken)
        {
            try
            {
                this.AutoUpdateState = AutoUpdateState.CheckingForUpdates;

                var updateUrlFormat = !String.IsNullOrWhiteSpace(_commandLineArgs.AutoUpdateUrlFormat)
                    ? _commandLineArgs.AutoUpdateUrlFormat
                    : "https://xariah.net/xarchat/api/AutoUpdate/GetUpdateInfo";

                var updateUrl = updateUrlFormat + String.Format("?v={0}&p={1}&b={2}",
                    HttpUtility.UrlEncode(_runningVersion.ToString()),
                    HttpUtility.UrlEncode(_runningPlatform),
                    HttpUtility.UrlEncode(_runningBranch));

                using var hc = new HttpClient();
                var resp = await hc.GetAsync(updateUrl, cancellationToken);
                resp.EnsureSuccessStatusCode();
                var respJson = await resp.Content.ReadAsStringAsync(cancellationToken);
                var respObj = JsonSerializer.Deserialize<GetUpdateInfoResponse>(respJson, SourceGenerationContext.Default.GetUpdateInfoResponse)!;

                var latestVersion = new Version(respObj.LatestVersion ?? _runningVersion.ToString());
                if (latestVersion > _runningVersion && respObj.LatestVersionDownloadUrl != null)
                {
                    _hasMustUpdate = _hasMustUpdate || (respObj.MustUpdate ?? false);

                    _updateAvailable = true;
#if AUTO_DOWNLOAD_UPDATES
                    await DownloadNewVersionAsync(latestVersion, respObj.LatestVersionDownloadUrl, cancellationToken);
#endif
                }
            }
            catch { }
            finally
            {
#if AUTO_DOWNLOAD_UPDATES
                var q =
                    from ud in this.EnumerateLocalUpdateDirectories()
                    where ud.IsExecutable && ud.Version > _runningVersion
                    select ud;
                var hasWaitingUpdate = q.Any();

                this.AutoUpdateState = !hasWaitingUpdate ? AutoUpdateState.NoUpdatesWaiting :
                    (_hasMustUpdate ?
                     AutoUpdateState.UpdateReadyRequired :
                     AutoUpdateState.UpdateReady);
#else
                this.AutoUpdateState = (!_updateAvailable) ? AutoUpdateState.NoUpdatesWaiting:
                    (_hasMustUpdate ?
                     AutoUpdateState.UpdateAvailableRequired:
                     AutoUpdateState.UpdateAvailable);
#endif
            }
        }

#if AUTO_DOWNLOAD_UPDATES
        private async Task DownloadNewVersionAsync(Version latestVersion, string latestVersionDownloadUrl, CancellationToken cancellationToken)
        {
            var ud = CreateOrGetLocalUpdateDirectory(latestVersion);
            if (!ud.IsExecutable)
            {
                this.AutoUpdateState = _hasMustUpdate
                    ? AutoUpdateState.DownloadingUpdateRequired
                    : AutoUpdateState.DownloadingUpdate;

                await ud.DownloadExecutableAsync(latestVersionDownloadUrl, cancellationToken);
            }
        }
#endif

        private AutoUpdateState _autoUpdateState = AutoUpdateState.Initializing;
        private ImmutableDictionary<object, Action<AutoUpdateState>> _autoUpdateStateWatchers
            = ImmutableDictionary<object, Action<AutoUpdateState>>.Empty;

        public AutoUpdateState AutoUpdateState
        {
            get => _autoUpdateState;
            set
            {
                if (value != _autoUpdateState)
                {
                    _autoUpdateState = value;
                    var d = _autoUpdateStateWatchers;
                    foreach (var cb in d.Values)
                    {
                        Task.Run(() =>
                        {
                            try
                            {
                                cb(value);
                            }
                            catch { }
                        });
                    }
                }
            }
        }

        public bool RelaunchOnExitRequested { get; private set; } = false;

        UpdateCheckerState IUpdateChecker.State
        {
            get
            {
                switch (this.AutoUpdateState)
                {
                    case AutoUpdateState.Initializing:
                        return UpdateCheckerState.CheckingForUpdates;
                    case AutoUpdateState.CheckingForUpdates:
                        return UpdateCheckerState.CheckingForUpdates;
                    case AutoUpdateState.DownloadingUpdate:
                        return UpdateCheckerState.DownloadingUpdate;
                    case AutoUpdateState.DownloadingUpdateRequired:
                        return UpdateCheckerState.DownloadingUpdateMustUpdate;
                    case AutoUpdateState.UpdateReady:
                        return UpdateCheckerState.UpdateReady;
                    case AutoUpdateState.UpdateReadyRequired:
                        return UpdateCheckerState.UpdateReadyMustUpdate;
                    case AutoUpdateState.UpdateAvailable:
                        return UpdateCheckerState.UpdateAvailable;
                    case AutoUpdateState.UpdateAvailableRequired:
                        return UpdateCheckerState.UpdateAvailableRequired;
                    default:
                    case AutoUpdateState.NoUpdatesWaiting:
                        return UpdateCheckerState.NoUpdatesAvailable;
                }
            }
        }

        public IDisposable RegisterAutoUpdateStateChangedHandler(Action<AutoUpdateState> callback)
        {
            var obj = new object();

            while (true)
            {
                var dict = _autoUpdateStateWatchers;
                var updatedDict = dict.Add(obj, callback);
                if (Interlocked.CompareExchange(ref _autoUpdateStateWatchers, updatedDict, dict) == dict)
                {
                    break;
                }
            }

            return new ActionDisposable(() => 
            {
                while (true)
                {
                    var dict = _autoUpdateStateWatchers;
                    if (dict.ContainsKey(obj))
                    {
                        var updatedDict = dict.Remove(obj);
                        if (Interlocked.CompareExchange(ref _autoUpdateStateWatchers, updatedDict, dict) == dict)
                        {
                            break;
                        }
                    }
                    else
                    {
                        break;
                    }
                }
            });
        }

        private bool _signalledSuccess = false;

        public void SignalRunningSuccessfully()
        {
            if (_signalledSuccess)
            {
                return;
            }

            _signalledSuccess = true;

            if (!_commandLineArgs.RunningAsRelaunch || _commandLineArgs.InitialLaunchExe == null)
            {
                return;
            }

            Task.Run(async () =>
            {
#if ORIGINAL_EXE_SWAP && AUTO_DOWNLOAD_UPDATES
                await SwapToMainExecutableAsync(_updateLoopCTS.Token);
#endif
                RemoveOlderStagedUpdates();
            });
            
        }

        private void RetryFileOperation(Action action)
        {
            int retriesRemaining = 20;
            while (retriesRemaining > 0)
            {
                try
                {
                    action();
                    break;
                }
                catch
                {
                    retriesRemaining--;
                    if (retriesRemaining == 0)
                        throw;

                    Thread.Sleep(300);
                }
            }
        }

#if ORIGINAL_EXE_SWAP && AUTO_DOWNLOAD_UPDATES
        private async Task SwapToMainExecutableAsync(CancellationToken cancellationToken)
        {
            var originalExe = EffectiveInitialLaunchExecutable.FullName;
            var tempNewExe = Path.Combine(Path.GetDirectoryName(originalExe)!, "XarChat_new.tmp");
            var tempNewExe2 = Path.Combine(Path.GetDirectoryName(originalExe)!, "XarChat_new2.tmp");
            var tempOldExe = Path.Combine(Path.GetDirectoryName(originalExe)!, "XarChat_old.tmp");
            var runningExe = _launchExecutable.FullName;

            //using var log = File.CreateText(Path.Combine(Path.GetDirectoryName(originalExe)!, "xarchatswap.log"));
            //log.AutoFlush = true;
            //log.WriteLine($"originalExe = {originalExe}");
            //log.WriteLine($"tempNewExe = {tempNewExe}");
            //log.WriteLine($"tempNewExe2 = {tempNewExe2}");
            //log.WriteLine($"tempOldExe = {tempOldExe}");
            //log.WriteLine($"runningExe = {runningExe}");
            //log.WriteLine();

            try
            {
                if (File.Exists(tempNewExe))
                {
                    //log.WriteLine($"Removing tempNewExe...");
                    try { RetryFileOperation(() => File.Delete(tempNewExe)); }
                    catch { return; }
                }
                if (File.Exists(tempNewExe2))
                {
                    //log.WriteLine($"Removing tempNewExe2...");
                    try { RetryFileOperation(() => File.Delete(tempNewExe2)); }
                    catch { return; }
                }
                if (File.Exists(tempOldExe))
                {
                    //log.WriteLine($"Removing tempOldExe...");
                    try { RetryFileOperation(() => File.Delete(tempOldExe)); }
                    catch { return; }
                }

                {
                    //log.WriteLine($"Opening runningExe for read...");
                    using var thisReadStream = File.OpenRead(runningExe);
                    //log.WriteLine($"Creating tempNewExe for write...");
                    using var newExeStream = File.Create(tempNewExe);
                    //log.WriteLine($"Copying runningExe to tempNewExe...");
                    await thisReadStream.CopyToAsync(newExeStream, cancellationToken);
                }

                //log.WriteLine($"Moving tempNewExe to tempNewExe2...");
                RetryFileOperation(() => File.Move(tempNewExe, tempNewExe2));
                //log.WriteLine($"Moving originalExe to tempOldExe...");
                RetryFileOperation(() => File.Move(originalExe, tempOldExe));
                try
                {
                    //log.WriteLine($"Moving tempNewExe2 to originalExe...");
                    RetryFileOperation(() => File.Move(tempNewExe2, originalExe));
                    //log.WriteLine($"Moving tempOldExe...");
                    RetryFileOperation(() => File.Delete(tempOldExe));
                }
                catch (Exception ex)
                {
                    //log.WriteLine($"Failure: {ex}");
                    try
                    {
                        //log.WriteLine($"Cleanup: Moving tempOldExe to originalExe...");
                        RetryFileOperation(() => File.Move(tempOldExe, originalExe));
                    }
                    catch (Exception ex2)
                    {
                        //log.WriteLine($"Failure: {ex2}");
                    }
                    throw;
                }
            }
            catch (Exception ex)
            {
                //log.WriteLine($"Failure: {ex}");
            }
            finally
            {
                if (File.Exists(tempNewExe))
                {
                    //log.WriteLine($"Deleting tempNewExe...");
                    try { RetryFileOperation(() => File.Delete(tempNewExe)); }
                    catch { }
                }
            }
        }
#endif

        private void RemoveOlderStagedUpdates()
        {
            foreach (var ud in EnumerateLocalUpdateDirectories().Where(ud => ud.Version < _runningVersion))
            {
                try { ud.Delete(); }
                catch { }
            }
        }

        IDisposable IUpdateChecker.OnStateChange(Action action)
        {
            return this.RegisterAutoUpdateStateChangedHandler((x) => action());
        }

        void IUpdateChecker.IndicateRelaunchOnExit()
        {
            this.RelaunchOnExitRequested = true;
        }

        void IUpdateChecker.IndicateSuccessfulLogin()
        {
            this.SignalRunningSuccessfully();
        }
    }
}
