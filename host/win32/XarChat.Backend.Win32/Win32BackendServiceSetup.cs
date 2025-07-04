using Microsoft.Extensions.DependencyInjection;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Features.AppDataFolder;
using XarChat.Backend.Features.AppSettings;
using XarChat.Backend.Features.CrashLogWriter;
using XarChat.Backend.Features.FileChooser;
using XarChat.Backend.Features.IdleDetection;
using XarChat.Backend.Features.MemoryHinter;
using XarChat.Backend.Features.NotificationBadge;
using XarChat.Backend.Features.UpdateChecker;
using XarChat.Backend.Features.WindowControl;
using XarChat.Backend.Win32.AppDataFolder;
using XarChat.Backend.Win32.CrashLogWriterCallback;
using XarChat.Backend.Win32.DataProtection;
using XarChat.Backend.Win32.FileChooser;
using XarChat.Backend.Win32.IdleDetection;
using XarChat.Backend.Win32.MemoryHinter;
using XarChat.Backend.Win32.NotificationBadge;

namespace XarChat.Backend.Win32
{
    public class Win32BackendServiceSetup : IBackendServiceSetup
    {
        private readonly IWindowControl _windowControl;

        public Win32BackendServiceSetup(
            IWindowControl windowControl)
        {
            _windowControl = windowControl;
        }

        public void ConfigureServices(IServiceCollection services)
        {
            services.AddSingleton<IWindowControl>(_windowControl);
            services.AddSingleton<IWin32WindowControl>(
                sp => ((IWin32WindowControl)sp.GetRequiredService<IWindowControl>()));
            services.AddSingleton<IAppDataFolder, Win32AppDataFolderImpl>();
            services.AddSingleton<IIdleDetectionManager, Win32IdleDetectionManagerImpl>();
            services.AddSingleton<INotificationBadgeManager, Win32NotificationBadgeManager>();
            services.AddSingleton<IAppSettingsDataProtectionManager, Win32AppSettingsDataProtectionManager>();
            services.AddSingleton<IMemoryHinter, Win32MemoryHinter>();
            services.AddSingleton<IFileChooser, Win32FileChooser>();
            services.AddSingleton<ICrashLogWriterCallback, Win32CrashLogWriterCallback>();
        }
    }
}
