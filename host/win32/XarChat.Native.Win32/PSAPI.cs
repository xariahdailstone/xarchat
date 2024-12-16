using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Windows.Win32;

namespace XarChat.Native.Win32
{
    public static class PSAPI
    {
        public static void EmptyWorkingSet()
        {
            var procHandle = Process.GetCurrentProcess().Handle;
            PInvoke.EmptyWorkingSet(new Windows.Win32.Foundation.HANDLE(procHandle));
        }
    }
}
