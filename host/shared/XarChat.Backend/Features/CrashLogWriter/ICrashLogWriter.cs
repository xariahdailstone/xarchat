using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace XarChat.Backend.Features.CrashLogWriter
{
    public interface ICrashLogWriter
    {
        void WriteCrashLog(string content, bool fatal);
    }

    public interface ICrashLogWriterCallback
    {
        void OnCrashLogWritten(string filename, bool fatal);
    }
}
