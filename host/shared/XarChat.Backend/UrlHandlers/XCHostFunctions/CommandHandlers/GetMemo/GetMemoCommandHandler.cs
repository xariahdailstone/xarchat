using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using XarChat.Backend.Common;
using XarChat.Backend.Features.FListApi;
using XarChat.Backend.Features.FListApi.Impl;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.GetMemo
{
    internal class GetMemoCommandHandler : AsyncXCHostCommandHandlerBase<JsonObject>
    {
        private readonly IFListApi _fListApi;

        public GetMemoCommandHandler(IFListApi fListApi)
        {
            _fListApi = fListApi;
        }

        protected override async Task HandleCommandAsync(JsonObject args, CancellationToken cancellationToken)
        {
            var myName = args["me"]!.ToString();
            var getForName = args["char"]!.ToString();

            try
            {
                var authApi = await _fListApi.GetAlreadyAuthenticatedFListApiAsync(myName, cancellationToken);
                string? memoText = null;
                try
                {
                    var resp = await authApi.GetMemoAsync(getForName, cancellationToken);
                    memoText = resp.MemoText;
                }
                catch (FListApiException fex) when (fex.Message.Contains("not found"))
                {
                    memoText = null;
                }

                var respObj = new JsonObject();
                respObj.Add("name", getForName);
                respObj.Add("note", memoText);
                await CommandContext.WriteMessage($"gotmemo " +
                    JsonSerializer.Serialize(respObj, SourceGenerationContext.Default.JsonObject));
            }
            catch (Exception ex)
            {
                var respObj = new JsonObject();
                respObj.Add("name", getForName);
                respObj.Add("error", ex.Message);
                await CommandContext.WriteMessage($"gotmemoerror " +
                    JsonSerializer.Serialize(respObj, SourceGenerationContext.Default.JsonObject));
            }
        }
    }

}
