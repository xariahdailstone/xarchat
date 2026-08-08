using XarChat.Backend.Features.AppDataFolder;
using XarChat.Backend.Features.ChatLogging;
using XarChat.Backend.Features.FileChooser;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.ChatLogging
{
    internal class ImportLogFileCommandHandler : AsyncXCHostCommandHandlerBase
    {
        private readonly IChatLogImporter _chatLogImporter;
        private readonly IFileChooser _fileChooser;
        private readonly IAppDataFolder _appDataFolder;

        public ImportLogFileCommandHandler(
            IChatLogImporter chatLogImporter,
            IFileChooser fileChooser,
            IAppDataFolder appDataFolder)
        {
            _chatLogImporter = chatLogImporter;
            _fileChooser = fileChooser;
            _appDataFolder = appDataFolder;
        }

        protected override async Task HandleCommandAsync(CancellationToken cancellationToken)
        {
            try
            {
                var fn = await _fileChooser.SelectLocalFileAsync(
                    initialFile: null,
                    filters: [
                        new SelectLocalFileFilterEntry(
                        Name: "XarChat Log File",
                        Extensions: new List<string>() { "db" }
                    )
                    ],
                    dialogTitle: "Select XarChat log file to import",
                    cancellationToken: cancellationToken);
                if (fn is null) { return; }

                var fi = new FileInfo(fn);
                var actualLogFile = new FileInfo(Path.Combine(_appDataFolder.GetAppDataFolder(), "chatlog.db"));

                if (fi.FullName == actualLogFile.FullName)
                {
                    throw new ApplicationException("That is the log file for the currently running copy of XarChat. Please choose " +
                        "a different log file to import.");
                }

                await this.CommandContext.WriteMessage($"log.importmessage Beginning import of file {fi.FullName}");
                await _chatLogImporter.ImportFromFileAsync(
                    fi.FullName,
                    async (msg) => await this.CommandContext.WriteMessage($"log.importmessage {msg}"),
                    cancellationToken);
                await this.CommandContext.WriteMessage($"log.importmessage Log file import complete!");
            }
            catch (Exception ex)
            {
                await this.CommandContext.WriteMessage($"log.importmessage Log file import failed: {ex.Message}");
            }
        }
    }
}
