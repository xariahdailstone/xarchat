using Microsoft.Win32.SafeHandles;
using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;

namespace XarChat.Native.Win32.Wrapped
{
    public class Mutex : IDisposable
    {
        public static bool TryCreateOwned(string mutexName, [NotNullWhen(true)] out Mutex? mutex)
        {
            var h = Windows.Win32.PInvoke.CreateMutex(null, true, mutexName);
            if (h.IsInvalid)
            {
                mutex = default;
                return false;
            }
            else
            {
                if (Kernel32.GetLastError() == Kernel32.ERROR_ALREADY_EXISTS)
                {
                    h.Dispose();

                    mutex = default;
                    return false;
                }

                mutex = new Mutex(h);
                return true;
            }
        }

        private readonly SafeFileHandle _mutexHandle;

        private Mutex(SafeFileHandle mutexHandle)
        {
            _mutexHandle = mutexHandle;
        }

        public void Dispose()
        {
            _mutexHandle.Dispose();
        }
    }
}
