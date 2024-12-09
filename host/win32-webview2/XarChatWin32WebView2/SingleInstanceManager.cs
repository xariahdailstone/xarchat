using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace MinimalWin32Test
{
    //internal class SingleInstanceManager : IDisposable
    //{
    //    public static SingleInstanceManager? TryCreate(string mutexName, string activateWindowName)
    //    {
    //        if (XarChat.Native.Win32.Wrapped.Mutex.TryCreateOwned(mutexName, out var mutexObj))
    //        {
    //            return new SingleInstanceManager(mutexObj);
    //        }
    //        else
    //        {
    //            var w = XarChat.Native.Win32.User32.FindWindow(null, activateWindowName);
    //            if (w != 0)
    //            {
    //                XarChat.Native.Win32.User32.SetForegroundWindow(w);
    //            }
    //            return null;
    //        }
    //    }

    //    private readonly XarChat.Native.Win32.Wrapped.Mutex _mutex;

    //    private SingleInstanceManager(XarChat.Native.Win32.Wrapped.Mutex mutex)
    //    {
    //        _mutex = mutex;
    //    }

    //    public void Dispose()
    //    {
    //        _mutex.Dispose();
    //    }
    //}
}
