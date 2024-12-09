using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Microsoft.WindowsAPICodePack.Taskbar
{
    internal static class CoreHelpers
    {
        /// <summary>
        /// Determines if the application is running on Windows 7
        /// </summary>
        internal static bool RunningOnWin7
        {
            get
            {
                return (Environment.OSVersion.Version.Major > 6) ||
                    (Environment.OSVersion.Version.Major == 6 && Environment.OSVersion.Version.Minor >= 1);
            }
        }

        /// <summary>
        /// Throws PlatformNotSupportedException if the application is not running on Windows 7
        /// </summary>
        internal static void ThrowIfNotWin7()
        {
            if (!RunningOnWin7)
            {
                throw new PlatformNotSupportedException("This application requires Windows 7 or newer");
            }
        }
    }
}
