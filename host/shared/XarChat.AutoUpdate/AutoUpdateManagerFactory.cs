using XarChat.AutoUpdate.Impl;
using XarChat.AutoUpdate.Impl.Disabled;

namespace XarChat.AutoUpdate
{
    public static class AutoUpdateManagerFactory
    {
        public static IAutoUpdateManager Create(
            FileInfo launchExecutable,
            string[] commandLineArgs,
            DirectoryInfo profileDirectory,
            Version runningVersion,
            string runningPlatform,
            string runningBranch)
        {
            var uargs = new UpdateCommandLineArgs(commandLineArgs);

            if (uargs.DisableAutoUpdate)
            {
                return new DisabledAutoUpdateManager();
            }
            else
            {
                return new AutoUpdateManager(
                    launchExecutable, uargs, profileDirectory, runningVersion, runningPlatform, runningBranch);
            }
        }
    }
}
