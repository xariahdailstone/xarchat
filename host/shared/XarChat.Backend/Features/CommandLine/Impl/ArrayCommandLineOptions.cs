using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace XarChat.Backend.Features.CommandLine.Impl
{
    public class ArrayCommandLineOptions : ICommandLineOptions
    {
        public ArrayCommandLineOptions(string[] args)
        {
            ParseArguments(args);
        }

        private void ParseArguments(string[] args)
        {
            int i = 0;
            string? GetNextOrNull()
            {
                i++;
                if (i >= args.Length)
                {
                    return null;
                }
                else
                {
                    return args[i];
                }
            }

            for (i = 0; i < args.Length; i++)
            {
                var targ = args[i];
                switch (targ.ToLower())
                {
                    case "-p":
                        {
                            var profPath = GetNextOrNull();
                            this.ProfilePath = profPath;
                        }
                        break;
                    case "--ws":
                    case "-w":
                        {
                            var wsAddr = GetNextOrNull();
                            if (!String.IsNullOrWhiteSpace(wsAddr))
                            {
                                this.WebSocketPath = wsAddr;
                            }
                        }
                        break;
                    case "--urllaunch":
                    case "-u":
                        {
                            var launchArgs = GetNextOrNull();
                            if (!String.IsNullOrWhiteSpace(launchArgs))
                            {
                                this.UrlLaunchExecutable = launchArgs;
                            }
                        }
                        break;
                    case "--content":
                    case "-c":
                        {
                            var contentPath = GetNextOrNull();
                            if (!String.IsNullOrWhiteSpace(contentPath))
                            {
                                this.UnpackedContentPath = contentPath;
                            }
                        }
                        break;
                    case "--devtools":
                    case "-d":
                        this.EnableDevTools = true;
                        break;
                    case "--devtoolsonlaunch":
                    case "-l":
                        this.EnableDevTools = true;
                        this.OpenDevToolsOnLaunch = true;
                        break;
                    case "--images-external":
                        this.LaunchImagesInternally = false;
                        break;
                    case "--images-internal":
                        this.LaunchImagesInternally = true;
                        break;
                    case "--disable-gpu":
                        this.DisableGpuAcceleration = true;
                        break;
                    case "--lang":
                        {
                            var lang = GetNextOrNull();
                            if (!String.IsNullOrWhiteSpace(lang))
                            {
                                this.BrowserLanguage = lang;
                            }
                        }
                        break;
                }
            }
        }

        public string? WebSocketPath { get; private set; } = null;

        public string? UrlLaunchExecutable { get; private set; } = null;

        public bool? LaunchImagesInternally { get; private set; } = null;

        public string? UnpackedContentPath { get; private set; } = null;

        public bool? EnableDevTools { get; private set; } = null;

        public bool? OpenDevToolsOnLaunch { get; private set; } = null;

        public string? ProfilePath { get; private set; } = null;

        public bool DisableGpuAcceleration { get; private set; } = false;

        public string? BrowserLanguage { get; private set; } = null;
    }
}
