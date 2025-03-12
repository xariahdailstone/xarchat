using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using XarChat.Backend.Common;
using XarChat.Backend.Features.AppConfiguration;
using static XarChat.Backend.UrlHandlers.XCHostFunctions.WebSocketXCHostSession;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.ConfigData
{
    internal static class ChangeMetadataOriginatorKey
    {
        public static readonly string Value = Guid.NewGuid().ToString();
    }

    internal class GetConfigDataCommandHandler : AsyncXCHostCommandHandlerBase<GetConfigDataArgs>
    {
        private readonly IAppConfiguration _appConfiguration;

        public GetConfigDataCommandHandler(IAppConfiguration appConfiguration)
        {
            _appConfiguration = appConfiguration;
        }

        protected override async Task HandleCommandAsync(GetConfigDataArgs args, CancellationToken cancellationToken)
        {
            GotConfigDataResult res;
            try
            {
                res = await GetConfigDataAsync(args.MessageId, cancellationToken);
            }
            catch
            {
                res = new GotConfigDataResult() { MessageId = args.MessageId, Data = new List<ConfigKeyValue>() };
            }

            await CommandContext.WriteMessage("gotconfig " +
                JsonUtilities.Serialize(res, SourceGenerationContext.Default.GotConfigDataResult));
        }

        private async Task<GotConfigDataResult> GetConfigDataAsync(int messageId, CancellationToken cancellationToken)
        {
            var appConfig = _appConfiguration;
            var kvps = appConfig.GetAllArbitraryValues();

            var res = new GotConfigDataResult() { MessageId = messageId, Data = new List<ConfigKeyValue>() };
            foreach (var kvp in kvps)
            {
                res.Data.Add(new ConfigKeyValue() { Key = kvp.Key, Value = kvp.Value });
            }
            return res;
        }
    }

    internal class SetConfigDataCommandHandler : AsyncXCHostCommandHandlerBase<ConfigKeyValue>
    {
        public const string Originator = "client";

        private readonly IAppConfiguration _appConfiguration;

        public SetConfigDataCommandHandler(IAppConfiguration appConfiguration)
        {
            _appConfiguration = appConfiguration;
        }

        protected override bool RunInSerial => true;

        protected override async Task HandleCommandAsync(ConfigKeyValue args, CancellationToken cancellationToken)
        {
            await this.SetConfigDataAsync(args.Key, args.Value, cancellationToken);
        }

        private async Task SetConfigDataAsync(string key, JsonNode value, CancellationToken cancellationToken)
        {
            var appConfig = _appConfiguration;
            var changeMetadata = new Dictionary<string, object?>
            {
                { ChangeMetadataOriginatorKey.Value, SetConfigDataCommandHandler.Originator }
            };

            await appConfig.SetArbitraryValueAsync(key, value, changeMetadata, cancellationToken);
        }
    }
}
