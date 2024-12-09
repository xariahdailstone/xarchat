using Microsoft.Extensions.DependencyInjection;
using XarChat.Backend.Features.AppDataFolder;
using XarChat.Backend.Features.AppSettings;
using XarChat.Backend.Features.IdleDetection;
using XarChat.Backend.Features.NotificationBadge;
using XarChat.Backend.Features.WindowControl;
using XarChat.Backend.Mac.AppDataFolder;
using XarChat.Backend.Mac.AppSettingsDataProtectionManager;
using XarChat.Backend.Mac.IdleDetectionManager;
using XarChat.Backend.Mac.NotificationBadgeManager;

namespace XarChat.Backend.Mac
{
    public class MacBackendServiceSetup : IBackendServiceSetup
    {
        private readonly IWindowControl _windowControl;

        public MacBackendServiceSetup(IWindowControl windowControl)
        {
            _windowControl = windowControl;
        }

        public void ConfigureServices(IServiceCollection services)
        {
            services.AddSingleton<IWindowControl>(_windowControl);
            services.AddSingleton<IAppDataFolder, MacAppDataFolder>();
            services.AddSingleton<IIdleDetectionManager, MacIdleDetectionManagerImpl>();
            services.AddSingleton<INotificationBadgeManager, MacNotificationBadgeManager>();
            services.AddSingleton<IAppSettingsDataProtectionManager, MacAppSettingsDataProtectionManager>();
        }
    }
}