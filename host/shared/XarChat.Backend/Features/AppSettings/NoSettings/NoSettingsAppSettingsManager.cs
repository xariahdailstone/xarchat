using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using XarChat.Backend.Common;
using static XarChat.Backend.UrlHandlers.AppSettings.AppSettingsExtensions;

namespace XarChat.Backend.Features.AppSettings.NoSettings
{
    internal class NoSettingsAppSettingsManager : IAppSettingsManager
    {
        public AppSettingsData GetAppSettingsData()
        {
            return new AppSettingsData();
        }

        public JsonObject GetAppSettingsDataRaw()
        {
            var json = JsonSerializer.Serialize(new AppSettingsData(), SourceGenerationContext.Default.AppSettingsData);
            var res = JsonSerializer.Deserialize<JsonObject>(json)!;
            return res;
        }

        public Task UpdateAppSettingsData(JsonObject jsonObject, CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }
    }
}
