using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Features.AppDataFolder;

namespace XarChat.Backend.Features.CrashLogWriter.Impl
{
    internal class CrashLogWriterImpl : ICrashLogWriter
    {
        private readonly IAppDataFolder _appDataFolder;
        private readonly IEnumerable<ICrashLogWriterCallback>? _callbacks;

        public CrashLogWriterImpl(
            IAppDataFolder appDataFolder,
            IEnumerable<ICrashLogWriterCallback>? callbacks)
        {
            _appDataFolder = appDataFolder;
            _callbacks = callbacks;
        }

        public void WriteCrashLog(string content, bool fatal)
        {
            var fn = _appDataFolder.GetAppDataFolder();
            var logFn = Path.Combine(fn, $"crashlog-{DateTime.UtcNow:yyyyMMddHHmmss}.log");
            using (var f = File.CreateText(logFn))
            {
                f.Write(content);
            }

            if (_callbacks is not null)
            {
                foreach (var callback in _callbacks)
                {
                    callback.OnCrashLogWritten(logFn, fatal);
                }
            }
            if (fatal)
            {
                Environment.Exit(55);
            }
        }
    }
}
