using Microsoft.Extensions.DependencyInjection;
using XarChat.Backend.Features.AppDataFolder;
using XarChat.Backend.Features.AppSettings;
using XarChat.Backend.Features.IdleDetection;
using XarChat.Backend.Features.NotificationBadge;
using XarChat.Backend.Features.WindowControl;
using XarChat.Backend.Linux.AppDataFolder;
using XarChat.Backend.Linux.AppSettingsDataProtectionManager;
using XarChat.Backend.Linux.IdleDetectionManager;
using XarChat.Backend.Linux.NotificationBadgeManager;

namespace XarChat.Backend.Linux
{
    public class LinuxBackendServiceSetup : IBackendServiceSetup
    {
        private readonly IWindowControl _windowControl;

        public LinuxBackendServiceSetup(IWindowControl windowControl)
        {
            _windowControl = windowControl;
        }

        public void ConfigureServices(IServiceCollection services)
        {
            services.AddSingleton<IWindowControl>(_windowControl);
            services.AddSingleton<IAppDataFolder, LinuxAppDataFolder>();
            services.AddSingleton<IIdleDetectionManager, LinuxIdleDetectionManagerImpl>();
            services.AddSingleton<INotificationBadgeManager, LinuxNotificationBadgeManager>();
            services.AddSingleton<IAppSettingsDataProtectionManager, LinuxAppSettingsDataProtectionManager>();
        }
    }
}