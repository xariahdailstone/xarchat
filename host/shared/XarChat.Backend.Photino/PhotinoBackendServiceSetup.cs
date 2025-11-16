using Microsoft.Extensions.DependencyInjection;
using XarChat.AutoUpdate;
using XarChat.Backend.Features.AppDataFolder;
using XarChat.Backend.Features.AppSettings;
using XarChat.Backend.Features.CrashLogWriter;
using XarChat.Backend.Features.FileChooser;
using XarChat.Backend.Features.IdleDetection;
using XarChat.Backend.Features.LocaleList;
using XarChat.Backend.Features.MemoryHinter;
using XarChat.Backend.Features.NotificationBadge;
using XarChat.Backend.Features.WindowControl;
using XarChat.Backend.Photino.Services.CrashLogWriterCallback;
using XarChat.Backend.Photino.Services.FileChooser;
using XarChat.Backend.Photino.Services.WindowControl;

namespace XarChat.Backend.Photino
{
    public abstract class PhotinoBackendServiceSetup : IBackendServiceSetup
    {
        private readonly IPhotinoWindowControl _windowControl;
        
        public PhotinoBackendServiceSetup(
            IPhotinoWindowControl windowControl)
        {
            _windowControl = windowControl;
        }

        public virtual void ConfigureServices(IServiceCollection services)
        {
            services.AddSingleton<IPhotinoWindowControl>(_windowControl);
        }
    }

    public abstract class PhotinoRequiredServicesProvider : IRequiredServicesProvider
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly IPhotinoWindowControl _photinoWindowControl;

        public PhotinoRequiredServicesProvider(
            IServiceProvider serviceProvider,
            IPhotinoWindowControl photinoWindowControl)
        {
            _serviceProvider = serviceProvider;
            _photinoWindowControl = photinoWindowControl;
        }

        public IWindowControl WindowControl => _photinoWindowControl;

        protected IServiceProvider ServiceProvider => _serviceProvider;

        public IAutoUpdateManager AutoUpdateManager => _autoUpdateManager;

        public virtual IFileChooser FileChooser 
            => ActivatorUtilities.CreateInstance<PhotinoFileChooser>(_serviceProvider);

        public virtual ICrashLogWriterCallback CrashLogWriterCallback
            => ActivatorUtilities.CreateInstance<PhotinoCrashLogWriterCallback>(_serviceProvider);

        public abstract IAppDataFolder AppDataFolder { get; }
        public abstract IIdleDetectionManager IdleDetectionManager { get; }
        public abstract INotificationBadgeManager NotificationBadgeManager { get; }
        public abstract IAppSettingsDataProtectionManager AppSettingsDataProtectionManager { get; }
        public abstract ILocaleList LocaleList { get; }
    }
}
