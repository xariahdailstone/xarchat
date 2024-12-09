using System.Diagnostics;

namespace XarChat.AutoUpdate.Impl
{
    internal class LocalUpdateDirectory
    {
        public LocalUpdateDirectory(DirectoryInfo directoryBase, Version version)
        {
            _directoryBaseName = directoryBase.FullName;
            this.Version = version;
        }

        private readonly string _directoryBaseName;
        public DirectoryInfo DirectoryBase => new DirectoryInfo(_directoryBaseName);

        public Version Version { get; }

        public FileInfo XarChatExeFilename => new FileInfo(Path.Combine(DirectoryBase.FullName, "XarChat.exe"));

        public bool IsExecutable
        {
            get
            {
                var xarChatExeFilename = XarChatExeFilename;
                return xarChatExeFilename.Exists;
            }
        }

        private FileInfo DownloadTempFile => new FileInfo(Path.Combine(DirectoryBase.FullName, "_download.tmp"));

        public Task<bool> TryExecuteAsReplacementProcess(
            FileInfo effectiveInitialLaunchExe,
            UpdateCommandLineArgs myCommandLineArgs)
        {
            try
            {
                var subArgs = myCommandLineArgs.Clone();
                subArgs.InitialLaunchExe = effectiveInitialLaunchExe.FullName;
                subArgs.RunningAsRelaunch = true;

                var psi = new ProcessStartInfo();
                psi.UseShellExecute = false;
                psi.FileName = XarChatExeFilename.FullName;
                psi.WorkingDirectory = XarChatExeFilename.DirectoryName;
                foreach (var subArg in subArgs.ToCommandLineArgsArray())
                {
                    psi.ArgumentList.Add(subArg);
                }

                var process = Process.Start(psi);
                return Task.FromResult(true);
            }
            catch
            {
                return Task.FromResult(false);
            }
        }

        public async Task DownloadExecutableAsync(
            string downloadUrl,
            CancellationToken cancellationToken)
        {
            if (IsExecutable)
            {
                return;
            }

            var dlTemp = DownloadTempFile;
            if (dlTemp.Exists)
            {
                dlTemp.Delete();
            }

            {
                using var hc = new HttpClient();
                using var resp = await hc.GetAsync(downloadUrl, cancellationToken);
                using var respStream = await resp.Content.ReadAsStreamAsync(cancellationToken);
                try
                {
                    using var tempStream = dlTemp.Create();
                    await respStream.CopyToAsync(tempStream, cancellationToken);
                }
                catch
                {
                    try { dlTemp.Delete(); } catch { }
                    throw;
                }
            }

            try
            {
                File.Move(dlTemp.FullName, XarChatExeFilename.FullName);
            }
            catch
            {
                try { XarChatExeFilename.Delete(); } catch { }
                throw;
            }
        }

        public void Delete()
        {
            DirectoryBase.Delete(true);
        }
    }
}
