using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Runtime.InteropServices;
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

        public unsafe static uint[] EnumProcesses()
        {
            var len = 4096;
            while (true)
            {
                var arraySizeBytes = (uint)(sizeof(uint) * len);
                var processes = new uint[len];
                uint returnedSize = 0;
                var epResult = EnumProcesses(processes, arraySizeBytes, out returnedSize);
                if (!epResult)
                {
                    return [];
                }
                if (returnedSize != arraySizeBytes)
                {
                    var result = new uint[returnedSize / (sizeof(uint))];
                    Array.Copy(processes, result, result.Length);
                    return result;
                }
                else
                {
                    len = len + 1024;
                }
            }
        }

        [DllImport("Psapi.dll", SetLastError = true)]
        private static extern bool EnumProcesses(
           [MarshalAs(UnmanagedType.LPArray, ArraySubType = UnmanagedType.U4)][In][Out] UInt32[] processIds,
           UInt32 arraySizeBytes,
           [MarshalAs(UnmanagedType.U4)] out UInt32 bytesCopied
);
    }
}
