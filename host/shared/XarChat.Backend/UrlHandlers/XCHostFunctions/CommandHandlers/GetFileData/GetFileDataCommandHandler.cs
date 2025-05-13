using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using XarChat.Backend.Common;
using XarChat.Backend.Features.AppDataFolder;
using XarChat.Backend.Features.AppFileServer;
using static XarChat.Backend.UrlHandlers.XCHostFunctions.WebSocketXCHostSession;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.GetFileData
{
    internal class GetFileDataCommandHandler : AsyncXCHostCommandHandlerBase<GetCssDataArgs>
    {
        private readonly IAppFileServer _appFileServer;
        private readonly IAppDataFolder _appDataFolder;

        public GetFileDataCommandHandler(
            IAppFileServer appFileServer,
            IAppDataFolder appDataFolder)
        {
            _appFileServer = appFileServer;
            _appDataFolder = appDataFolder;
        }

        protected override async Task HandleCommandAsync(GetCssDataArgs args, CancellationToken cancellationToken)
        {
            string data;
            try
            {
                if (args.Url == "/customcss")
                {
                    data = await GetCustomCssDataAsync();
                }
                else
                {
                    data = await _appFileServer.GetFileContentAsStringAsync(args.Url, cancellationToken);
                }
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

        private async Task<string> GetCustomCssDataAsync()
        {
            var adf = _appDataFolder.GetAppDataFolder();
            List<string> cssFilesSorted;
            try
            {
                var customCssDir = Path.Combine(adf, "customcss");
                cssFilesSorted = Directory.GetFiles(customCssDir, "*.css").OrderBy(f => f).ToList();
            }
            catch
            {
                cssFilesSorted = [];
            }

            var resultSb = new StringBuilder();
            foreach (var cssFile in cssFilesSorted)
            {
                try
                {
                    using var f = File.OpenText(cssFile);
                    var cssContent = await f.ReadToEndAsync();
                    resultSb.AppendLine($"/* File {cssFile} */");
                    resultSb.AppendLine(cssContent);
                }
                catch { }
            }

            return resultSb.ToString();
        }
    }

    internal class GetAllCssCommandHandler : AsyncXCHostCommandHandlerBase<GetAllCssArgs>
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
