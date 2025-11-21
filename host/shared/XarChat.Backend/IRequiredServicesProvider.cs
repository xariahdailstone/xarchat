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
using XarChat.Backend.Features.WindowControl;

namespace XarChat.Backend
{
    public interface IRequiredServicesProvider
    {
        IWindowControl WindowControl { get; }
        IAppDataFolder AppDataFolder { get; }
        IIdleDetectionManager IdleDetectionManager { get; }
        INotificationBadgeManager NotificationBadgeManager { get; }
        IAppSettingsDataProtectionManager AppSettingsDataProtectionManager { get; }
        IFileChooser FileChooser { get; }
        ICrashLogWriterCallback CrashLogWriterCallback { get; }
        ILocaleList LocaleList { get; }
    }
}
