using Microsoft.Extensions.DependencyInjection;
using XarChat.Backend.Features.AppDataFolder;
using XarChat.Backend.Features.AppSettings;
using XarChat.Backend.Features.IdleDetection;
using XarChat.Backend.Features.LocaleList;
using XarChat.Backend.Features.NotificationBadge;
using XarChat.Backend.Features.WindowControl;
using XarChat.Backend.Linux.AppDataFolder;
using XarChat.Backend.Linux.AppSettingsDataProtectionManager;
using XarChat.Backend.Linux.IdleDetectionManager;
using XarChat.Backend.Linux.LocaleList;
using XarChat.Backend.Linux.NotificationBadgeManager;
using XarChat.Backend.Photino;
using XarChat.Backend.Photino.Services.WindowControl;

namespace XarChat.Backend.Linux
{
    public class LinuxBackendServiceSetup : PhotinoBackendServiceSetup
    {
        public LinuxBackendServiceSetup(
            IPhotinoWindowControl windowControl)
            : base(windowControl)
        {
        }

        public override void ConfigureServices(IServiceCollection services)
        {
            base.ConfigureServices(services);

            services.AddSingleton<IRequiredServicesProvider, LinuxRequiredServicesProvider>();
        }
    }

    internal class LinuxRequiredServicesProvider : PhotinoRequiredServicesProvider
    {
        public LinuxRequiredServicesProvider(
            IServiceProvider serviceProvider,
            IPhotinoWindowControl photinoWindowControl)
            : base(serviceProvider, photinoWindowControl)
        {
        }

        public override IAppDataFolder AppDataFolder
            => ActivatorUtilities.CreateInstance<LinuxAppDataFolder>(ServiceProvider);

        public override IIdleDetectionManager IdleDetectionManager 
            => ActivatorUtilities.CreateInstance<LinuxIdleDetectionManagerImpl>(ServiceProvider);

        public override INotificationBadgeManager NotificationBadgeManager 
            => ActivatorUtilities.CreateInstance<LinuxNotificationBadgeManager>(ServiceProvider);

        public override IAppSettingsDataProtectionManager AppSettingsDataProtectionManager 
            => ActivatorUtilities.CreateInstance<LinuxAppSettingsDataProtectionManager>(ServiceProvider);

        public override ILocaleList LocaleList
            => ActivatorUtilities.CreateInstance<LinuxLocaleList>(ServiceProvider);
    }
}