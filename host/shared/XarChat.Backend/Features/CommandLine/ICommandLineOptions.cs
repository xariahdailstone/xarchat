using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace XarChat.Backend.Features.CommandLine
{
    public interface ICommandLineOptions
    {
        string? WebSocketPath { get; }

        string? UrlLaunchExecutable { get; }

        bool? LaunchImagesInternally { get; }

        string? UnpackedContentPath { get; }

        bool? EnableDevTools { get; }

        bool? OpenDevToolsOnLaunch { get; }

        string? ProfilePath { get; }

        bool DisableGpuAcceleration { get; }
    }
}
