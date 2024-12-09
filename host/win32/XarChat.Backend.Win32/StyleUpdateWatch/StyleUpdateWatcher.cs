using Microsoft.Extensions.Hosting;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Features.AppConfiguration;
using XarChat.Backend.Features.WindowControl;

namespace XarChat.Backend.Win32.StyleUpdateWatch
{
    internal class StyleUpdateWatcher : BackgroundService
    {
        private readonly IAppConfiguration _appConfiguration;
        private readonly IWindowControl _windowControl;

        private readonly object _lock = new object();
        private readonly Dictionary<string, Guid> _lastUpdateGuids = new Dictionary<string, Guid>();

        public StyleUpdateWatcher(
            IAppConfiguration appConfiguration,
            IWindowControl windowControl)
        {
            _appConfiguration = appConfiguration;
            _windowControl = windowControl;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            try
            {
                if (_appConfiguration.ContentDirectory == null ||
                    _appConfiguration.ContentDirectory.StartsWith("res:"))
                {
                    return;
                }

                var stylesDir = Path.Combine(_appConfiguration.ContentDirectory, "styles");
                var fi = new FileInfo(_appConfiguration.ContentDirectory);
                var stripBaseDir = fi.FullName;

                using var fsw = new FileSystemWatcher(stylesDir);
                fsw.Filter = "*.css";
                fsw.IncludeSubdirectories = true;
                fsw.Changed += async (o, e) =>
                {
                    var myGuid = Guid.NewGuid();
                    lock (_lock)
                    {
                        _lastUpdateGuids[e.FullPath] = myGuid;
                    }

                    await Task.Delay(100, CancellationToken.None);

                    lock (_lock)
                    {
                        Guid testGuid = Guid.NewGuid();
                        if (_lastUpdateGuids.TryGetValue(e.FullPath, out testGuid))
                        {
                            if (testGuid != myGuid)
                            {
                                return;
                            }
                            _lastUpdateGuids.Remove(e.FullPath);
                        }
                        else
                        {
                            return;
                        }
                    }

                    if (e.ChangeType == WatcherChangeTypes.Changed &&
                        Path.GetExtension(e.FullPath) == ".css")
                    {
                        var sendPath = e.FullPath.Substring(stripBaseDir.Length).Replace("\\", "/").TrimStart('/');
                        _windowControl.StylesheetChanged(sendPath);
                    }
                };
                fsw.EnableRaisingEvents = true;

                await Task.Delay(-1, stoppingToken);
            }
            catch { }
        }
    }
}
