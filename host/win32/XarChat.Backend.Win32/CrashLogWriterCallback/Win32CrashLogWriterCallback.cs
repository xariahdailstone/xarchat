using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Features.CrashLogWriter;
using XarChat.Native.Win32;

namespace XarChat.Backend.Win32.CrashLogWriterCallback
{
    internal class Win32CrashLogWriterCallback : ICrashLogWriterCallback
    {
        public void OnCrashLogWritten(string filename, bool fatal)
        {
            if (fatal)
            {
                User32.MessageBox(0,
                    $"XarChat has encountered an unexpected error and must be shut down.\n\n" +
                    $"Details are logged to the file {filename}",
                    "XarChat Error");
            }
            else
            {
                User32.MessageBox(0,
                    $"XarChat has encountered an unexpected error.\n\n" +
                    $"Details are logged to the file {filename}",
                    "XarChat Error");
            }
        }
    }
}
