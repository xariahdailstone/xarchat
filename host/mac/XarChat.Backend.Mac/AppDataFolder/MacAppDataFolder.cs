
using XarChat.Backend.Features.AppDataFolder;
using XarChat.Backend.Features.CommandLine;

namespace XarChat.Backend.Mac.AppDataFolder
{
    public class MacAppDataFolder : IAppDataFolder
    {
        private readonly ICommandLineOptions _commandLineOptions;

        public MacAppDataFolder(ICommandLineOptions commandLineOptions)
        {
            _commandLineOptions = commandLineOptions;
        }

        public string GetAppDataFolder()
        {
            string result;

            if (!String.IsNullOrWhiteSpace(_commandLineOptions.ProfilePath))
            {
                result = _commandLineOptions.ProfilePath;
            }
            else
            {
                var baseDir = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
                result = Path.Combine(baseDir, ".xarchat");
            }

            Console.WriteLine($"profile dir = {result}");
            if (!Directory.Exists(result))
            {
                Directory.CreateDirectory(result, UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);
            }

            return result;
        }
    }
}