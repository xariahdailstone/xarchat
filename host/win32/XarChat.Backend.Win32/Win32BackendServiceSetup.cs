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
using XarChat.Backend.Features.LocaleList;
using XarChat.Backend.Features.MemoryHinter;
using XarChat.Backend.Features.NotificationBadge;
using XarChat.Backend.Features.UpdateChecker;
using XarChat.Backend.Features.WindowControl;
using XarChat.Backend.Win32.AppDataFolder;
using XarChat.Backend.Win32.CrashLogWriterCallback;
using XarChat.Backend.Win32.DataProtection;
using XarChat.Backend.Win32.FileChooser;
using XarChat.Backend.Win32.IdleDetection;
using XarChat.Backend.Win32.LocaleList;
using XarChat.Backend.Win32.MemoryHinter;
using XarChat.Backend.Win32.NotificationBadge;

namespace XarChat.Backend.Win32
{
    public class Win32BackendServiceSetup : IBackendServiceSetup
    {
        private readonly IWin32WindowControl _windowControl;

        public Win32BackendServiceSetup(
            IWin32WindowControl windowControl)
        {
            _windowControl = windowControl;
        }

        public void ConfigureServices(IServiceCollection services)
        {
            services.AddSingleton<IRequiredServicesProvider>(sp => new Win32RequiredServicesProvider(sp, _windowControl));

            services.AddSingleton<IWin32WindowControl>(
                sp => ((IWin32WindowControl)sp.GetRequiredService<IWindowControl>()));


            services.AddSingleton<IMemoryHinter, Win32MemoryHinter>();
        }
    }

    public class Win32RequiredServicesProvider : IRequiredServicesProvider
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly IWin32WindowControl _windowControl;

        public Win32RequiredServicesProvider(
            IServiceProvider serviceProvider,
            IWin32WindowControl windowControl)
        {
            _serviceProvider = serviceProvider;
            _windowControl = windowControl;
        }

        public IWindowControl WindowControl 
            => _windowControl;

        public IAppDataFolder AppDataFolder 
            => ActivatorUtilities.CreateInstance<Win32AppDataFolderImpl>(_serviceProvider);

        public IIdleDetectionManager IdleDetectionManager 
            => ActivatorUtilities.CreateInstance<Win32IdleDetectionManagerImpl>(_serviceProvider);

        public INotificationBadgeManager NotificationBadgeManager 
            => ActivatorUtilities.CreateInstance<Win32NotificationBadgeManager>(_serviceProvider);

        public IAppSettingsDataProtectionManager AppSettingsDataProtectionManager 
            => ActivatorUtilities.CreateInstance<Win32AppSettingsDataProtectionManager>(_serviceProvider);

        public IFileChooser FileChooser 
            => ActivatorUtilities.CreateInstance<Win32FileChooser>(_serviceProvider);

        public ICrashLogWriterCallback CrashLogWriterCallback 
            => ActivatorUtilities.CreateInstance<Win32CrashLogWriterCallback>(_serviceProvider);

        public ILocaleList LocaleList 
            => ActivatorUtilities.CreateInstance<Win32LocaleList>(_serviceProvider);
    }
}
