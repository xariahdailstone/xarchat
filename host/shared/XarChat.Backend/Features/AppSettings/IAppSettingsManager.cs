using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using static XarChat.Backend.UrlHandlers.AppSettings.AppSettingsExtensions;

namespace XarChat.Backend.Features.AppSettings
{
    public interface IAppSettingsManager
    {
        AppSettingsData GetAppSettingsData();

        JsonObject GetAppSettingsDataRaw();

        Task UpdateAppSettingsData(JsonObject jsonObject, CancellationToken cancellationToken);
    }

    public interface IAppSettingsDataProtectionManager
    {
        string? Encode(string? rawValue);

        string? Decode(string? encodedValue);
    }
}
