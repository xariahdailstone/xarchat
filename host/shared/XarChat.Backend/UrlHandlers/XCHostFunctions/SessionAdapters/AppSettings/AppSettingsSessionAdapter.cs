using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using XarChat.Backend.Common;
using XarChat.Backend.Features.AppSettings;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.SessionAdapters.AppSettings
{
    internal class AppSettingsSessionAdapter : SessionAdapter
    {
        private readonly IAppSettingsManager _appSettingsManager;

        public AppSettingsSessionAdapter(IAppSettingsManager appSettingsManager)
        {
            _appSettingsManager = appSettingsManager;

            this.RegisterTypedCommand(
                "get",
                SourceGenerationContext.Default.JsonNode,
                SourceGenerationContext.Default.JsonNode,
                GetAppSettingsAsync);
            this.RegisterTypedCommand(
                "update",
                SourceGenerationContext.Default.JsonNode,
                SourceGenerationContext.Default.JsonNode,
                UpdateAppSettingsAsync);
        }

        private async Task<JsonNode> GetAppSettingsAsync(string cmd, JsonNode data, CancellationToken cancellationToken)
        {
            try
            {
                var settings = _appSettingsManager.GetAppSettingsDataRaw();
                var jobj = new JsonObject();
                jobj["result"] = settings;
                return jobj;
            }
            catch (Exception ex)
            {
                var jobj = new JsonObject();
                jobj["error"] = ex.Message;
                return jobj;
            }
        }

        private async Task<JsonNode> UpdateAppSettingsAsync(string cmd, JsonNode data, CancellationToken cancellationToken)
        {
            try
            {
                await _appSettingsManager.UpdateAppSettingsData((JsonObject)data, cancellationToken);
                var jobj = new JsonObject();
                jobj["result"] = true;
                return jobj;
            }
            catch (Exception ex)
            {
                var jobj = new JsonObject();
                jobj["error"] = ex.Message;
                return jobj;
            }
        }
    }
}
