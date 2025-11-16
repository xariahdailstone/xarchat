using Microsoft.Extensions.DependencyInjection;
using XarChat.AutoUpdate;
using XarChat.Backend.Features.AppDataFolder;
using XarChat.Backend.Features.AppSettings;
using XarChat.Backend.Features.CrashLogWriter;
using XarChat.Backend.Features.IdleDetection;
using XarChat.Backend.Features.LocaleList;
using XarChat.Backend.Features.NotificationBadge;
using XarChat.Backend.Features.WindowControl;
using XarChat.Backend.Mac.AppDataFolder;
using XarChat.Backend.Mac.AppSettingsDataProtectionManager;
using XarChat.Backend.Mac.IdleDetectionManager;
using XarChat.Backend.Mac.LocaleList;
using XarChat.Backend.Mac.NotificationBadgeManager;
using XarChat.Backend.Photino;
using XarChat.Backend.Photino.Services.WindowControl;

namespace XarChat.Backend.Mac
{
    public class MacBackendServiceSetup : PhotinoBackendServiceSetup
    {
        public MacBackendServiceSetup(
            IPhotinoWindowControl windowControl)
            : base(windowControl)
        {
        }

        public override void ConfigureServices(IServiceCollection services)
        {
            base.ConfigureServices(services);

            services.AddSingleton<IRequiredServicesProvider, MacRequiredServicesProvider>();
        }
    }

    internal class MacRequiredServicesProvider : PhotinoRequiredServicesProvider
    {
        public MacRequiredServicesProvider(
            IServiceProvider serviceProvider,
            IPhotinoWindowControl photinoWindowControl)
            : base(serviceProvider, photinoWindowControl)
        {
        }

        public override IAppDataFolder AppDataFolder
            => ActivatorUtilities.CreateInstance<MacAppDataFolder>(ServiceProvider);

        public override IIdleDetectionManager IdleDetectionManager
            => ActivatorUtilities.CreateInstance<MacIdleDetectionManagerImpl>(ServiceProvider);

        public override INotificationBadgeManager NotificationBadgeManager 
            => ActivatorUtilities.CreateInstance<MacNotificationBadgeManager>(ServiceProvider); 

        public override IAppSettingsDataProtectionManager AppSettingsDataProtectionManager 
            => ActivatorUtilities.CreateInstance<MacAppSettingsDataProtectionManager>(ServiceProvider);

        public override ILocaleList LocaleList 
            => ActivatorUtilities.CreateInstance<MacLocaleList>(ServiceProvider);
    }
}