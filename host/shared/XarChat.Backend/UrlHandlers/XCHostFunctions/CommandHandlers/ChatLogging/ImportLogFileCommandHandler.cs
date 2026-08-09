using Microsoft.Extensions.DependencyInjection;
using XarChat.Backend.Features.AppDataFolder;
using XarChat.Backend.Features.ChatLogging;
using XarChat.Backend.Features.FileChooser;
using static XarChat.Backend.UrlHandlers.XCHostFunctions.WebSocketXCHostSession;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.ChatLogging
{
    internal class ImportLogFileCommandHandler : AsyncXCHostCommandHandlerBase<ImportLogFileArgs>
    {
        private readonly IServiceProvider _serviceProvider;

        public ImportLogFileCommandHandler(
            IServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
        }

        protected override async Task HandleCommandAsync(ImportLogFileArgs args, CancellationToken cancellationToken)
        {
            try
            {
                var importer = _serviceProvider.GetRequiredKeyedService<IChatLogImporter>(args.ImportType);
                await importer.ImportAsync(
                    async (msg) => await this.CommandContext.WriteMessage($"log.importmessage {msg}"),
                    cancellationToken);
            }
            catch (Exception ex)
            {
                await this.CommandContext.WriteMessage($"log.importmessage Log file import failed: {ex.Message}");
            }
        }
    }
}
