using Microsoft.Extensions.Hosting;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Features.AppConfiguration;
using XarChat.Backend.Features.AppDataFolder;
using XarChat.Backend.Features.WindowControl;

namespace XarChat.Backend.Features.StyleUpdateWatcher
{
    internal class StyleUpdateWatcher : BackgroundService
    {
        private readonly IAppConfiguration _appConfiguration;
        private readonly IAppDataFolder _appDataFolder;
        private readonly IWindowControl _windowControl;

        private readonly object _lock = new object();
        private readonly Dictionary<string, Guid> _lastUpdateGuids = new Dictionary<string, Guid>();

        public StyleUpdateWatcher(
            IAppConfiguration appConfiguration,
            IAppDataFolder appDataFolder,
            IWindowControl windowControl)
        {
            _appConfiguration = appConfiguration;
            _appDataFolder = appDataFolder;
            _windowControl = windowControl;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var tasks = new List<Task>();
            try
            {
                if (_appConfiguration.ContentDirectory is not null &&
                    !_appConfiguration.ContentDirectory.StartsWith("res:"))
                {
                    tasks.Add(ExecuteForDirectoryAsync(
                        Path.Combine(_appConfiguration.ContentDirectory),
                        "styles",
                        "styles/$",
                        stoppingToken));
                }

                var adf = _appDataFolder.GetAppDataFolder();
                if (adf is not null) 
                {
                    tasks.Add(ExecuteForDirectoryAsync(
                        adf,
                        "customcss", 
                        "/customcss", 
                        stoppingToken));
                }

                try
                {
                    await Task.Delay(-1, stoppingToken);
                }
                catch when (stoppingToken.IsCancellationRequested) { }

                await Task.WhenAll(tasks);
            }
            catch { }
        }

        protected async Task ExecuteForDirectoryAsync(
            string localDirectory, string watchSubPath, string webPath, CancellationToken stoppingToken)
        {
            var stylesDir = localDirectory;
            var fi = new FileInfo(localDirectory);
            var stripBaseDir = Path.Combine(fi.FullName, watchSubPath);

            using var fsw = new FileSystemWatcher(stylesDir);
            fsw.Filter = "*.css";
            fsw.IncludeSubdirectories = true;

            async Task HandleChange(string fn)
            {
                var myGuid = Guid.NewGuid();
                lock (_lock)
                {
                    _lastUpdateGuids[fn] = myGuid;
                }

                await Task.Delay(100, CancellationToken.None);

                lock (_lock)
                {
                    Guid testGuid = Guid.NewGuid();
                    if (_lastUpdateGuids.TryGetValue(fn, out testGuid))
                    {
                        if (testGuid != myGuid)
                        {
                            return;
                        }
                        _lastUpdateGuids.Remove(fn);
                    }
                    else
                    {
                        return;
                    }
                }

                if (/*e.ChangeType == WatcherChangeTypes.Changed &&*/
                    fn.StartsWith(stripBaseDir, StringComparison.OrdinalIgnoreCase) &&
                    Path.GetExtension(fn) == ".css")
                {
                    var sendPath = webPath.Replace("$",
                        fn.Substring(stripBaseDir.Length).Replace("\\", "/").TrimStart('/'));
                    _windowControl.StylesheetChanged(sendPath);
                }
            }

            fsw.Created += async (o, e) =>
            {
                await HandleChange(e.FullPath);
            };
            fsw.Deleted += async (o, e) =>
            {
                await HandleChange(e.FullPath);
            };
            fsw.Renamed += async (o, e) =>
            {
                await HandleChange(e.OldFullPath);
                await HandleChange(e.FullPath);
            };
            fsw.Changed += async (o, e) =>
            {
                await HandleChange(e.FullPath);
            };
            fsw.EnableRaisingEvents = true;

            try
            {
                await Task.Delay(-1, stoppingToken);
            }
            catch when (stoppingToken.IsCancellationRequested) { }
        }
    }
}
