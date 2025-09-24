using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using XarChat.Backend.Common;
using XarChat.Backend.Features.AppSettings;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.AppSettings
{
    internal class GetAppSettingsCommandHandler : AsyncXCHostCommandHandlerBase
    {
        private readonly IAppSettingsManager _appSettingsManager;

        public GetAppSettingsCommandHandler(
            IAppSettingsManager appSettingsManager)
        {
            _appSettingsManager = appSettingsManager;
        }

        protected override async Task HandleCommandAsync(CancellationToken cancellationToken)
        {
            try
            {
                var settings = _appSettingsManager.GetAppSettingsDataRaw();
                await this.CommandContext.WriteMessage($"gotappsettings " +
                    JsonSerializer.Serialize(settings, SourceGenerationContext.Default.JsonObject));
            }
            catch (Exception ex)
            {
                await this.CommandContext.WriteMessage($"gotappsettingserror " +
                    JsonSerializer.Serialize(ex.Message, SourceGenerationContext.Default.String));
            }
        }
    }
}
