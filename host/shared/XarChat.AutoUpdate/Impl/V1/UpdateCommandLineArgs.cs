namespace XarChat.AutoUpdate.Impl
{
    internal class UpdateCommandLineArgs
    {
        public UpdateCommandLineArgs(string[] args)
        {
            var otherArgs = new List<string>();

            foreach (var arg in args)
            {
                var lowerArg = arg.ToLower();
                if (lowerArg == DisableAutoUpdateArg)
                {
                    this.DisableAutoUpdate = true;
                }
                else if (lowerArg == RunningAsRelaunchArg)
                {
                    this.RunningAsRelaunch = true;
                }
                else if (lowerArg.StartsWith(InitialLaunchArgPrefix))
                {
                    this.InitialLaunchExe = arg.Substring(InitialLaunchArgPrefix.Length);
                }
                else if (lowerArg.StartsWith(AutoUpdateUrlFormatArgPrefix))
                {
                    this.AutoUpdateUrlFormat = arg.Substring(AutoUpdateUrlFormatArgPrefix.Length);
                }
                else
                {
                    otherArgs.Add(arg);
                }
            }

            this.OtherCommandLineArguments = otherArgs;
        }

        private const string DisableAutoUpdateArg = "--disableautoupdate";
        public bool DisableAutoUpdate { get; set; }

        private const string RunningAsRelaunchArg = "--autoupdate:relaunched";
        public bool RunningAsRelaunch { get; set; }

        private const string InitialLaunchArgPrefix = "--autoupdate:initialexe=";
        public string? InitialLaunchExe { get; set; }

        private const string AutoUpdateUrlFormatArgPrefix = "--autoupdate:url=";
        public string? AutoUpdateUrlFormat { get; set; }

        public List<string> OtherCommandLineArguments { get; set; }

        public string[] ToCommandLineArgsArray()
        {
            var results = new List<string>();
            results.AddRange(this.OtherCommandLineArguments);

            if (this.DisableAutoUpdate)
            {
                results.Add(DisableAutoUpdateArg);
            }
            if (this.RunningAsRelaunch)
            {
                results.Add(RunningAsRelaunchArg);
            }
            if (InitialLaunchExe != null)
            {
                results.Add(InitialLaunchArgPrefix + InitialLaunchExe);
            }
            if (AutoUpdateUrlFormat != null) 
            {
                results.Add(AutoUpdateUrlFormatArgPrefix + AutoUpdateUrlFormat);
            }

            return results.ToArray();
        }

        public UpdateCommandLineArgs Clone()
        {
            var args = this.ToCommandLineArgsArray();
            return new UpdateCommandLineArgs(args);
        }
    }
}
