using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using static XarChat.Backend.UrlHandlers.AppSettings.AppSettingsExtensions;

namespace XarChat.Backend.Features.AppSettings
{
    public interface IAppSettingsManager
    {
        AppSettingsData GetAppSettingsData();

        Task UpdateAppSettingsData(AppSettingsData appSettingsData, CancellationToken cancellationToken);
    }

    public interface IAppSettingsDataProtectionManager
    {
        string? Encode(string? rawValue);

        string? Decode(string? encodedValue);
    }
}
