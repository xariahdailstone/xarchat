using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Windows.Win32;
using Windows.Win32.Foundation;
using XarChat.Native.Win32.Wrapped;

namespace XarChat.Native.Win32
{
    public static class Shell32
    {
        public static unsafe IntPtr ExtractIcon(string exeFileName, uint iconIndex)
        {
            fixed (char* exeFileNamePtr = exeFileName)
            {
                var hIcon = PInvoke.ExtractIcon(
                    new HINSTANCE(InstanceHandle.CurrentInstance.Handle),
                    new PCWSTR(exeFileNamePtr),
                    iconIndex);
                return new IntPtr(hIcon.Value);
            }
        }
    }
}
