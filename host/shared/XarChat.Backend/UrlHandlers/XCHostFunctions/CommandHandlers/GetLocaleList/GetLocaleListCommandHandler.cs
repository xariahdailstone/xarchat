using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using XarChat.Backend.Common;
using XarChat.Backend.Features.LocaleList;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.GetLocaleList
{
    internal class GetLocaleListCommandHandler : XCHostCommandHandlerBase
    {
        private readonly ILocaleList _localeList;

        public GetLocaleListCommandHandler(ILocaleList localeList)
        {
            _localeList = localeList;
        }

        protected override async Task HandleCommandAsync(CancellationToken cancellationToken)
        {
            try
            {
                var result = await _localeList.EnumerateAvailableLocalesAsync(cancellationToken);

                var respObj = new JsonObject();
                respObj.Add("locales", new JsonArray(
                    result.Select(x =>
                    {
                        var node = new JsonObject();
                        node.Add("code", x.Code);
                        node.Add("name", x.NativeName);
                        return node;
                    })
                    .ToArray()
                ));
                await CommandContext.WriteMessage($"gotLocales " +
                    JsonSerializer.Serialize(respObj, SourceGenerationContext.Default.JsonObject));
            }
            catch (Exception ex)
            {
                var respObj = new JsonObject();
                respObj.Add("error", ex.Message);
                await CommandContext.WriteMessage($"gotLocalesError " +
                    JsonSerializer.Serialize(respObj, SourceGenerationContext.Default.JsonObject));
            }
        }
    }
}
