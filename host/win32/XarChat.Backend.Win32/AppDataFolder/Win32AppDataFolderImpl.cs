using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Features.AppDataFolder;
using XarChat.Backend.Features.CommandLine;

namespace XarChat.Backend.Win32.AppDataFolder
{
    public class Win32AppDataFolderImpl : IAppDataFolder
    {
        private readonly ICommandLineOptions _commandLineOptions;

        public Win32AppDataFolderImpl(
            ICommandLineOptions commandLineOptions)
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
                var baseDir = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                result = Path.Combine(baseDir, "XarChatz");
            }

            if (!Directory.Exists(result))
            {
                Directory.CreateDirectory(result /*, UnixFileMode.UserRead | UnixFileMode.UserWrite */);
            }

            return result;
        }
    }
}
