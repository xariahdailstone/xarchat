using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;

namespace XarChat.Native.Win32
{
    public static class Gdi32
    {
        [DllImport("gdi32.dll")]
        public static extern nint CreateSolidBrush(uint crColor);
    }
}
