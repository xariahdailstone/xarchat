using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Common;
using XarChat.Backend.Features.AppFileServer;
using static XarChat.Backend.UrlHandlers.XCHostFunctions.WebSocketXCHostSession;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.GetFileData
{
    internal class GetFileDataCommandHandler : XCHostCommandHandlerBase<GetCssDataArgs>
    {
        private readonly IAppFileServer _appFileServer;

        public GetFileDataCommandHandler(IAppFileServer appFileServer)
        {
            _appFileServer = appFileServer;
        }

        protected override async Task HandleCommandAsync(GetCssDataArgs args, CancellationToken cancellationToken)
        {
            string data;
            try
            {
                data = await _appFileServer.GetFileContentAsStringAsync(args.Url, cancellationToken);
            }
            catch
            {
                data = "";
            }

            var respMsg = "gotcssdata";

            if (CommandContext.Command.Equals("getsvgdata", StringComparison.OrdinalIgnoreCase)) 
            {
                respMsg = "gotsvgdata";
            }

            await CommandContext.WriteMessage(respMsg + " " +
                JsonUtilities.Serialize(new GotCssDataResult()
                {
                    MessageId = args.MessageId,
                    Data = data
                }, SourceGenerationContext.Default.GotCssDataResult));
        }
    }

    internal class GetAllCssCommandHandler : XCHostCommandHandlerBase<GetAllCssArgs>
    {
        private readonly IAppFileServer _appFileServer;

        public GetAllCssCommandHandler(IAppFileServer appFileServer)
        {
            _appFileServer = appFileServer;
        }

        protected override async Task HandleCommandAsync(GetAllCssArgs args, CancellationToken cancellationToken)
        {
            var result = new GotAllCssResult() { MessageId = args.MessageId, Filenames = new List<string>() };

            var fs = _appFileServer;
            var allFiles = await fs.ListFilesAsync(cancellationToken);
            foreach (var fn in allFiles)
            {
                if (fn.EndsWith(".css", StringComparison.OrdinalIgnoreCase))
                {
                    result.Filenames.Add(fn);
                }
            }

            await CommandContext.WriteMessage("gotallcss " + JsonUtilities.Serialize(
                result, SourceGenerationContext.Default.GotAllCssResult));
        }
    }
}
