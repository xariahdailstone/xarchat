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
    internal class SetAppSettingsCommandHandler : AsyncXCHostCommandHandlerBase<JsonObject>
    {
        private readonly IAppSettingsManager _appSettingsManager;

        public SetAppSettingsCommandHandler(
            IAppSettingsManager appSettingsManager)
        {
            _appSettingsManager = appSettingsManager;
        }

        protected override async Task HandleCommandAsync(JsonObject args, CancellationToken cancellationToken)
        {
            try
            {
                await _appSettingsManager.UpdateAppSettingsData(args, cancellationToken);
                await this.CommandContext.WriteMessage($"updatedappsettings");
            }
            catch (Exception ex)
            {
                await this.CommandContext.WriteMessage("setappsettingserror " +
                    JsonSerializer.Serialize(ex.Message, SourceGenerationContext.Default.String));
            }
        }
    }
}
