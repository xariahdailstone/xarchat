using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Native.Win32.Wrapped;

namespace XarChat.Backend.Win32
{
    public delegate nint? PossibleWindowMessageHandlerFunc(
        WindowHandle windowHandle, uint msg, nuint wParam, nint lParam);
}
