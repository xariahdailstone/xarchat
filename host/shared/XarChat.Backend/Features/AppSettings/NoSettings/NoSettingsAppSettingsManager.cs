using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using static XarChat.Backend.UrlHandlers.AppSettings.AppSettingsExtensions;

namespace XarChat.Backend.Features.AppSettings.NoSettings
{
    internal class NoSettingsAppSettingsManager : IAppSettingsManager
    {
        public AppSettingsData GetAppSettingsData()
        {
            return new AppSettingsData();
        }

        public Task UpdateAppSettingsData(AppSettingsData appSettingsData, CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }
    }
}
